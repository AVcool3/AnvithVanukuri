/**
 * robustSolve.js
 * ==============
 *
 * A "stronger linalg.solve": solves A x = b for a square matrix A, but unlike
 * numpy's `linalg.solve` / MATLAB's `\` it does NOT blindly trust Gaussian
 * elimination with partial pivoting. It follows the playbook laid out in
 * John Urschel's article "Numerical Stability in Gaussian Elimination"
 * (AMS Notices, June/July 2025):
 *
 *   1. Factor A = L U with PARTIAL pivoting (fast, usually fine).
 *   2. Measure the GROWTH FACTOR g(A) = max|U| / max|A|. The article's
 *      Theorem 1 says the backward error of LU is roughly  n * u * g(A),
 *      so a huge g(A) means the factorization is garbage even when the
 *      condition number is small (the Wilkinson matrix is the poster child:
 *      cond(A) ~ 45 but g(A) = 2^(n-1)).
 *   3. If g(A) is suspicious, redo the factorization with COMPLETE pivoting,
 *      which has a provable growth bound (Wilkinson 1961, Bisain–Edelman–
 *      Urschel 2025) at the cost of ~2x more comparisons.
 *   4. If even that looks bad (or the matrix is numerically singular),
 *      fall back to Householder QR, which is unconditionally backward stable
 *      (growth is not a concept there) at ~2x the flops of LU.
 *   5. Polish the answer with ITERATIVE REFINEMENT, computing the residual
 *      r = b - A x in "double-double" (~106-bit) arithmetic. This is the
 *      classic trick (Wilkinson again) that recovers full double-precision
 *      accuracy whenever the factorization was "good enough".
 *   6. Report what happened: growth factor, condition-number estimate,
 *      componentwise backward error, which method ended up being used, and
 *      plain-English warnings. numpy gives you a number and no warning; this
 *      gives you a number AND a reason to trust (or distrust) it.
 *
 * The file has zero dependencies and is a plain ES module, so it works in
 * Node (for tests) and in any React / Vite / Next project via
 *   import { solve } from "./robustSolve.js";
 *
 * ---------------------------------------------------------------------------
 * HOW TO READ THIS FILE
 * ---------------------------------------------------------------------------
 * Section 0: tiny helpers (matrix conversion, norms, double-double arithmetic)
 * Section 1: the three factorizations (partial LU, complete LU, Householder QR)
 * Section 2: triangular solves + applying a factorization to a right-hand side
 * Section 3: diagnostics (growth factor, condition estimate, backward error)
 * Section 4: iterative refinement
 * Section 5: `solve()` – the orchestrator that ties it all together
 * Section 6: `naiveSolve()` – a numpy-style reference solver for comparison
 *
 * Every tunable lives in DEFAULT_OPTIONS so you can change behavior without
 * touching the algorithms. Search for "TUNE:" comments for the knobs that
 * matter most.
 * ---------------------------------------------------------------------------
 */

// ===========================================================================
// SECTION 0 — Helpers
// ===========================================================================

/** Unit round-off for IEEE double precision (the "u" in the article). */
export const UNIT_ROUNDOFF = Number.EPSILON / 2; // 2^-53 ≈ 1.1e-16

/**
 * Default knobs. Pass an object with any subset of these as the third
 * argument to `solve()` to override.
 */
export const DEFAULT_OPTIONS = {
  /**
   * TUNE: growth-factor threshold for partial pivoting. If g(A) exceeds this
   * we re-factor with complete pivoting. The article's Figure 6 shows random
   * matrices cluster around g ≈ 0.6·sqrt(n) and essentially never exceed
   * 2·sqrt(n), so anything much bigger means "this matrix is adversarial".
   * We use a generous multiple so the slow path is only taken when needed.
   */
  partialGrowthFactor: (n) => 16 * Math.sqrt(n) + 64,

  /**
   * TUNE: growth-factor threshold for complete pivoting. Wilkinson's 1961
   * bound is g ≤ 2·n^(ln(n)/4 + 1/2) and in practice complete pivoting
   * essentially never exceeds ~n (the folklore conjecture is "false but
   * nearly true"). If we see worse than this, something is badly wrong and
   * we go to QR.
   */
  completeGrowthFactor: (n) => 4 * n + 64,

  /**
   * TUNE: maximum iterative-refinement sweeps. Each sweep costs one
   * double-double matrix–vector product plus one triangular solve pair
   * (O(n^2)), which is cheap next to the O(n^3) factorization.
   */
  maxRefinementSteps: 5,

  /**
   * TUNE: refinement stops when the correction shrinks the solution by less
   * than this relative amount (we've hit the noise floor), or when it stops
   * shrinking at all (divergence => factorization is untrustworthy).
   */
  refinementTolerance: 4 * UNIT_ROUNDOFF,

  /**
   * TUNE: after refinement, if the componentwise backward error is still
   * above this, escalate to the next (safer) factorization. sqrt(u) ≈ 1e-8
   * is a common "this answer is only half-right" line in the literature.
   */
  acceptableBackwardError: Math.sqrt(UNIT_ROUNDOFF),

  /**
   * Row/column equilibration (scaling) before factoring. Uses exact
   * powers of two so it introduces NO rounding error. This is what LAPACK's
   * dgesvx does and it fixes "badly scaled" systems (e.g. one row in meters,
   * another in nanometers).
   */
  equilibrate: true,

  /**
   * Relative pivot size below which we declare the matrix numerically
   * singular for the LU paths. The QR path uses the same number on |R_ii|.
   */
  singularTolerance: 1e3 * UNIT_ROUNDOFF,

  /**
   * Warn if the estimated condition number times u exceeds this. Beyond it,
   * even a perfectly backward-stable solver can't promise many correct digits
   * because the PROBLEM (not the algorithm) amplifies input error.
   */
  conditionWarning: 1e-6,

  /** Set true to get console.warn output in addition to `info.warnings`. */
  verbose: false,
};

/**
 * Accepts a matrix as `number[][]`, `Float64Array[]`, or a flat
 * `{ n, data: Float64Array }` and returns a fresh row-major Float64Array copy
 * plus its dimension. Always copies so callers' arrays are never mutated.
 */
function toFlatMatrix(A) {
  if (A && A.data instanceof Float64Array && Number.isInteger(A.n)) {
    return { n: A.n, data: Float64Array.from(A.data) };
  }
  if (!Array.isArray(A) || A.length === 0) {
    throw new TypeError("A must be a non-empty square array of rows");
  }
  const n = A.length;
  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    const row = A[i];
    if (!row || row.length !== n) {
      throw new TypeError(`A must be square: row ${i} has length ${row?.length}, expected ${n}`);
    }
    for (let j = 0; j < n; j++) {
      const v = Number(row[j]);
      if (!Number.isFinite(v)) throw new TypeError(`A[${i}][${j}] is not a finite number`);
      data[i * n + j] = v;
    }
  }
  return { n, data };
}

/** Copies a right-hand side vector into a Float64Array and validates length. */
function toFlatVector(b, n) {
  if (!b || b.length !== n) {
    throw new TypeError(`b must have length ${n}, got ${b?.length}`);
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = Number(b[i]);
    if (!Number.isFinite(v)) throw new TypeError(`b[${i}] is not a finite number`);
    out[i] = v;
  }
  return out;
}

/** max_i |v_i| — the infinity norm of a vector. */
function infNorm(v) {
  let m = 0;
  for (let i = 0; i < v.length; i++) {
    const a = Math.abs(v[i]);
    if (a > m) m = a;
  }
  return m;
}

/** max_ij |A_ij| — the "max norm" the article uses for the growth factor. */
function maxAbsEntry(data) {
  return infNorm(data);
}

/** Largest power of two that is ≤ x (x > 0). Used for exact scaling. */
function powerOfTwoAtMost(x) {
  return 2 ** Math.floor(Math.log2(x));
}

// --- Double-double ("error-free transformation") arithmetic -----------------
// These let us compute b - A·x with ~32 significant digits even though the
// inputs are ordinary doubles. Without this, iterative refinement cannot
// improve a solution that is already accurate to ~1e-16 relative, because
// the residual itself would be pure rounding noise. (Dekker 1971, Knuth.)

/** twoSum: returns [s, e] with s = fl(a+b) and a + b = s + e EXACTLY. */
function twoSum(a, b) {
  const s = a + b;
  const bb = s - a;
  const e = a - (s - bb) + (b - bb);
  return [s, e];
}

/** Splits a double into hi + lo halves each with ≤ 26 significant bits. */
const SPLITTER = 134217729; // 2^27 + 1
function split(a) {
  const c = SPLITTER * a;
  const hi = c - (c - a);
  return [hi, a - hi];
}

/** twoProd: returns [p, e] with p = fl(a*b) and a*b = p + e EXACTLY. */
function twoProd(a, b) {
  const p = a * b;
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  const e = al * bl - (p - ah * bh - al * bh - ah * bl);
  return [p, e];
}

/**
 * Residual r = b - A x computed in double-double, then rounded to double.
 * This is the single most important ingredient of iterative refinement.
 */
function residualDoubleDouble(n, A, x, b) {
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // Accumulate (hi, lo) = b_i - Σ_j A_ij x_j in double-double.
    let hi = b[i];
    let lo = 0;
    const row = i * n;
    for (let j = 0; j < n; j++) {
      const [p, pe] = twoProd(A[row + j], x[j]);
      // hi + lo  -=  p + pe
      let [s, se] = twoSum(hi, -p);
      lo += se - pe;
      hi = s;
      // Renormalize so hi carries the bulk and lo the leftover.
      [hi, lo] = twoSum(hi, lo);
    }
    r[i] = hi + lo;
  }
  return r;
}

// ===========================================================================
// SECTION 1 — Factorizations
// ===========================================================================
//
// All three factorizations work IN PLACE on a row-major Float64Array copy of
// A and return an object describing how to solve with the result. The
// `kind` field tells Section 2 which solve routine to use.

/**
 * LU with PARTIAL pivoting: at step k, swap rows so the pivot is the largest
 * entry in column k (below the diagonal). This is what LAPACK dgetrf and
 * therefore numpy/MATLAB/Julia use. Fast, but growth can reach 2^(n-1).
 *
 * Returns { kind:"lu", n, LU, rowPerm, colPerm:null, growthFactor, singular }
 *   LU      – L (unit lower, stored strictly below diagonal) and U (upper)
 *   rowPerm – rowPerm[i] = original row index now sitting in position i
 */
export function luPartial(n, A, singularTolerance = DEFAULT_OPTIONS.singularTolerance) {
  const LU = A; // factor in place
  const rowPerm = new Int32Array(n);
  for (let i = 0; i < n; i++) rowPerm[i] = i;

  const aMax = maxAbsEntry(LU); // ‖A‖_max, denominator of the growth factor
  let uMax = 0; // running max |U_ij|, numerator of the growth factor
  let singular = false;
  let minPivot = Infinity;

  for (let k = 0; k < n; k++) {
    // --- choose pivot: largest |A_ik| for i ≥ k ---------------------------
    let p = k;
    let pMax = Math.abs(LU[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(LU[i * n + k]);
      if (v > pMax) {
        pMax = v;
        p = i;
      }
    }
    if (pMax <= singularTolerance * aMax) {
      // Every candidate pivot is (numerically) zero: rank deficient.
      singular = true;
      minPivot = 0;
      break;
    }
    if (pMax < minPivot) minPivot = pMax;

    // --- swap rows p and k (whole rows, so L stays consistent) -------------
    if (p !== k) {
      for (let j = 0; j < n; j++) {
        const t = LU[k * n + j];
        LU[k * n + j] = LU[p * n + j];
        LU[p * n + j] = t;
      }
      const t = rowPerm[k];
      rowPerm[k] = rowPerm[p];
      rowPerm[p] = t;
    }

    // --- record growth on the pivot row (this row is now part of U) -------
    for (let j = k; j < n; j++) {
      const v = Math.abs(LU[k * n + j]);
      if (v > uMax) uMax = v;
    }

    // --- eliminate below the pivot: the rank-one update of equation (1) ---
    const pivot = LU[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const l = LU[i * n + k] / pivot; // multiplier, stored as L_ik
      LU[i * n + k] = l;
      if (l !== 0) {
        for (let j = k + 1; j < n; j++) {
          LU[i * n + j] -= l * LU[k * n + j];
        }
      }
    }
  }

  return {
    kind: "lu",
    n,
    LU,
    rowPerm,
    colPerm: null,
    growthFactor: aMax === 0 ? 1 : uMax / aMax,
    minPivot,
    singular,
  };
}

/**
 * LU with COMPLETE pivoting: at step k, search the WHOLE trailing submatrix
 * for the largest entry and swap both a row and a column to bring it to the
 * pivot position. Von Neumann called this "customary"; its growth factor is
 * provably tiny (Wilkinson's bound, equation (3) in the article). It costs
 * O(n^3) extra comparisons, which is why libraries don't default to it.
 *
 * Returns the same shape as luPartial but with colPerm populated:
 *   P A Q = L U, where colPerm[j] = original column index now in position j.
 */
export function luComplete(n, A, singularTolerance = DEFAULT_OPTIONS.singularTolerance) {
  const LU = A;
  const rowPerm = new Int32Array(n);
  const colPerm = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    rowPerm[i] = i;
    colPerm[i] = i;
  }

  const aMax = maxAbsEntry(LU);
  let uMax = 0;
  let singular = false;
  let minPivot = Infinity;

  for (let k = 0; k < n; k++) {
    // --- find the largest entry in the trailing (n-k)×(n-k) block ---------
    let pr = k;
    let pc = k;
    let pMax = -1;
    for (let i = k; i < n; i++) {
      for (let j = k; j < n; j++) {
        const v = Math.abs(LU[i * n + j]);
        if (v > pMax) {
          pMax = v;
          pr = i;
          pc = j;
        }
      }
    }
    if (pMax <= singularTolerance * aMax) {
      singular = true;
      minPivot = 0;
      break;
    }
    if (pMax < minPivot) minPivot = pMax;

    // --- row swap ---------------------------------------------------------
    if (pr !== k) {
      for (let j = 0; j < n; j++) {
        const t = LU[k * n + j];
        LU[k * n + j] = LU[pr * n + j];
        LU[pr * n + j] = t;
      }
      const t = rowPerm[k];
      rowPerm[k] = rowPerm[pr];
      rowPerm[pr] = t;
    }
    // --- column swap (affects every row, including already-computed L) ----
    if (pc !== k) {
      for (let i = 0; i < n; i++) {
        const t = LU[i * n + k];
        LU[i * n + k] = LU[i * n + pc];
        LU[i * n + pc] = t;
      }
      const t = colPerm[k];
      colPerm[k] = colPerm[pc];
      colPerm[pc] = t;
    }

    for (let j = k; j < n; j++) {
      const v = Math.abs(LU[k * n + j]);
      if (v > uMax) uMax = v;
    }

    const pivot = LU[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const l = LU[i * n + k] / pivot;
      LU[i * n + k] = l;
      if (l !== 0) {
        for (let j = k + 1; j < n; j++) {
          LU[i * n + j] -= l * LU[k * n + j];
        }
      }
    }
  }

  return {
    kind: "lu",
    n,
    LU,
    rowPerm,
    colPerm,
    growthFactor: aMax === 0 ? 1 : uMax / aMax,
    minPivot,
    singular,
  };
}

/**
 * Householder QR: A = Q R with Q orthogonal, R upper triangular. We never
 * form Q explicitly; we store the Householder vectors v_k (in the strictly
 * lower part of the array plus a separate `tau` array) and apply Qᵀ to b by
 * replaying the reflections. Orthogonal transformations don't amplify
 * errors, so this is backward stable for EVERY matrix — the safety net.
 *
 * Returns { kind:"qr", n, QR, tau, singular, minDiag }
 */
export function householderQR(n, A, singularTolerance = DEFAULT_OPTIONS.singularTolerance) {
  const QR = A;
  const tau = new Float64Array(n);
  const aMax = maxAbsEntry(QR);
  let minDiag = Infinity;
  let singular = false;

  for (let k = 0; k < n; k++) {
    // --- build the reflector that zeroes column k below the diagonal -------
    let normSq = 0;
    for (let i = k; i < n; i++) normSq += QR[i * n + k] ** 2;
    const norm = Math.sqrt(normSq);
    if (norm === 0) {
      tau[k] = 0;
      minDiag = 0;
      singular = true;
      continue;
    }
    const akk = QR[k * n + k];
    // Choose the sign that avoids cancellation (classic stability detail).
    const alpha = akk >= 0 ? -norm : norm;
    // v = x - alpha e_1, with v_1 stored implicitly as 1 after scaling.
    const v0 = akk - alpha;
    for (let i = k + 1; i < n; i++) QR[i * n + k] /= v0;
    tau[k] = (alpha - akk) / alpha; // = 2 / (vᵀv) after scaling v_1 = 1
    QR[k * n + k] = alpha; // this is R_kk

    if (Math.abs(alpha) < minDiag) minDiag = Math.abs(alpha);
    if (Math.abs(alpha) <= singularTolerance * aMax) singular = true;

    // --- apply H = I - tau v vᵀ to the remaining columns ------------------
    for (let j = k + 1; j < n; j++) {
      let dot = QR[k * n + j]; // v_1 = 1
      for (let i = k + 1; i < n; i++) dot += QR[i * n + k] * QR[i * n + j];
      dot *= tau[k];
      QR[k * n + j] -= dot;
      for (let i = k + 1; i < n; i++) QR[i * n + j] -= dot * QR[i * n + k];
    }
  }

  return { kind: "qr", n, QR, tau, singular, minDiag, growthFactor: NaN };
}

// ===========================================================================
// SECTION 2 — Solving with a factorization
// ===========================================================================

/**
 * Given a factorization from Section 1 and a right-hand side b, returns x.
 * Never modifies `fact` so it can be reused for refinement sweeps and for
 * multiple right-hand sides.
 */
export function solveWithFactorization(fact, b) {
  const { n } = fact;
  if (fact.kind === "lu") {
    const { LU, rowPerm, colPerm } = fact;
    // y = L⁻¹ P b   (forward substitution; L has unit diagonal)
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = b[rowPerm[i]];
      for (let j = 0; j < i; j++) s -= LU[i * n + j] * y[j];
      y[i] = s;
    }
    // z = U⁻¹ y   (back substitution)
    const z = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= LU[i * n + j] * z[j];
      z[i] = s / LU[i * n + i];
    }
    // x = Q z   (undo column permutation, if complete pivoting was used)
    if (!colPerm) return z;
    const x = new Float64Array(n);
    for (let j = 0; j < n; j++) x[colPerm[j]] = z[j];
    return x;
  }

  // QR path: x = R⁻¹ Qᵀ b
  const { QR, tau } = fact;
  const y = Float64Array.from(b);
  // Apply the Householder reflections in order: y ← H_k y for k = 0..n-1
  for (let k = 0; k < n; k++) {
    if (tau[k] === 0) continue;
    let dot = y[k];
    for (let i = k + 1; i < n; i++) dot += QR[i * n + k] * y[i];
    dot *= tau[k];
    y[k] -= dot;
    for (let i = k + 1; i < n; i++) y[i] -= dot * QR[i * n + k];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= QR[i * n + j] * x[j];
    x[i] = s / QR[i * n + i];
  }
  return x;
}

// ===========================================================================
// SECTION 3 — Diagnostics
// ===========================================================================

/**
 * Hager/Higham 1-norm condition estimate: ‖A‖₁ · ‖A⁻¹‖₁, where ‖A⁻¹‖₁ is
 * estimated with a handful of solves rather than forming the inverse
 * (O(n²) per iteration instead of O(n³)). This is what LAPACK's dgecon does.
 * It is a lower bound in theory but almost always within a factor of 3 of
 * the truth in practice, which is all we need to decide whether to warn.
 */
export function estimateCondition1(n, A, fact) {
  // ‖A‖₁ = max column sum
  let aNorm = 0;
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(A[i * n + j]);
    if (s > aNorm) aNorm = s;
  }

  // Need solves with Aᵀ as well. Rather than writing transposed triangular
  // solves for both LU and QR, we build a tiny helper that solves Aᵀ y = c
  // via the identity y = A⁻ᵀ c, obtained from the SAME factorization:
  //   LU:  A = Pᵀ L U Qᵀ  ⇒  Aᵀ = Q Uᵀ Lᵀ P  ⇒  solve Uᵀ, then Lᵀ.
  //   QR:  A = Q R        ⇒  Aᵀ = Rᵀ Qᵀ      ⇒  solve Rᵀ, then apply Q.
  const solveT = (c) => solveTransposeWithFactorization(fact, c);
  const solveA = (c) => solveWithFactorization(fact, c);

  // Hager's algorithm (Higham 1988 refinement, at most 5 iterations).
  let x = new Float64Array(n).fill(1 / n);
  let est = 0;
  let prevSign = null;
  for (let iter = 0; iter < 5; iter++) {
    const y = solveA(x); // y = A⁻¹ x
    let yNorm1 = 0;
    for (let i = 0; i < n; i++) yNorm1 += Math.abs(y[i]);
    if (!Number.isFinite(yNorm1)) return Infinity;
    if (yNorm1 <= est && iter > 0) break;
    est = yNorm1;
    // ξ = sign(y)
    const xi = new Float64Array(n);
    for (let i = 0; i < n; i++) xi[i] = y[i] >= 0 ? 1 : -1;
    if (prevSign && xi.every((v, i) => v === prevSign[i])) break;
    prevSign = xi;
    const z = solveT(xi); // z = A⁻ᵀ ξ
    let jMax = 0;
    let zMax = -1;
    let zx = 0;
    for (let i = 0; i < n; i++) {
      const az = Math.abs(z[i]);
      if (az > zMax) {
        zMax = az;
        jMax = i;
      }
      zx += z[i] * x[i];
    }
    if (zMax <= zx) break; // converged
    x = new Float64Array(n);
    x[jMax] = 1;
  }
  return aNorm * est;
}

/** Solves Aᵀ y = c using an existing factorization of A (see above). */
function solveTransposeWithFactorization(fact, c) {
  const { n } = fact;
  if (fact.kind === "lu") {
    const { LU, rowPerm, colPerm } = fact;
    // Aᵀ = Q Uᵀ Lᵀ P.  Step 1: w = Qᵀ c (undo column permutation on input).
    const w = new Float64Array(n);
    if (colPerm) for (let j = 0; j < n; j++) w[j] = c[colPerm[j]];
    else w.set(c);
    // Step 2: Uᵀ v = w (forward substitution on the transpose of U).
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = w[i];
      for (let j = 0; j < i; j++) s -= LU[j * n + i] * v[j];
      v[i] = s / LU[i * n + i];
    }
    // Step 3: Lᵀ t = v (back substitution; unit diagonal).
    const t = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = v[i];
      for (let j = i + 1; j < n; j++) s -= LU[j * n + i] * t[j];
      t[i] = s;
    }
    // Step 4: y = Pᵀ t (undo row permutation on output).
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[rowPerm[i]] = t[i];
    return y;
  }
  // QR: Aᵀ = Rᵀ Qᵀ ⇒ solve Rᵀ v = c, then y = Q v (apply reflections in
  // REVERSE order; each H_k is its own inverse).
  const { QR, tau } = fact;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = c[i];
    for (let j = 0; j < i; j++) s -= QR[j * n + i] * v[j];
    v[i] = s / QR[i * n + i];
  }
  for (let k = n - 1; k >= 0; k--) {
    if (tau[k] === 0) continue;
    let dot = v[k];
    for (let i = k + 1; i < n; i++) dot += QR[i * n + k] * v[i];
    dot *= tau[k];
    v[k] -= dot;
    for (let i = k + 1; i < n; i++) v[i] -= dot * QR[i * n + k];
  }
  return v;
}

/**
 * Componentwise (Oettli–Prager) backward error:
 *   ω = max_i |r_i| / (|A||x| + |b|)_i,   r = b - A x.
 * ω is the smallest relative perturbation of A and b (entry by entry) for
 * which x is the EXACT solution. If ω ≈ u (1e-16) the answer is as good as
 * the data; if ω ≈ 1 the answer is unrelated to the problem. This is the
 * "backward error" notion from the article made computable.
 */
export function backwardError(n, A, x, b) {
  const r = residualDoubleDouble(n, A, x, b);
  let omega = 0;
  for (let i = 0; i < n; i++) {
    let denom = Math.abs(b[i]);
    for (let j = 0; j < n; j++) denom += Math.abs(A[i * n + j] * x[j]);
    if (denom === 0) {
      if (r[i] !== 0) return Infinity;
      continue;
    }
    const w = Math.abs(r[i]) / denom;
    if (w > omega) omega = w;
  }
  return omega;
}

// ===========================================================================
// SECTION 4 — Iterative refinement
// ===========================================================================

/**
 * Wilkinson-style iterative refinement with an extra-precise residual:
 *   repeat:  r = b - A x   (double-double)
 *            solve A d = r (reuse the factorization)
 *            x ← x + d
 * Converges to the correctly rounded solution if the factorization's
 * backward error times cond(A) is comfortably below 1. If the corrections
 * STOP shrinking we know the factorization is bad and bail out — that signal
 * is fed back to `solve()` which escalates to a safer factorization.
 *
 * Returns { x, steps, converged, lastRatio }
 */
export function iterativeRefinement(n, A, b, fact, x0, opts) {
  let x = Float64Array.from(x0);
  let prevCorrection = Infinity;
  let converged = false;
  let steps = 0;
  let lastRatio = NaN;

  for (; steps < opts.maxRefinementSteps; steps++) {
    const r = residualDoubleDouble(n, A, x, b);
    const d = solveWithFactorization(fact, r);
    const dNorm = infNorm(d);
    const xNorm = infNorm(x);

    // Apply the correction.
    for (let i = 0; i < n; i++) x[i] += d[i];

    if (!Number.isFinite(dNorm)) {
      converged = false;
      break;
    }
    if (xNorm === 0 || dNorm <= opts.refinementTolerance * xNorm) {
      // Correction is at the rounding floor: done.
      converged = true;
      steps++;
      break;
    }
    lastRatio = dNorm / prevCorrection;
    if (steps > 0 && lastRatio > 0.5) {
      // Corrections aren't shrinking by at least 2x per sweep: the iteration
      // matrix has spectral radius near/above 1, i.e. the factorization is
      // too inaccurate to refine. Stop so the caller can escalate.
      converged = false;
      steps++;
      break;
    }
    prevCorrection = dNorm;
  }
  return { x, steps, converged, lastRatio };
}

// ===========================================================================
// SECTION 5 — The orchestrator
// ===========================================================================

/**
 * Scales A ← R A C with R, C diagonal matrices of powers of two so that each
 * row and column has max-abs entry in [0.5, 1]. Because the scale factors
 * are powers of two the scaling is EXACT in floating point. Returns the
 * scale vectors so the solve can map b and x back:
 *     A x = b   ⇔   (R A C)(C⁻¹ x) = R b.
 */
function equilibrate(n, A) {
  const rowScale = new Float64Array(n).fill(1);
  const colScale = new Float64Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = 0; j < n; j++) m = Math.max(m, Math.abs(A[i * n + j]));
    if (m > 0) rowScale[i] = 1 / powerOfTwoAtMost(m);
    for (let j = 0; j < n; j++) A[i * n + j] *= rowScale[i];
  }
  for (let j = 0; j < n; j++) {
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(A[i * n + j]));
    if (m > 0) colScale[j] = 1 / powerOfTwoAtMost(m);
    for (let i = 0; i < n; i++) A[i * n + j] *= colScale[j];
  }
  return { rowScale, colScale };
}

/**
 * solve(A, b, options?) → { x, info }
 *
 *   A : number[][] (n×n)            b : number[] (length n)
 *   x : number[]  the solution
 *   info : {
 *     method:            "lu-partial" | "lu-complete" | "qr"   (what finally worked)
 *     attempts:          [{ method, growthFactor, backwardError, refinementSteps, accepted }]
 *     growthFactor:      g(A) of the accepted LU factorization (NaN for QR)
 *     conditionEstimate: estimated κ₁(A)
 *     backwardError:     componentwise backward error ω of the returned x
 *     refinementSteps:   sweeps of iterative refinement used
 *     equilibrated:      whether row/column scaling was applied
 *     warnings:          string[] of plain-English concerns
 *     timeMs:            wall-clock time
 *   }
 *
 * Throws a RangeError if A is numerically singular under every strategy.
 */
export function solve(A, b, options = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings = [];
  const warn = (msg) => {
    warnings.push(msg);
    if (opts.verbose) console.warn(`[robustSolve] ${msg}`);
  };

  // --- 1. Normalize inputs ------------------------------------------------
  const { n, data: A0 } = toFlatMatrix(A);
  const b0 = toFlatVector(b, n);

  // --- 2. Optional exact power-of-two equilibration -----------------------
  // We solve the scaled system As y = bs where As = R·A·C, bs = R·b, y = C⁻¹x.
  const As = Float64Array.from(A0);
  let rowScale = null;
  let colScale = null;
  if (opts.equilibrate) {
    ({ rowScale, colScale } = equilibrate(n, As));
  }
  const bs = Float64Array.from(b0);
  if (rowScale) for (let i = 0; i < n; i++) bs[i] *= rowScale[i];

  // --- 3. Escalation ladder: partial LU → complete LU → QR -----------------
  // Each rung factors a FRESH copy of As (factorizations work in place).
  const ladder = [
    {
      method: "lu-partial",
      factor: () => luPartial(n, Float64Array.from(As), opts.singularTolerance),
      growthLimit: opts.partialGrowthFactor(n),
    },
    {
      method: "lu-complete",
      factor: () => luComplete(n, Float64Array.from(As), opts.singularTolerance),
      growthLimit: opts.completeGrowthFactor(n),
    },
    {
      method: "qr",
      factor: () => householderQR(n, Float64Array.from(As), opts.singularTolerance),
      growthLimit: Infinity,
    },
  ];

  const attempts = [];
  let accepted = null;

  for (const rung of ladder) {
    const fact = rung.factor();
    const attempt = {
      method: rung.method,
      growthFactor: fact.growthFactor,
      backwardError: NaN,
      refinementSteps: 0,
      accepted: false,
      reason: "",
    };
    attempts.push(attempt);

    if (fact.singular) {
      attempt.reason = "numerically singular";
      continue; // a safer factorization may still find a usable pivot ordering
    }

    // Growth-factor gate (the article's central idea): a big g(A) means
    // Theorem 1's error bound  |H| ≲ 2n·u·|L||U|  is useless, so don't even
    // bother solving — go straight to the next rung.
    if (fact.growthFactor > rung.growthLimit) {
      attempt.reason = `growth factor ${fact.growthFactor.toExponential(2)} exceeds limit ${rung.growthLimit.toExponential(2)}`;
      continue;
    }

    // Solve, then refine.
    const y0 = solveWithFactorization(fact, bs);
    const refined = iterativeRefinement(n, As, bs, fact, y0, opts);
    attempt.refinementSteps = refined.steps;

    // Judge the answer by its backward error, not by how it "looks".
    const omega = backwardError(n, As, refined.x, bs);
    attempt.backwardError = omega;

    if (Number.isFinite(omega) && omega <= opts.acceptableBackwardError) {
      attempt.accepted = true;
      attempt.reason = refined.converged ? "converged" : "acceptable backward error";
      accepted = { fact, y: refined.x, attempt };
      break;
    }
    attempt.reason = `backward error ${omega.toExponential(2)} too large after refinement`;
  }

  if (!accepted) {
    const allSingular = attempts.every((a) => a.reason === "numerically singular");
    if (allSingular) {
      throw new RangeError(
        "Matrix is numerically singular (no usable pivot under partial, complete, or QR). " +
          "The system has no unique solution in double precision."
      );
    }
    // Nothing met the backward-error bar. Return the best we have (lowest ω)
    // rather than throwing, but warn loudly. This matches the philosophy:
    // numpy would have silently returned garbage; we return it WITH a label.
    let best = null;
    for (const rung of ladder) {
      const a = attempts.find((x) => x.method === rung.method);
      if (!a || !Number.isFinite(a.backwardError)) continue;
      if (!best || a.backwardError < best.attempt.backwardError) {
        const fact = rung.factor();
        const y0 = solveWithFactorization(fact, bs);
        const refined = iterativeRefinement(n, As, bs, fact, y0, opts);
        best = { fact, y: refined.x, attempt: a };
      }
    }
    if (!best) {
      throw new RangeError("Could not compute a finite solution for this system.");
    }
    accepted = best;
    warn(
      `No factorization achieved backward error ≤ ${opts.acceptableBackwardError.toExponential(1)}; ` +
        `returning the best available (ω = ${accepted.attempt.backwardError.toExponential(2)}). Treat x with suspicion.`
    );
  }

  // --- 4. Map back through the equilibration: x = C y ---------------------
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = colScale ? accepted.y[i] * colScale[i] : accepted.y[i];

  // --- 5. Diagnostics on the ORIGINAL system -----------------------------
  const conditionEstimate = estimateCondition1(n, As, accepted.fact);
  const finalBackwardError = backwardError(n, A0, x, b0);

  // Explain the journey.
  for (const a of attempts) {
    if (!a.accepted && a.reason) {
      warn(`${a.method} rejected: ${a.reason}.`);
    }
  }
  if (accepted.attempt.method !== "lu-partial") {
    warn(
      `Used ${accepted.attempt.method} instead of plain partial pivoting. ` +
        `numpy.linalg.solve / MATLAB "\\" would have returned a wrong answer here without warning.`
    );
  }
  if (conditionEstimate * UNIT_ROUNDOFF > opts.conditionWarning) {
    const digits = Math.max(0, Math.floor(-Math.log10(conditionEstimate * UNIT_ROUNDOFF)));
    warn(
      `Ill-conditioned: κ₁(A) ≈ ${conditionEstimate.toExponential(2)}. ` +
        `Expect roughly ${digits} correct significant digit${digits === 1 ? "" : "s"} regardless of algorithm; ` +
        `the PROBLEM, not the solver, is the limit here.`
    );
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    x: Array.from(x),
    info: {
      method: accepted.attempt.method,
      attempts,
      growthFactor: accepted.fact.growthFactor,
      conditionEstimate,
      backwardError: finalBackwardError,
      refinementSteps: accepted.attempt.refinementSteps,
      equilibrated: Boolean(rowScale),
      warnings,
      timeMs: t1 - t0,
    },
  };
}

// ===========================================================================
// SECTION 6 — Reference solver (what numpy does)
// ===========================================================================

/**
 * naiveSolve(A, b) → number[]
 * Plain LU with partial pivoting, one triangular solve pair, no refinement,
 * no diagnostics, no warnings. Behaviorally equivalent to
 * numpy.linalg.solve / MATLAB backslash / Julia "\" on a dense matrix.
 * Included so tests can show exactly where the robust version earns its keep.
 */
export function naiveSolve(A, b) {
  const { n, data } = toFlatMatrix(A);
  const bv = toFlatVector(b, n);
  const fact = luPartial(n, data, 0); // tolerance 0 ⇒ only an exact zero pivot is "singular"
  if (fact.singular) throw new RangeError("Singular matrix");
  return Array.from(solveWithFactorization(fact, bv));
}

export default solve;
