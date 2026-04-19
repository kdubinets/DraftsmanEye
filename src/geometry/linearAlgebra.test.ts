import { describe, it, expect } from 'vitest';
import { solveLinearSystem, solveThreeByThree } from './linearAlgebra';

describe('solveLinearSystem', () => {
  it('solves a simple 2x2 system', () => {
    // x + y = 3, 2x - y = 0 → x=1, y=2
    const sol = solveLinearSystem([[1, 1], [2, -1]], [3, 0]);
    expect(sol).not.toBeNull();
    expect(sol![0]).toBeCloseTo(1, 10);
    expect(sol![1]).toBeCloseTo(2, 10);
  });

  it('solves a 3x3 system', () => {
    // x=1, y=2, z=3
    const sol = solveLinearSystem(
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      [1, 2, 3],
    );
    expect(sol).toEqual([1, 2, 3]);
  });

  it('returns null for a singular matrix', () => {
    const sol = solveLinearSystem([[1, 2], [2, 4]], [1, 2]);
    expect(sol).toBeNull();
  });

  it('cross-checks output with solveThreeByThree on same 3x3 input', () => {
    const C: [[number, number, number], [number, number, number], [number, number, number]] = [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ];
    const b: [number, number, number] = [8, -11, -3];
    const general = solveLinearSystem(C, b);
    const specific = solveThreeByThree(C, b);
    expect(general).not.toBeNull();
    expect(specific).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      expect(general![i]).toBeCloseTo(specific![i], 10);
    }
  });
});

describe('solveThreeByThree', () => {
  it('solves a known 3x3 system', () => {
    // 2x + y - z = 8, -3x - y + 2z = -11, -2x + y + 2z = -3 → x=2, y=3, z=-1
    const sol = solveThreeByThree(
      [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]],
      [8, -11, -3],
    );
    expect(sol).not.toBeNull();
    expect(sol![0]).toBeCloseTo(2, 10);
    expect(sol![1]).toBeCloseTo(3, 10);
    expect(sol![2]).toBeCloseTo(-1, 10);
  });

  it('returns null for a singular matrix', () => {
    const sol = solveThreeByThree(
      [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      [1, 2, 3],
    );
    expect(sol).toBeNull();
  });
});
