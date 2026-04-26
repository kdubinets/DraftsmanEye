import { describe, expect, it } from "vitest";
import { createFlatShapeReference } from "./flatShapes";

describe("createFlatShapeReference", () => {
  it("creates a closed triangle graph", () => {
    const shape = createFlatShapeReference(
      "triangle",
      { width: 360, height: 260 },
      { width: 1000, height: 620 },
    );

    expect(shape.reference.vertices).toHaveLength(3);
    expect(shape.reference.edges).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
    expect(shape.projection.visibleVertexIndices).toEqual([0, 1, 2]);
    expect(shape.projection.visibleEdges).toHaveLength(3);
  });

  it("creates a closed four-sided graph", () => {
    const shape = createFlatShapeReference(
      "quadrilateral",
      { width: 360, height: 260 },
      { width: 1000, height: 620 },
    );

    expect(shape.reference.vertices).toHaveLength(4);
    expect(shape.reference.edges).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ]);
    expect(shape.projection.visibleVertexIndices).toEqual([0, 1, 2, 3]);
    expect(shape.projection.visibleEdges).toHaveLength(4);
  });

  it("creates closed five- and six-sided graphs", () => {
    for (const [kind, sides] of [
      ["pentagon", 5],
      ["hexagon", 6],
    ] as const) {
      const shape = createFlatShapeReference(
        kind,
        { width: 360, height: 260 },
        { width: 1000, height: 620 },
      );

      expect(shape.reference.vertices).toHaveLength(sides);
      expect(shape.reference.edges).toHaveLength(sides);
      expect(shape.reference.edges.at(-1)).toEqual([sides - 1, 0]);
      expect(shape.projection.visibleVertexIndices).toEqual(
        Array.from({ length: sides }, (_, index) => index),
      );
    }
  });
});
