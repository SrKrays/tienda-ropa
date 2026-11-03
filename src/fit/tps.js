// Thin Plate Spline: deforma el plano de forma suave para que cada punto de origen
// caiga exactamente sobre su punto de destino (como estirar una tela clavada con alfileres).

const U = (r2) => (r2 === 0 ? 0 : r2 * Math.log(r2))

function solve(A, b) {
  // eliminación gaussiana con pivoteo parcial (sistemas chicos: ~20 x 20)
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    const d = M[c][c] || 1e-12
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / d
      if (!f) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = s / (M[r][r] || 1e-12)
  }
  return x
}

// src, dst: [[x, y], ...]  → función (x, y) => [x', y']
export function makeTPS(src, dst, smoothing = 0) {
  const n = src.length
  // normalizamos para estabilidad numérica
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of src) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  const s = Math.max(maxX - minX, maxY - minY) || 1
  const P = src.map(([x, y]) => [(x - minX) / s, (y - minY) / s])
  const size = n + 3
  const A = Array.from({ length: size }, () => new Array(size).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = P[i][0] - P[j][0]
      const dy = P[i][1] - P[j][1]
      A[i][j] = U(dx * dx + dy * dy) + (i === j ? smoothing : 0)
    }
    A[i][n] = 1; A[i][n + 1] = P[i][0]; A[i][n + 2] = P[i][1]
    A[n][i] = 1; A[n + 1][i] = P[i][0]; A[n + 2][i] = P[i][1]
  }
  const bx = [...dst.map((d) => d[0]), 0, 0, 0]
  const by = [...dst.map((d) => d[1]), 0, 0, 0]
  const wx = solve(A, bx)
  const wy = solve(A, by)
  return (x, y) => {
    const px = (x - minX) / s
    const py = (y - minY) / s
    let ox = wx[n] + wx[n + 1] * px + wx[n + 2] * py
    let oy = wy[n] + wy[n + 1] * px + wy[n + 2] * py
    for (let i = 0; i < n; i++) {
      const dx = px - P[i][0]
      const dy = py - P[i][1]
      const u = U(dx * dx + dy * dy)
      ox += wx[i] * u
      oy += wy[i] * u
    }
    return [ox, oy]
  }
}
