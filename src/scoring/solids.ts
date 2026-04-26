/**
 * Scoring for vertex-edge solid drawings.
 * Vertex matching establishes correspondence; the primary score is then a
 * weighted per-edge comparison of angle and foreshortened length.
 */
import {
  clampNumber,
  distanceBetween,
  lineAngleDifferenceDegrees,
} from "../geometry/primitives";
import type { Point } from "../geometry/primitives";
import type { SolidEdge } from "../geometry/project3d";

export type SolidGraphVertex = Point & { id: number };

export type SolidGraphEdge = {
  id: number;
  v1: number;
  v2: number;
};

export type SolidReferenceGraph = {
  vertices: { index: number; point: Point }[];
  edges: SolidEdge[];
};

export type SolidEdgeScore = {
  referenceEdge: SolidEdge;
  userEdgeId: number;
  angleErrorDegrees: number;
  lengthRatioError: number;
  combinedErrorPercent: number;
};

export type SolidTopologyWarning = {
  expectedVertices: number;
  actualVertices: number;
  expectedEdges: number;
  actualEdges: number;
};

export type SolidScoreResult = {
  score: number;
  relativeErrorPercent: number;
  meanVertexErrorPixels: number;
  meanEdgeAngleErrorDegrees: number;
  meanLengthRatioError: number;
  worstEdgeErrorPercent: number;
  matchedEdges: number;
  expectedEdges: number;
  transformedReference: SolidReferenceGraph;
  vertexMatches: Map<number, number>;
  edgeScores: SolidEdgeScore[];
  missingReferenceEdges: SolidEdge[];
  extraUserEdgeIds: number[];
};

export function topologyWarning(
  reference: SolidReferenceGraph,
  vertices: SolidGraphVertex[],
  edges: SolidGraphEdge[],
): SolidTopologyWarning | null {
  if (
    reference.vertices.length === vertices.length &&
    reference.edges.length === edges.length
  ) {
    return null;
  }
  return {
    expectedVertices: reference.vertices.length,
    actualVertices: vertices.length,
    expectedEdges: reference.edges.length,
    actualEdges: edges.length,
  };
}

export function scoreSolidGraph(
  reference: SolidReferenceGraph,
  vertices: SolidGraphVertex[],
  edges: SolidGraphEdge[],
): SolidScoreResult | null {
  if (
    reference.vertices.length === 0 ||
    vertices.length !== reference.vertices.length
  ) {
    return null;
  }

  const transformedReference = alignReferenceToUserGraph(reference, vertices);
  const match = matchVertices(transformedReference.vertices, vertices);
  if (!match) return null;

  const vertexErrors = transformedReference.vertices.map((referenceVertex) => {
    const userId = match.get(referenceVertex.index);
    const userVertex = userId === undefined ? null : vertexById(vertices, userId);
    return userVertex ? distanceBetween(referenceVertex.point, userVertex) : 0;
  });
  const meanVertexErrorPixels =
    vertexErrors.reduce((sum, error) => sum + error, 0) / vertexErrors.length;

  const graphScale = graphDiagonal(vertices);
  const normalizedVertexError =
    graphScale === 0 ? 1 : meanVertexErrorPixels / graphScale;

  let matchedEdges = 0;
  let totalEdgeAngleError = 0;
  let weightedAngleError = 0;
  let weightedLengthRatioError = 0;
  let totalWeight = 0;
  const missingReferenceEdges: SolidEdge[] = [];
  const edgeScores: SolidEdgeScore[] = [];
  const matchedUserEdgeIds = new Set<number>();

  for (const referenceEdge of transformedReference.edges) {
    const userA = match.get(referenceEdge[0]);
    const userB = match.get(referenceEdge[1]);
    const userEdge =
      userA === undefined || userB === undefined
        ? null
        : findEdge(edges, userA, userB);
    if (!userEdge) {
      missingReferenceEdges.push(referenceEdge);
      continue;
    }
    if (userA === undefined || userB === undefined) {
      missingReferenceEdges.push(referenceEdge);
      continue;
    }

    const referenceA = transformedReference.vertices.find(
      (vertex) => vertex.index === referenceEdge[0],
    );
    const referenceB = transformedReference.vertices.find(
      (vertex) => vertex.index === referenceEdge[1],
    );
    const actualA = vertexById(vertices, userA);
    const actualB = vertexById(vertices, userB);
    if (!referenceA || !referenceB || !actualA || !actualB) continue;

    matchedEdges += 1;
    matchedUserEdgeIds.add(userEdge.id);
    const angleErrorDegrees = lineAngleDifferenceDegrees(
      referenceA.point,
      referenceB.point,
      actualA,
      actualB,
    );
    const referenceLength = distanceBetween(referenceA.point, referenceB.point);
    const userLength = distanceBetween(actualA, actualB);
    const lengthRatioError =
      referenceLength === 0 ? 1 : Math.abs(userLength / referenceLength - 1);
    const combinedErrorPercent =
      angleErrorDegrees * 1.4 + lengthRatioError * 70;

    totalEdgeAngleError += angleErrorDegrees;
    weightedAngleError += angleErrorDegrees * referenceLength;
    weightedLengthRatioError += lengthRatioError * referenceLength;
    totalWeight += referenceLength;
    edgeScores.push({
      referenceEdge,
      userEdgeId: userEdge.id,
      angleErrorDegrees,
      lengthRatioError,
      combinedErrorPercent,
    });
  }

  const meanEdgeAngleErrorDegrees =
    matchedEdges === 0 ? 45 : totalEdgeAngleError / matchedEdges;
  const meanLengthRatioError =
    totalWeight === 0 ? 1 : weightedLengthRatioError / totalWeight;
  const weightedMeanAngleErrorDegrees =
    totalWeight === 0 ? 45 : weightedAngleError / totalWeight;
  const extraUserEdgeIds = edges
    .filter((edge) => !matchedUserEdgeIds.has(edge.id))
    .map((edge) => edge.id);
  const topologyErrorCount = missingReferenceEdges.length + extraUserEdgeIds.length;
  const topologyPenalty =
    (topologyErrorCount / Math.max(reference.edges.length, 1)) * 34;
  const relativeErrorPercent =
    weightedMeanAngleErrorDegrees * 1.4 +
    meanLengthRatioError * 70 +
    normalizedVertexError * 45 +
    topologyPenalty;
  const score = clampNumber(100 - relativeErrorPercent, 0, 100);

  return {
    score,
    relativeErrorPercent: 100 - score,
    meanVertexErrorPixels,
    meanEdgeAngleErrorDegrees,
    meanLengthRatioError,
    worstEdgeErrorPercent: Math.max(
      0,
      ...edgeScores.map((edge) => edge.combinedErrorPercent),
    ),
    matchedEdges,
    expectedEdges: reference.edges.length,
    transformedReference,
    vertexMatches: match,
    edgeScores,
    missingReferenceEdges,
    extraUserEdgeIds,
  };
}

function alignReferenceToUserGraph(
  reference: SolidReferenceGraph,
  vertices: SolidGraphVertex[],
): SolidReferenceGraph {
  const referenceBounds = bounds(reference.vertices.map((vertex) => vertex.point));
  const userBounds = bounds(vertices);
  const referenceDiagonal = Math.hypot(
    referenceBounds.width,
    referenceBounds.height,
  );
  const userDiagonal = Math.hypot(userBounds.width, userBounds.height);
  const scale =
    referenceDiagonal <= 0 || userDiagonal <= 0
      ? 1
      : userDiagonal / referenceDiagonal;
  const referenceCenter = center(referenceBounds);
  const userCenter = center(userBounds);

  return {
    vertices: reference.vertices.map((vertex) => ({
      index: vertex.index,
      point: {
        x: userCenter.x + (vertex.point.x - referenceCenter.x) * scale,
        y: userCenter.y + (vertex.point.y - referenceCenter.y) * scale,
      },
    })),
    edges: reference.edges,
  };
}

function matchVertices(
  referenceVertices: { index: number; point: Point }[],
  userVertices: SolidGraphVertex[],
): Map<number, number> | null {
  if (referenceVertices.length !== userVertices.length) return null;

  let bestCost = Infinity;
  let bestOrder: SolidGraphVertex[] | null = null;

  permute(userVertices, 0, (candidate) => {
    let cost = 0;
    for (let i = 0; i < referenceVertices.length; i += 1) {
      cost += distanceBetween(referenceVertices[i].point, candidate[i]);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestOrder = [...candidate];
    }
  });

  if (!bestOrder) return null;

  const match = new Map<number, number>();
  referenceVertices.forEach((referenceVertex, index) => {
    match.set(referenceVertex.index, bestOrder?.[index].id ?? -1);
  });
  return match;
}

function permute<T>(items: T[], start: number, visit: (items: T[]) => void): void {
  if (start === items.length) {
    visit(items);
    return;
  }

  for (let i = start; i < items.length; i += 1) {
    [items[start], items[i]] = [items[i], items[start]];
    permute(items, start + 1, visit);
    [items[start], items[i]] = [items[i], items[start]];
  }
}

function findEdge(
  edges: SolidGraphEdge[],
  a: number,
  b: number,
): SolidGraphEdge | null {
  return (
    edges.find(
      (edge) =>
        (edge.v1 === a && edge.v2 === b) || (edge.v1 === b && edge.v2 === a),
    ) ?? null
  );
}

function vertexById(
  vertices: SolidGraphVertex[],
  id: number,
): SolidGraphVertex | null {
  return vertices.find((vertex) => vertex.id === id) ?? null;
}

function graphDiagonal(vertices: Point[]): number {
  const box = bounds(vertices);
  return Math.hypot(box.width, box.height);
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

function center(box: { minX: number; maxX: number; minY: number; maxY: number }): Point {
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
  };
}
