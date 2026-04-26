import { describe, expect, it } from "vitest";
import type { SolidReferenceGraph } from "./solids";
import { scoreSolidGraph, topologyWarning } from "./solids";

const reference: SolidReferenceGraph = {
  vertices: [
    { index: 10, point: { x: 0, y: 0 } },
    { index: 11, point: { x: 100, y: 0 } },
    { index: 12, point: { x: 120, y: 80 } },
    { index: 13, point: { x: 20, y: 80 } },
  ],
  edges: [
    [10, 11],
    [11, 12],
    [12, 13],
    [13, 10],
  ],
};

describe("scoreSolidGraph", () => {
  it("scores a scaled and translated matching graph as exact", () => {
    const vertices = reference.vertices.map((vertex, index) => ({
      id: index + 1,
      x: 300 + vertex.point.x * 2,
      y: 120 + vertex.point.y * 2,
    }));
    const idByReferenceIndex = new Map(
      reference.vertices.map((vertex, index) => [vertex.index, index + 1]),
    );
    const edges = reference.edges.map(([a, b], index) => ({
      id: 20 + index,
      v1: idByReferenceIndex.get(a) ?? -1,
      v2: idByReferenceIndex.get(b) ?? -1,
    }));

    const result = scoreSolidGraph(reference, vertices, edges);

    expect(result?.score).toBeCloseTo(100, 8);
    expect(result?.matchedEdges).toBe(reference.edges.length);
    expect(result?.edgeScores).toHaveLength(reference.edges.length);
    expect(result?.meanLengthRatioError).toBeCloseTo(0, 8);
    expect(result?.missingReferenceEdges).toHaveLength(0);
  });

  it("reports topology count mismatches before scoring", () => {
    const warning = topologyWarning(
      reference,
      [{ id: 1, x: 0, y: 0 }],
      [],
    );

    expect(warning).toEqual({
      expectedVertices: 4,
      actualVertices: 1,
      expectedEdges: 4,
      actualEdges: 0,
    });
  });
});
