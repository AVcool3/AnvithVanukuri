# robust-solve

A "stronger `linalg.solve`" in plain JavaScript, built from the ideas in John
Urschel's *Numerical Stability in Gaussian Elimination* (AMS Notices, 2025).

`numpy.linalg.solve`, MATLAB's `\`, and Julia's `\` all run Gaussian
elimination with **partial pivoting** and return whatever comes out. On most
matrices that is fast and accurate. On a small set of matrices (the Wilkinson
matrix is the famous one) the **growth factor** explodes to 2^(n-1), the
answer is pure noise, and no warning is raised. This module closes that gap.

## What `solve` does that numpy doesn't

| Stage | Why it matters |
| --- | --- |
| Exact power-of-two row/column scaling | Fixes badly scaled systems with zero rounding cost |
| Partial-pivot LU **with growth-factor tracking** | Theorem 1 of the article: backward error ∝ n·u·g(A). A huge g(A) means the factorization is garbage even if cond(A) is small |
| Escalate to **complete pivoting** when g(A) is suspicious | Wilkinson's bound guarantees tiny growth; costs ~2x comparisons but only runs when needed |
| Escalate to **Householder QR** as a last resort | Orthogonal transforms don't amplify error, so it is stable for every matrix |
| **Iterative refinement** with a double-double residual | Polishes the solution to the rounding floor whenever the factorization is "good enough" |
| **Backward error** check (Oettli–Prager ω) | Judges the answer by a provable quantity, not by how it looks |
| Hager/Higham **condition estimate** | Warns when the *problem* can't be solved accurately by any algorithm |

Everything is reported in `info`, so you always know *why* you got the number you got.

## Quick start

```js
import { solve } from "./robust-solve/robustSolve.js";

const A = [
  [2, 1, 0],
  [1, 3, 1],
  [0, 1, 4],
];
const b = [1, 2, 3];

const { x, info } = solve(A, b);
console.log(x);            // [0.3..., 0.3..., 0.6...]
console.log(info.method);  // "lu-partial"  (or "lu-complete" / "qr" if it had to escalate)
console.log(info.warnings) // []  (plain-English list when something is off)
```

`info` fields:

- `method` — which factorization produced the answer
- `attempts` — every rung tried, with its growth factor, backward error, and why it was rejected
- `growthFactor`, `conditionEstimate`, `backwardError`, `refinementSteps`, `equilibrated`, `timeMs`
- `warnings` — human-readable concerns (ill-conditioning, escalation, etc.)

Throws `RangeError` if the matrix is numerically singular under every strategy.

## Tuning

Pass an options object as the third argument. All defaults live in
`DEFAULT_OPTIONS` at the top of `robustSolve.js`, each with a `TUNE:` comment:

```js
solve(A, b, {
  partialGrowthFactor: (n) => 8 * Math.sqrt(n),  // be stricter about escalating
  maxRefinementSteps: 10,
  equilibrate: false,
  verbose: true,                                 // also console.warn the warnings
});
```

## Using it in React

`RobustSolveDemo.jsx` is a self-contained component (presets, size slider,
free-text matrix entry) that shows the naive and robust answers side by side.

```jsx
import RobustSolveDemo from "./robust-solve/RobustSolveDemo.jsx";

export default function App() {
  return <RobustSolveDemo />;
}
```

For your own component, just import `solve` and call it inside a `useMemo`
keyed on the inputs; it is synchronous and pure.

## Tests

```
cd robust-solve
node test.js
```

The suite reproduces the article's demo (Wilkinson, n = 100: naive error ≈ 1,
robust error ≈ 1e-16), then checks random matrices, Hilbert matrices,
badly scaled systems, singular input, the QR fallback, and timing.

## Lower-level exports

If you want to build your own pipeline:

- `luPartial(n, flatA)`, `luComplete(n, flatA)`, `householderQR(n, flatA)` — factor a row-major `Float64Array` in place
- `solveWithFactorization(fact, b)` — reuse a factorization for many right-hand sides
- `iterativeRefinement(n, A, b, fact, x0, opts)`
- `backwardError(n, A, x, b)`, `estimateCondition1(n, A, fact)`
- `naiveSolve(A, b)` — the numpy-equivalent reference, for comparisons

## Limits

- Dense, square, real matrices only. No sparse or complex support.
- Pure JavaScript, so it is fine up to a few thousand unknowns; beyond that use WebAssembly BLAS or a server.
- Complete pivoting is O(n³) extra comparisons; it is only used when partial pivoting's growth factor trips the threshold.
