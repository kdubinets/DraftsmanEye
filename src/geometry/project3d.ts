/**
 * Projects simple 3D solids into inspectable SVG-space line drawings.
 * The solids drill uses Y then X rotation so references can show enough of
 * the top face without manually authored image assets.
 */
import type { Point } from "./primitives";

export type Vec3 = { x: number; y: number; z: number };

export type SolidEdge = readonly [number, number];

export type SolidFace = {
  normal: Vec3;
  vertices: readonly number[];
};

export type SolidModel = {
  vertices: readonly Vec3[];
  edges: readonly SolidEdge[];
  faces: readonly SolidFace[];
};

export type ProjectedSolid = {
  points: Point[];
  visibleEdges: SolidEdge[];
  visibleFaces: ProjectedSolidFace[];
  visibleVertexIndices: number[];
};

export type ProjectedSolidFace = {
  vertices: readonly number[];
  points: Point[];
  normal: Vec3;
  depth: number;
};

export type ProjectionOptions = {
  width: number;
  height: number;
  rotationYRadians: number;
  rotationXRadians?: number;
  focalLength: number;
  cameraDistance: number;
  yOffset?: number;
  fitMargin?: number;
};

export const CUBE_SOLID: SolidModel = {
  vertices: [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: -1, y: 1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
  ],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
  faces: [
    { normal: { x: 0, y: 0, z: -1 }, vertices: [0, 1, 5, 4] },
    { normal: { x: 0, y: 0, z: 1 }, vertices: [3, 2, 6, 7] },
    { normal: { x: -1, y: 0, z: 0 }, vertices: [0, 3, 7, 4] },
    { normal: { x: 1, y: 0, z: 0 }, vertices: [1, 2, 6, 5] },
    { normal: { x: 0, y: 1, z: 0 }, vertices: [4, 5, 6, 7] },
    { normal: { x: 0, y: -1, z: 0 }, vertices: [0, 3, 2, 1] },
  ],
};

export function projectSolid(
  solid: SolidModel,
  options: ProjectionOptions,
): ProjectedSolid {
  const yOffset = options.yOffset ?? 0;
  const rotationXRadians = options.rotationXRadians ?? 0;
  const transformed = solid.vertices.map((vertex) => {
    const yRotated = rotateY(vertex, options.rotationYRadians);
    const xRotated = rotateX(yRotated, rotationXRadians);
    return { ...xRotated, y: xRotated.y + yOffset };
  });
  const points = transformed.map((vertex) =>
    perspectiveProject(vertex, options),
  );
  const rotatedNormals = solid.faces.map((face) =>
    rotateX(rotateY(face.normal, options.rotationYRadians), rotationXRadians),
  );
  const visibleFaces = solid.faces.map((face, index) => {
    const center = faceCenter(face.vertices.map((vertexIndex) => transformed[vertexIndex]));
    const toCamera = {
      x: -center.x,
      y: -center.y,
      z: -options.cameraDistance - center.z,
    };
    return dot(rotatedNormals[index], toCamera) > 0;
  });

  const visibleEdges = solid.edges.filter((edge) =>
    solid.faces.some(
      (face, faceIndex) =>
        visibleFaces[faceIndex] && faceContainsEdge(face.vertices, edge),
    ),
  );
  const visibleVertexIndices = Array.from(
    new Set(visibleEdges.flatMap(([a, b]) => [a, b])),
  ).sort((a, b) => a - b);

  const fittedPoints =
    options.fitMargin === undefined
      ? points
      : fitPointsToViewport(points, visibleVertexIndices, options);
  const visibleProjectedFaces = solid.faces
    .flatMap((face, index) => {
      if (!visibleFaces[index]) return [];
      const transformedFaceVertices = face.vertices.map(
        (vertexIndex) => transformed[vertexIndex],
      );
      return [
        {
          vertices: face.vertices,
          points: face.vertices.map((vertexIndex) => fittedPoints[vertexIndex]),
          normal: rotatedNormals[index],
          depth: faceCenter(transformedFaceVertices).z,
        },
      ];
    })
    .sort((a, b) => a.depth - b.depth);

  return {
    points: fittedPoints,
    visibleEdges,
    visibleFaces: visibleProjectedFaces,
    visibleVertexIndices,
  };
}

export function rotateY(vertex: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: vertex.x * c + vertex.z * s,
    y: vertex.y,
    z: -vertex.x * s + vertex.z * c,
  };
}

export function rotateX(vertex: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: vertex.x,
    y: vertex.y * c - vertex.z * s,
    z: vertex.y * s + vertex.z * c,
  };
}

function perspectiveProject(vertex: Vec3, options: ProjectionOptions): Point {
  const dz = vertex.z + options.cameraDistance;
  const cx = options.width / 2;
  const cy = options.height / 2;
  return {
    x: cx + (options.focalLength * vertex.x) / dz,
    y: cy - (options.focalLength * vertex.y) / dz,
  };
}

function faceCenter(vertices: Vec3[]): Vec3 {
  const sum = vertices.reduce(
    (acc, vertex) => ({
      x: acc.x + vertex.x,
      y: acc.y + vertex.y,
      z: acc.z + vertex.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  return {
    x: sum.x / vertices.length,
    y: sum.y / vertices.length,
    z: sum.z / vertices.length,
  };
}

function faceContainsEdge(
  faceVertices: readonly number[],
  [edgeA, edgeB]: SolidEdge,
): boolean {
  return faceVertices.some((vertex, index) => {
    const next = faceVertices[(index + 1) % faceVertices.length];
    return (
      (vertex === edgeA && next === edgeB) ||
      (vertex === edgeB && next === edgeA)
    );
  });
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function fitPointsToViewport(
  points: Point[],
  visibleVertexIndices: number[],
  options: ProjectionOptions,
): Point[] {
  if (visibleVertexIndices.length === 0) return points;
  const margin = options.fitMargin ?? 0;
  const visiblePoints = visibleVertexIndices.map((index) => points[index]);
  const box = bounds(visiblePoints);
  const scale = Math.min(
    (options.width - margin * 2) / Math.max(box.width, 1),
    (options.height - margin * 2) / Math.max(box.height, 1),
  );
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return points.map((point) => ({
    x: options.width / 2 + (point.x - cx) * scale,
    y: options.height / 2 + (point.y - cy) * scale,
  }));
}

function bounds(points: Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}
