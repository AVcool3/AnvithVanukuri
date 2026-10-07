/**
 * RobustSolveDemo.jsx
 * ===================
 * A drop-in React component that lets a user type (or generate) a matrix and
 * right-hand side, then shows side by side:
 *   • the numpy-style answer from `naiveSolve`
 *   • the answer from `solve` plus every diagnostic it produced
 *
 * Usage (Vite / CRA / Next, no extra dependencies):
 *   import RobustSolveDemo from "./robust-solve/RobustSolveDemo.jsx";
 *   <RobustSolveDemo />
 *
 * Styling is inline so it works anywhere; swap the `styles` object for your
 * CSS modules / Tailwind classes if you prefer.
 */
import { useMemo, useState } from "react";
import { solve, naiveSolve } from "./robustSolve.js";

// ---------------------------------------------------------------------------
// Preset matrices — each entry is a function of n so the size slider works.
// Add your own preset by appending to this object; the dropdown is generated
// from its keys automatically.
// ---------------------------------------------------------------------------
const PRESETS = {
  "Wilkinson (breaks numpy)": (n) =>
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i > j ? -1 : i === j || j === n - 1 ? 1 : 0))
    ),
  "Random Gaussian": (n) =>
    Array.from({ length: n }, () =>
      Array.from({ length: n }, () => {
        const u = Math.max(Math.random(), 1e-12);
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
      })
    ),
  "Hilbert (ill-conditioned)": (n) =>
    Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => 1 / (i + j + 1))),
  Identity: (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
};

/** Parses "1 2 3\n4 5 6\n7 8 9" into number[][]. Returns null on bad input. */
function parseMatrix(text) {
  const rows = text
    .trim()
    .split(/\n+/)
    .map((line) => line.trim().split(/[\s,]+/).map(Number));
  if (rows.length === 0 || rows.some((r) => r.length !== rows.length || r.some(Number.isNaN))) return null;
  return rows;
}
function parseVector(text) {
  const v = text.trim().split(/[\s,]+/).map(Number);
  return v.some(Number.isNaN) ? null : v;
}
const fmt = (v, digits = 3) =>
  v === undefined || v === null || Number.isNaN(v) ? "—" : Math.abs(v) < 1e-3 || Math.abs(v) >= 1e4 ? v.toExponential(digits) : v.toFixed(digits);

export default function RobustSolveDemo() {
  // --- state ---------------------------------------------------------------
  const [presetName, setPresetName] = useState("Wilkinson (breaks numpy)");
  const [n, setN] = useState(60);
  // The "true" x is generated so we can report forward error; b = A·xTrue.
  const [seedTick, setSeedTick] = useState(0); // bump to regenerate randoms
  const [matrixText, setMatrixText] = useState("");
  const [vectorText, setVectorText] = useState("");
  const [useText, setUseText] = useState(false); // typed input vs preset

  // --- build the system ----------------------------------------------------
  const system = useMemo(() => {
    if (useText) {
      const A = parseMatrix(matrixText);
      const b = parseVector(vectorText);
      if (!A || !b || b.length !== A.length) return { error: "Matrix must be square and b must match its size." };
      return { A, b, xTrue: null };
    }
    const A = PRESETS[presetName](n);
    const xTrue = Array.from({ length: n }, () => Math.random() * 2 - 1);
    const b = A.map((row) => row.reduce((s, a, j) => s + a * xTrue[j], 0));
    return { A, b, xTrue };
    // seedTick is intentionally in deps so "Regenerate" makes a new random x.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetName, n, seedTick, useText, matrixText, vectorText]);

  // --- run both solvers ----------------------------------------------------
  const results = useMemo(() => {
    if (system.error) return null;
    const { A, b, xTrue } = system;
    const out = {};
    try {
      const t = performance.now();
      out.naive = { x: naiveSolve(A, b), ms: performance.now() - t };
    } catch (e) {
      out.naive = { error: e.message };
    }
    try {
      out.robust = solve(A, b);
    } catch (e) {
      out.robust = { error: e.message };
    }
    const relErr = (x) => {
      if (!xTrue || !x) return null;
      let num = 0;
      let den = 0;
      for (let i = 0; i < x.length; i++) {
        num = Math.max(num, Math.abs(x[i] - xTrue[i]));
        den = Math.max(den, Math.abs(xTrue[i]));
      }
      return num / den;
    };
    out.naiveErr = relErr(out.naive.x);
    out.robustErr = relErr(out.robust.x);
    return out;
  }, [system]);

  // --- render --------------------------------------------------------------
  return (
    <div style={styles.wrap}>
      <h2 style={styles.h2}>Robust linear solver vs. numpy-style solver</h2>
      <p style={styles.p}>
        Solves <code>A x = b</code> two ways. The naive path is plain LU with partial pivoting (what{" "}
        <code>numpy.linalg.solve</code> does). The robust path measures the growth factor, escalates to complete
        pivoting or QR when needed, and polishes with iterative refinement.
      </p>

      {/* ---------------- controls ---------------- */}
      <div style={styles.controls}>
        <label style={styles.label}>
          <input type="checkbox" checked={useText} onChange={(e) => setUseText(e.target.checked)} /> Type my own matrix
        </label>
        {!useText && (
          <>
            <label style={styles.label}>
              Preset{" "}
              <select value={presetName} onChange={(e) => setPresetName(e.target.value)}>
                {Object.keys(PRESETS).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              n = {n}{" "}
              <input type="range" min={2} max={200} value={n} onChange={(e) => setN(Number(e.target.value))} />
            </label>
            <button style={styles.button} onClick={() => setSeedTick((t) => t + 1)}>
              Regenerate x
            </button>
          </>
        )}
      </div>

      {useText && (
        <div style={styles.textInputs}>
          <textarea
            style={styles.textarea}
            rows={6}
            placeholder={"Matrix rows, e.g.\n2 1 0\n1 3 1\n0 1 4"}
            value={matrixText}
            onChange={(e) => setMatrixText(e.target.value)}
          />
          <textarea
            style={styles.textarea}
            rows={6}
            placeholder={"b, e.g.\n1 2 3"}
            value={vectorText}
            onChange={(e) => setVectorText(e.target.value)}
          />
        </div>
      )}

      {system.error && <p style={styles.error}>{system.error}</p>}

      {/* ---------------- results ---------------- */}
      {results && (
        <div style={styles.grid}>
          <ResultCard
            title="naiveSolve (numpy-style)"
            error={results.naive.error}
            rows={[
              ["Relative error vs true x", fmt(results.naiveErr)],
              ["Time", results.naive.ms !== undefined ? `${results.naive.ms.toFixed(2)} ms` : "—"],
              ["Warnings", "none — it never warns"],
            ]}
            x={results.naive.x}
          />
          <ResultCard
            title="solve (robust)"
            error={results.robust.error}
            rows={
              results.robust.info
                ? [
                    ["Relative error vs true x", fmt(results.robustErr)],
                    ["Method used", results.robust.info.method],
                    ["Growth factor (partial)", fmt(results.robust.info.attempts[0].growthFactor)],
                    ["Growth factor (accepted)", fmt(results.robust.info.growthFactor)],
                    ["Condition estimate κ₁", fmt(results.robust.info.conditionEstimate)],
                    ["Backward error ω", fmt(results.robust.info.backwardError)],
                    ["Refinement steps", String(results.robust.info.refinementSteps)],
                    ["Time", `${results.robust.info.timeMs.toFixed(2)} ms`],
                  ]
                : []
            }
            warnings={results.robust.info?.warnings}
            x={results.robust.x}
          />
        </div>
      )}
    </div>
  );
}

/** Small presentational card; extracted so the two columns stay identical. */
function ResultCard({ title, rows, warnings, x, error }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>{title}</h3>
      {error ? (
        <p style={styles.error}>{error}</p>
      ) : (
        <>
          <table style={styles.table}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={styles.td}>{k}</td>
                  <td style={{ ...styles.td, fontFamily: "monospace" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {warnings && warnings.length > 0 && (
            <ul style={styles.warnList}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {x && (
            <details>
              <summary>Show x (first 10)</summary>
              <code style={styles.code}>{x.slice(0, 10).map((v) => fmt(v, 6)).join(", ")}{x.length > 10 ? ", …" : ""}</code>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles. Replace with your own classes freely; nothing above depends
// on these beyond the keys being present.
// ---------------------------------------------------------------------------
const styles = {
  wrap: { maxWidth: 960, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" },
  h2: { margin: "0 0 8px" },
  h3: { margin: "0 0 8px", fontSize: 16 },
  p: { color: "#555", lineHeight: 1.5 },
  controls: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", margin: "16px 0" },
  label: { display: "inline-flex", gap: 6, alignItems: "center" },
  button: { padding: "6px 12px", cursor: "pointer" },
  textInputs: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 },
  textarea: { width: "100%", fontFamily: "monospace", padding: 8 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 },
  card: { border: "1px solid #ddd", borderRadius: 8, padding: 12, background: "#fafafa" },
  table: { borderCollapse: "collapse", width: "100%" },
  td: { padding: "4px 6px", borderBottom: "1px solid #eee", fontSize: 14 },
  warnList: { margin: "8px 0", paddingLeft: 18, color: "#9a3412", fontSize: 13 },
  code: { display: "block", marginTop: 6, fontSize: 12, wordBreak: "break-all" },
  error: { color: "#b91c1c" },
};
