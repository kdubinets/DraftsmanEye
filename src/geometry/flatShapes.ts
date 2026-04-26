/**
 * Generates flat polygon reference graphs for vertex-edge copy drills.
 * Shapes are intentionally irregular but kept convex and legible.
 */
import { randomRange } from "./primitives";
import type { Point } from "./primitives";
import type { SolidEdge } from "./project3d";
import type { SolidReferenceGraph } from "../scoring/solids";

export type FlatShapeKind =
  | "triangle"
  | "quadrilateral"
  | "pentagon"
  | "hexagon";

export type FlatShapeReference = {
  reference: SolidReferenceGraph;
  projection: {
    points: Point[];
    visibleEdges: SolidEdge[];
    visibleFaces: [];
    visibleVertexIndices: number[];
  };
};

const REFERENCE_MARGIN = 28;
const CANVAS_MARGIN = 90;

export function createFlatShapeReference(
  kind: FlatShapeKind,
  referenceSize: { width: number; height: number },
  canvasSize: { width: number; height: number },
): FlatShapeReference {
  const unitPoints = createPolygonPoints(kind);
  const edges = unitPoints.map((_, index) => [
    index,
    (index + 1) % unitPoints.length,
  ]) as SolidEdge[];
  const referencePoints = fitPoints(unitPoints, referenceSize, REFERENCE_MARGIN);
  const scoringPoints = fitPoints(unitPoints, canvasSize, CANVAS_MARGIN);
  const visibleVertexIndices = unitPoints.map((_, index) => index);

  return {
    projection: {
      points: referencePoints,
      visibleEdges: edges,
      visibleFaces: [],
      visibleVertexIndices,
    },
    reference: {
      vertices: scoringPoints.map((point, index) => ({ index, point })),
      edges,
    },
  };
}

function createPolygonPoints(kind: FlatShapeKind): Point[] {
  if (kind === "triangle") return createTrianglePoints();
  if (kind === "quadrilateral") return createQuadrilateralPoints();
  return createIrregularPolygonPoints(kind === "pentagon" ? 5 : 6);
}

function createTrianglePoints(): Point[] {
  const angles = [
    randomRange(-Math.PI * 0.92, -Math.PI * 0.72),
    randomRange(-Math.PI * 0.2, Math.PI * 0.08),
    randomRange(Math.PI * 0.48, Math.PI * 0.78),
  ];
  return angles.map((angle) => {
    const radius = randomRange(0.78, 1.08);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

function createQuadrilateralPoints(): Point[] {
  const points = [
    { angle: randomRange(-2.85, -2.35), radius: randomRange(0.72, 1.05) },
    { angle: randomRange(-1.05, -0.25), radius: randomRange(0.72, 1.08) },
    { angle: randomRange(0.25, 1.1), radius: randomRange(0.72, 1.08) },
    { angle: randomRange(2.25, 2.95), radius: randomRange(0.72, 1.05) },
  ].map(({ angle, radius }) => ({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }));

  return maybeMirror(points);
}

function createIrregularPolygonPoints(sides: 5 | 6): Point[] {
  const startAngle = randomRange(-Math.PI, Math.PI);
  const step = (Math.PI * 2) / sides;
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + index * step + randomRange(-step * 0.16, step * 0.16);
    const radius = randomRange(0.78, 1.08);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  return maybeMirror(points);
}

function fitPoints(
  points: Point[],
  size: { width: number; height: number },
  margin: number,
): Point[] {
  const box = bounds(points);
  const scale = Math.min(
    (size.width - margin * 2) / Math.max(box.width, 1),
    (size.height - margin * 2) / Math.max(box.height, 1),
  );
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return points.map((point) => ({
    x: size.width / 2 + (point.x - cx) * scale,
    y: size.height / 2 + (point.y - cy) * scale,
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

function maybeMirror(points: Point[]): Point[] {
  if (Math.random() < 0.5) return points;
  return points.map((point) => ({ x: -point.x, y: point.y }));
}
