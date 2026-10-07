/**
 * test.js — run with:  node test.js
 *
 * No test framework needed. Each `check()` prints PASS/FAIL and the script
 * exits non-zero if anything fails, so it works in CI too.
 *
 * The headline test is the Wilkinson matrix from equation (4) of Urschel's
 * article: condition number ~45 (benign) but growth factor 2^(n-1) under
 * partial pivoting. numpy / MATLAB / plain LU return a solution with relative
 * error > 1 — zero is a better guess. robustSolve detects the blow-up from the
 * growth factor alone, switches to complete pivoting, and lands at ~1e-16.
 */
import { solve, naiveSolve, luPartial, luComplete, householderQR, solveWithFactorization } from "./robustSolve.js";

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
let failures = 0;
function check(name, ok, detail = "") {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`  [${tag}] ${name}${detail ? "  —  " + detail : ""}`);
}
function relErr(x, xTrue) {
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    num = Math.max(num, Math.abs(x[i] - xTrue[i]));
    den = Math.max(den, Math.abs(xTrue[i]));
  }
  return num / den;
}
function matVec(A, x) {
  return A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));
}
/** Deterministic pseudo-random normals so runs are reproducible. */
let seed = 12345;
function rand() {
  // xorshift32
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) % 1_000_000) / 1_000_000;
}
function randn() {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const fmt = (v) => (Number.isFinite(v) ? v.toExponential(2) : String(v));

// ---------------------------------------------------------------------------
// Matrix generators
// ---------------------------------------------------------------------------
/** Wilkinson's matrix: 1 on diagonal and last column, -1 below diagonal. */
function wilkinson(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i > j ? -1 : i === j || j === n - 1 ? 1 : 0))
  );
}
function gaussian(n) {
  return Array.from({ length: n }, () => Array.from({ length: n }, randn));
}
function hilbert(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => 1 / (i + j + 1)));
}

// ===========================================================================
console.log("\n1. Wilkinson matrix, n = 100 (the article's demo)");
// ===========================================================================
{
  const n = 100;
  const A = wilkinson(n);
  const xTrue = Array.from({ length: n }, randn);
  const b = matVec(A, xTrue);

  const xNaive = naiveSolve(A, b);
  const { x, info } = solve(A, b);

  console.log(`     naive (numpy-style) relative error : ${fmt(relErr(xNaive, xTrue))}`);
  console.log(`     robustSolve relative error         : ${fmt(relErr(x, xTrue))}`);
  console.log(`     method used                        : ${info.method}`);
  console.log(`     growth factor (partial)            : ${fmt(info.attempts[0].growthFactor)}`);
  console.log(`     growth factor (accepted)           : ${fmt(info.growthFactor)}`);
  console.log(`     condition estimate                 : ${fmt(info.conditionEstimate)}`);
  console.log(`     backward error                     : ${fmt(info.backwardError)}`);
  info.warnings.forEach((w) => console.log(`     warning: ${w}`));

  check("naive solver is wrong (error > 0.1)", relErr(xNaive, xTrue) > 0.1);
  check("robust solver is right (error < 1e-12)", relErr(x, xTrue) < 1e-12, fmt(relErr(x, xTrue)));
  check("escalated to complete pivoting", info.method === "lu-complete");
  check("partial growth factor ≈ 2^99", info.attempts[0].growthFactor > 1e29);
  check("backward error at rounding level", info.backwardError < 1e-14);
}

// ===========================================================================
console.log("\n2. Random Gaussian matrix, n = 200 (the common case)");
// ===========================================================================
{
  const n = 200;
  const A = gaussian(n);
  const xTrue = Array.from({ length: n }, randn);
  const b = matVec(A, xTrue);
  const xNaive = naiveSolve(A, b);
  const { x, info } = solve(A, b);
  console.log(`     naive error ${fmt(relErr(xNaive, xTrue))}, robust error ${fmt(relErr(x, xTrue))}`);
  console.log(`     growth factor ${fmt(info.growthFactor)} (≈ sqrt(n) = ${Math.sqrt(n).toFixed(1)} expected)`);
  console.log(`     refinement steps ${info.refinementSteps}, time ${info.timeMs.toFixed(1)} ms`);
  check("stayed on fast path (lu-partial)", info.method === "lu-partial");
  check("growth factor is modest (< 4·sqrt(n))", info.growthFactor < 4 * Math.sqrt(n), fmt(info.growthFactor));
  check("robust error ≤ naive error", relErr(x, xTrue) <= relErr(xNaive, xTrue) * 1.0001);
  check("no warnings", info.warnings.length === 0);
}

// ===========================================================================
console.log("\n3. Hilbert matrix, n = 10 (ill-conditioned: the PROBLEM is hard)");
// ===========================================================================
{
  const n = 10;
  const A = hilbert(n);
  const xTrue = Array.from({ length: n }, () => 1);
  const b = matVec(A, xTrue);
  const { x, info } = solve(A, b);
  console.log(`     condition estimate ${fmt(info.conditionEstimate)} (true κ ≈ 1.6e13)`);
  console.log(`     forward error ${fmt(relErr(x, xTrue))}, backward error ${fmt(info.backwardError)}`);
  info.warnings.forEach((w) => console.log(`     warning: ${w}`));
  check("condition estimate within 10x of truth", info.conditionEstimate > 1.6e12 && info.conditionEstimate < 1.6e14);
  check("emits ill-conditioning warning", info.warnings.some((w) => w.includes("Ill-conditioned")));
  check("still backward stable (ω < 1e-12)", info.backwardError < 1e-12, fmt(info.backwardError));
}

// ===========================================================================
console.log("\n4. Badly scaled system (rows differ by 1e12) — equilibration");
// ===========================================================================
{
  const n = 50;
  const base = gaussian(n);
  const scales = base.map((_, i) => 10 ** ((i % 5) * 3)); // 1, 1e3, ..., 1e12
  const A = base.map((row, i) => row.map((v) => v * scales[i]));
  const xTrue = Array.from({ length: n }, randn);
  const b = matVec(A, xTrue);
  const withEq = solve(A, b);
  const withoutEq = solve(A, b, { equilibrate: false });
  console.log(`     error with equilibration ${fmt(relErr(withEq.x, xTrue))}, without ${fmt(relErr(withoutEq.x, xTrue))}`);
  check("accurate with equilibration", relErr(withEq.x, xTrue) < 1e-12, fmt(relErr(withEq.x, xTrue)));
  check("equilibrated flag set", withEq.info.equilibrated === true);
}

// ===========================================================================
console.log("\n5. Singular matrix — must throw, not return garbage");
// ===========================================================================
{
  const A = [
    [1, 2, 3],
    [2, 4, 6],
    [1, 0, 1],
  ];
  let threw = false;
  try {
    solve(A, [1, 2, 3]);
  } catch (e) {
    threw = e instanceof RangeError;
    console.log(`     threw: ${e.message}`);
  }
  check("throws RangeError on singular input", threw);
}

// ===========================================================================
console.log("\n6. Forcing the QR fallback (thresholds set to 0)");
// ===========================================================================
{
  const n = 60;
  const A = gaussian(n);
  const xTrue = Array.from({ length: n }, randn);
  const b = matVec(A, xTrue);
  const { x, info } = solve(A, b, { partialGrowthFactor: () => 0, completeGrowthFactor: () => 0 });
  console.log(`     method ${info.method}, error ${fmt(relErr(x, xTrue))}, attempts: ${info.attempts.map((a) => a.method + (a.accepted ? "✓" : "✗")).join(" → ")}`);
  check("fell through to QR", info.method === "qr");
  check("QR solution accurate", relErr(x, xTrue) < 1e-12, fmt(relErr(x, xTrue)));
}

// ===========================================================================
console.log("\n7. Factorization sanity: each path reproduces A x = b on a 5×5");
// ===========================================================================
{
  const n = 5;
  const A = gaussian(n);
  const xTrue = [1, -2, 3, -4, 5];
  const b = matVec(A, xTrue);
  const flat = Float64Array.from(A.flat());
  for (const [name, f] of [
    ["luPartial", luPartial],
    ["luComplete", luComplete],
    ["householderQR", householderQR],
  ]) {
    const fact = f(n, Float64Array.from(flat));
    const x = solveWithFactorization(fact, Float64Array.from(b));
    check(`${name} solves correctly`, relErr(x, xTrue) < 1e-12, fmt(relErr(x, xTrue)));
  }
}

// ===========================================================================
console.log("\n8. Timing, n = 400 (robust ≈ naive + refinement overhead)");
// ===========================================================================
{
  const n = 400;
  const A = gaussian(n);
  const b = Array.from({ length: n }, randn);
  let t = performance.now();
  naiveSolve(A, b);
  const naiveMs = performance.now() - t;
  t = performance.now();
  const { info } = solve(A, b);
  const robustMs = performance.now() - t;
  console.log(`     naive ${naiveMs.toFixed(1)} ms, robust ${robustMs.toFixed(1)} ms (${(robustMs / naiveMs).toFixed(2)}x), refinement steps ${info.refinementSteps}`);
  check("robust is < 6x naive on the happy path", robustMs < 6 * naiveMs + 5);
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
