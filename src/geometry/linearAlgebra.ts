/**
 * Gaussian elimination (partial-pivot) solvers used by circle and ellipse fitting.
 * Both solvers are identical in logic; the 3×3 variant avoids an index-array allocation
 * for the common circle-fit case.
 */

export function solveLinearSystem(
  coefficients: number[][],
  constants: number[],
): number[] | null {
  const n = constants.length;
  const m = coefficients.map((row, i) => [...row, constants[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivotRow][col])) {
        pivotRow = row;
      }
    }

    const pivot = m[pivotRow][col];
    if (Math.abs(pivot) < 1e-9) {
      return null;
    }

    [m[col], m[pivotRow]] = [m[pivotRow], m[col]];

    for (let entry = col; entry <= n; entry += 1) {
      m[col][entry] /= pivot;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let entry = col; entry <= n; entry += 1) {
        m[row][entry] -= factor * m[col][entry];
      }
    }
  }

  return m.map((row) => row[n]);
}

export function solveThreeByThree(
  coefficients: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ],
  constants: [number, number, number],
): [number, number, number] | null {
  const m = coefficients.map((row, i) => [...row, constants[i]]);

  for (let col = 0; col < 3; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivotRow][col])) {
        pivotRow = row;
      }
    }

    const pivot = m[pivotRow][col];
    if (Math.abs(pivot) < 1e-9) {
      return null;
    }

    [m[col], m[pivotRow]] = [m[pivotRow], m[col]];

    for (let entry = col; entry < 4; entry += 1) {
      m[col][entry] /= pivot;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let entry = col; entry < 4; entry += 1) {
        m[row][entry] -= factor * m[col][entry];
      }
    }
  }

  return [m[0][3], m[1][3], m[2][3]];
}
