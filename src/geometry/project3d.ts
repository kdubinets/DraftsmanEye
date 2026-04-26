/**
 * Projects simple 3D solids into inspectable SVG-space line drawings.
 * The solids drill uses controlled model rotations so references can show
 * enough form information without manually authored image assets.
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
  rotationZRadians?: number;
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

export function cuboidSolid(
  width: number,
  height: number,
  depth: number,
): SolidModel {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  return {
    vertices: [
      { x: -x, y: -y, z: -z },
      { x, y: -y, z: -z },
      { x, y: -y, z },
      { x: -x, y: -y, z },
      { x: -x, y, z: -z },
      { x, y, z: -z },
      { x, y, z },
      { x: -x, y, z },
    ],
    edges: CUBE_SOLID.edges,
    faces: CUBE_SOLID.faces,
  };
}

export const TRIANGULAR_PRISM_LYING_SOLID: SolidModel =
  triangularPrismSolid("lying");

export const TRIANGULAR_PRISM_STANDING_SOLID: SolidModel =
  triangularPrismSolid("standing");

export const SQUARE_PYRAMID_SOLID: SolidModel = (() => {
  const vertices = [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: 0, y: 1.15, z: 0 },
  ];
  return {
    vertices,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
    ],
    faces: [
      faceWithHint(vertices, [0, 3, 2, 1], { x: 0, y: -1, z: 0 }),
      faceWithHint(vertices, [0, 1, 4], { x: 0, y: 0, z: -1 }),
      faceWithHint(vertices, [1, 2, 4], { x: 1, y: 0, z: 0 }),
      faceWithHint(vertices, [2, 3, 4], { x: 0, y: 0, z: 1 }),
      faceWithHint(vertices, [3, 0, 4], { x: -1, y: 0, z: 0 }),
    ],
  };
})();

export const TRIANGULAR_PYRAMID_SOLID: SolidModel = (() => {
  const vertices = [
    { x: -1.05, y: -0.78, z: -0.72 },
    { x: 1.05, y: -0.78, z: -0.72 },
    { x: 0, y: -0.78, z: 1.08 },
    { x: 0, y: 1.08, z: 0 },
  ];
  return {
    vertices,
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [0, 3],
      [1, 3],
      [2, 3],
    ],
    faces: [
      faceWithHint(vertices, [0, 2, 1], { x: 0, y: -1, z: 0 }),
      faceWithHint(vertices, [0, 1, 3], { x: 0, y: 0.35, z: -1 }),
      faceWithHint(vertices, [1, 2, 3], { x: 1, y: 0.35, z: 0.5 }),
      faceWithHint(vertices, [2, 0, 3], { x: -1, y: 0.35, z: 0.5 }),
    ],
  };
})();

export function projectSolid(
  solid: SolidModel,
  options: ProjectionOptions,
): ProjectedSolid {
  const yOffset = options.yOffset ?? 0;
  const rotationXRadians = options.rotationXRadians ?? 0;
  const rotationZRadians = options.rotationZRadians ?? 0;
  const transformed = solid.vertices.map((vertex) => {
    const zRotated = rotateZ(vertex, rotationZRadians);
    const yRotated = rotateY(zRotated, options.rotationYRadians);
    const xRotated = rotateX(yRotated, rotationXRadians);
    return { ...xRotated, y: xRotated.y + yOffset };
  });
  const points = transformed.map((vertex) =>
    perspectiveProject(vertex, options),
  );
  const rotatedNormals = solid.faces.map((face) =>
    rotateX(
      rotateY(rotateZ(face.normal, rotationZRadians), options.rotationYRadians),
      rotationXRadians,
    ),
  );
  const visibleFaces = solid.faces.map((face, index) => {
    const center = faceCenter(
      face.vertices.map((vertexIndex) => transformed[vertexIndex]),
    );
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

export function rotateZ(vertex: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: vertex.x * c - vertex.y * s,
    y: vertex.x * s + vertex.y * c,
    z: vertex.z,
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

function triangularPrismSolid(orientation: "lying" | "standing"): SolidModel {
  const vertices =
    orientation === "lying"
      ? [
          { x: -1, y: -0.78, z: -1.45 },
          { x: 1, y: -0.78, z: -1.45 },
          { x: 0, y: 0.98, z: -1.45 },
          { x: -1, y: -0.78, z: 1.45 },
          { x: 1, y: -0.78, z: 1.45 },
          { x: 0, y: 0.98, z: 1.45 },
        ]
      : [
          { x: -1, y: -1.45, z: -0.78 },
          { x: 1, y: -1.45, z: -0.78 },
          { x: 0, y: -1.45, z: 0.98 },
          { x: -1, y: 1.45, z: -0.78 },
          { x: 1, y: 1.45, z: -0.78 },
          { x: 0, y: 1.45, z: 0.98 },
        ];
  const capHints =
    orientation === "lying"
      ? [
          { x: 0, y: 0, z: -1 },
          { x: 0, y: 0, z: 1 },
        ]
      : [
          { x: 0, y: -1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ];

  return {
    vertices,
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
      [0, 3],
      [1, 4],
      [2, 5],
    ],
    faces: [
      faceWithHint(vertices, [0, 2, 1], capHints[0]),
      faceWithHint(vertices, [3, 4, 5], capHints[1]),
      faceWithHint(vertices, [0, 3, 4, 1], { x: 0, y: -1, z: -0.1 }),
      faceWithHint(vertices, [1, 4, 5, 2], { x: 1, y: 0.5, z: 0 }),
      faceWithHint(vertices, [2, 5, 3, 0], { x: -1, y: 0.5, z: 0 }),
    ],
  };
}

function faceWithHint(
  vertices: readonly Vec3[],
  faceVertices: readonly number[],
  outwardHint: Vec3,
): SolidFace {
  const normal = faceNormal(faceVertices.map((index) => vertices[index]));
  return {
    vertices: faceVertices,
    normal: dot(normal, outwardHint) >= 0 ? normal : scaleVector(normal, -1),
  };
}

function faceNormal(vertices: readonly Vec3[]): Vec3 {
  if (vertices.length < 3) return { x: 0, y: 0, z: 1 };
  const a = vertices[0];
  const b = vertices[1];
  const c = vertices[2];
  return normalizeVector({
    x: (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
    y: (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z),
    z: (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
  });
}

function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) return { x: 0, y: 0, z: 1 };
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function scaleVector(vector: Vec3, scale: number): Vec3 {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  };
}
