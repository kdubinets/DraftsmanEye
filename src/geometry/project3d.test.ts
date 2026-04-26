import { describe, expect, it } from "vitest";
import {
  CUBE_SOLID,
  SQUARE_PYRAMID_SOLID,
  TRIANGULAR_PRISM_LYING_SOLID,
  TRIANGULAR_PRISM_STANDING_SOLID,
  TRIANGULAR_PYRAMID_SOLID,
  cuboidSolid,
  projectSolid,
} from "./project3d";

describe("projectSolid", () => {
  it("projects the cube as a visible 7-vertex, 9-edge two-point drawing", () => {
    const projected = projectSolid(CUBE_SOLID, {
      width: 1000,
      height: 620,
      rotationYRadians: (35 * Math.PI) / 180,
      focalLength: 260,
      cameraDistance: 5.2,
      yOffset: -1.25,
    });

    expect(projected.visibleVertexIndices).toHaveLength(7);
    expect(projected.visibleEdges).toHaveLength(9);
    expect(projected.visibleFaces.length).toBeGreaterThan(0);
    for (const face of projected.visibleFaces) {
      expect(face.points).toHaveLength(face.vertices.length);
    }
  });

  it("keeps vertical cube edges vertical in the two-point projection", () => {
    const projected = projectSolid(CUBE_SOLID, {
      width: 1000,
      height: 620,
      rotationYRadians: (-48 * Math.PI) / 180,
      focalLength: 260,
      cameraDistance: 5.2,
      yOffset: -1.25,
    });

    const verticalEdges = projected.visibleEdges.filter(
      ([a, b]) => Math.abs(a - b) === 4,
    );
    expect(verticalEdges.length).toBeGreaterThan(0);
    for (const [a, b] of verticalEdges) {
      expect(projected.points[a].x).toBeCloseTo(projected.points[b].x, 8);
    }
  });

  it("fits a tilted cube tightly into the requested viewport", () => {
    const projected = projectSolid(CUBE_SOLID, {
      width: 360,
      height: 260,
      rotationYRadians: (42 * Math.PI) / 180,
      rotationXRadians: (22 * Math.PI) / 180,
      focalLength: 125,
      cameraDistance: 5.2,
      fitMargin: 14,
    });
    const visible = projected.visibleVertexIndices.map(
      (index) => projected.points[index],
    );
    const minX = Math.min(...visible.map((point) => point.x));
    const maxX = Math.max(...visible.map((point) => point.x));
    const minY = Math.min(...visible.map((point) => point.y));
    const maxY = Math.max(...visible.map((point) => point.y));

    expect(projected.visibleVertexIndices).toHaveLength(7);
    expect(projected.visibleEdges).toHaveLength(9);
    expect(minX).toBeGreaterThanOrEqual(13.9);
    expect(maxX).toBeLessThanOrEqual(346.1);
    expect(minY).toBeGreaterThanOrEqual(13.9);
    expect(maxY).toBeLessThanOrEqual(246.1);
    expect(Math.min(maxX - minX, maxY - minY)).toBeGreaterThan(220);
  });

  it("projects each straight-edge solid with visible vertices and edges", () => {
    const solids = [
      cuboidSolid(2.8, 1.45, 1.45),
      TRIANGULAR_PRISM_LYING_SOLID,
      TRIANGULAR_PRISM_STANDING_SOLID,
      SQUARE_PYRAMID_SOLID,
      TRIANGULAR_PYRAMID_SOLID,
    ];

    for (const solid of solids) {
      const projected = projectSolid(solid, {
        width: 360,
        height: 260,
        rotationYRadians: (42 * Math.PI) / 180,
        rotationXRadians: (18 * Math.PI) / 180,
        focalLength: 125,
        cameraDistance: 5.2,
        fitMargin: 18,
      });

      expect(projected.visibleVertexIndices.length).toBeGreaterThanOrEqual(4);
      expect(projected.visibleEdges.length).toBeGreaterThanOrEqual(5);
      expect(projected.visibleFaces.length).toBeGreaterThan(0);
    }
  });

  it("supports rolled prism poses without losing the visible graph", () => {
    const projected = projectSolid(TRIANGULAR_PRISM_LYING_SOLID, {
      width: 360,
      height: 260,
      rotationYRadians: (54 * Math.PI) / 180,
      rotationXRadians: (-18 * Math.PI) / 180,
      rotationZRadians: (62 * Math.PI) / 180,
      focalLength: 125,
      cameraDistance: 5.2,
      fitMargin: 18,
    });

    expect(projected.visibleVertexIndices.length).toBeGreaterThanOrEqual(4);
    expect(projected.visibleEdges.length).toBeGreaterThanOrEqual(5);
    expect(projected.visibleFaces.length).toBeGreaterThan(0);
  });
});
