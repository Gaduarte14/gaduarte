import type { MapWallSegment } from '../types/vtt.ts';
import { distancePointToSegment2D } from './dndRules.ts';

export interface GridPoint {
  x: number;
  y: number;
}

export interface WallPencilConfig {
  /** Ramer-Douglas-Peucker simplification tolerance in grid squares (default: 0.18) */
  simplifyToleranceSquares: number;
  /** Angle tolerance in degrees for snapping nearly H/V segments to 0°/90° (default: 8) */
  angleSnapToleranceDeg: number;
  /** Optional 45° diagonal angle snapping (default: false) */
  snap45Deg: boolean;
  /** Optional grid alignment for vertices (default: false; when true snaps to 0.25 or 0.5 grid) */
  snapToGrid: boolean;
  /** Grid step when snapToGrid is true (default: 0.5 squares) */
  gridSnapStepSquares: number;
  /** Radius in grid squares for welding endpoints to existing walls/strokes & closing loops (default: 0.42) */
  weldRadiusSquares: number;
  /** Minimum stroke/segment length in grid squares to discard accidental clicks (default: 0.30) */
  minSegmentLengthSquares: number;
  /** Force straight line between stroke start and end (default: false) */
  forceStraightLine: boolean;
  /** Optional local magnetic pull toward nearby dark/high-contrast map edges (default: false) */
  magneticEnabled: boolean;
  /** Local search radius in pixels around the cursor for the magnetic pencil (default: 14) */
  magneticRadiusPx: number;
}

export const DEFAULT_WALL_PENCIL_CONFIG: WallPencilConfig = {
  simplifyToleranceSquares: 0.18,
  angleSnapToleranceDeg: 8,
  snap45Deg: false,
  snapToGrid: false,
  gridSnapStepSquares: 0.5,
  weldRadiusSquares: 0.42,
  minSegmentLengthSquares: 0.3,
  forceStraightLine: false,
  magneticEnabled: false,
  magneticRadiusPx: 14,
};

/**
 * Step 1 — Limpar o rabisco (`cleanStrokePoints`):
 * - Removes duplicate or near-zero-distance points.
 * - If `forceStraightLine` is true, collapses the stroke to `[first, last]`.
 * - Applies a short 3-point moving-average smoothing pass to remove hand tremor while preserving sharp corners (> 38°).
 * - Discards tiny accidental clicks whose total path length is below `minLengthSquares`.
 */
export function cleanStrokePoints(
  rawPoints: GridPoint[],
  minLengthSquares: number = 0.3,
  forceStraightLine: boolean = false
): GridPoint[] {
  if (!rawPoints || rawPoints.length < 2) return [];

  // 1. Deduplicate consecutive points closer than 0.02 grid squares
  const deduped: GridPoint[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = deduped[deduped.length - 1];
    const pt = rawPoints[i];
    if (Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 0.02 || i === rawPoints.length - 1) {
      deduped.push({ x: pt.x, y: pt.y });
    }
  }

  if (deduped.length < 2) return [];

  // Check total path length
  let totalLen = 0;
  for (let i = 1; i < deduped.length; i++) {
    totalLen += Math.hypot(deduped[i].x - deduped[i - 1].x, deduped[i].y - deduped[i - 1].y);
  }
  if (totalLen < Math.max(0.05, minLengthSquares)) {
    return [];
  }

  if (forceStraightLine) {
    const start = deduped[0];
    const end = deduped[deduped.length - 1];
    if (Math.hypot(end.x - start.x, end.y - start.y) < Math.max(0.05, minLengthSquares)) {
      return [];
    }
    return [{ ...start }, { ...end }];
  }

  if (deduped.length <= 2) {
    return deduped;
  }

  // 2. Short moving-average filter that preserves sharp corners (> 38 degrees deflection)
  const smoothed: GridPoint[] = [{ ...deduped[0] }];
  const cornerThresholdCos = Math.cos((38 * Math.PI) / 180);

  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = deduped[i - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 > 1e-5 && len2 > 1e-5) {
      const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
      // Preserve true corner without blurring it
      if (cosAngle < cornerThresholdCos) {
        smoothed.push({ ...curr });
        continue;
      }
    }

    smoothed.push({
      x: prev.x * 0.22 + curr.x * 0.56 + next.x * 0.22,
      y: prev.y * 0.22 + curr.y * 0.56 + next.y * 0.22,
    });
  }

  smoothed.push({ ...deduped[deduped.length - 1] });
  return smoothed;
}

/**
 * Step 2 — Simplificar (`simplifyStrokeRDP`):
 * Ramer-Douglas-Peucker polyline simplification that reduces hand-drawn points to clean vertices
 * while preserving real directional corners.
 */
export function simplifyStrokeRDP(
  points: GridPoint[],
  toleranceSquares: number = 0.18
): GridPoint[] {
  if (!points || points.length <= 2) return points ? [...points] : [];
  const eps = Math.max(0.01, toleranceSquares);

  // If stroke is a closed loop (start ~ end), split at the farthest vertex first so RDP doesn't collapse the loop
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length >= 4 && Math.hypot(last.x - first.x, last.y - first.y) <= eps * 1.5) {
    let farthestIdx = -1;
    let farthestDist = -1;
    for (let i = 1; i < points.length - 1; i++) {
      const d = Math.hypot(points[i].x - first.x, points[i].y - first.y);
      if (d > farthestDist) {
        farthestDist = d;
        farthestIdx = i;
      }
    }
    if (farthestIdx > 0 && farthestIdx < points.length - 1 && farthestDist > eps) {
      const part1 = simplifyStrokeRDP(points.slice(0, farthestIdx + 1), eps);
      const part2 = simplifyStrokeRDP(points.slice(farthestIdx), eps);
      return [...part1.slice(0, -1), ...part2];
    }
  }

  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distancePointToSegment2D(
      points[i].x,
      points[i].y,
      first.x,
      first.y,
      last.x,
      last.y
    );
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > eps && index > 0 && index < points.length - 1) {
    const left = simplifyStrokeRDP(points.slice(0, index + 1), eps);
    const right = simplifyStrokeRDP(points.slice(index), eps);
    return [...left.slice(0, -1), ...right];
  }

  return [{ ...first }, { ...last }];
}

/**
 * Step 3 — Endireitar (`straightenAndSnapSegments`):
 * - Snaps nearly horizontal or vertical segments to exact 0° / 90° within `angleSnapToleranceDeg` (default 8°).
 * - Optionally snaps nearly 45° diagonal segments when `snap45Deg` is true.
 * - Optionally snaps vertices to the grid (`gridSnapStepSquares`, e.g. 0.5) when `snapToGrid` is true.
 * - Keeps consecutive segments connected at shared corners.
 */
export function straightenAndSnapPolyline(
  points: GridPoint[],
  options: Pick<
    WallPencilConfig,
    'angleSnapToleranceDeg' | 'snap45Deg' | 'snapToGrid' | 'gridSnapStepSquares'
  >
): GridPoint[] {
  if (!points || points.length < 2) return [];
  const tolRad = (Math.max(0, options.angleSnapToleranceDeg) * Math.PI) / 180;
  const gridStep = Math.max(0.125, options.gridSnapStepSquares || 0.5);

  const snapCoord = (v: number): number => {
    if (!options.snapToGrid) return Math.round(v * 100) / 100;
    return Math.round(v / gridStep) * gridStep;
  };

  const result: GridPoint[] = [
    {
      x: snapCoord(points[0].x),
      y: snapCoord(points[0].y),
    },
  ];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    let targetX = snapCoord(points[i].x);
    let targetY = snapCoord(points[i].y);

    const dx = targetX - prev.x;
    const dy = targetY - prev.y;
    const len = Math.hypot(dx, dy);

    if (len > 1e-4 && tolRad > 0) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const devFromHorizontal = Math.atan2(absDy, absDx);
      const devFromVertical = Math.atan2(absDx, absDy);

      if (devFromHorizontal <= tolRad) {
        // Snap to exact horizontal (0° / 180°)
        targetY = prev.y;
      } else if (devFromVertical <= tolRad) {
        // Snap to exact vertical (90° / 270°)
        targetX = prev.x;
      } else if (options.snap45Deg) {
        const angle = Math.atan2(dy, dx);
        const diagAngles = [
          Math.PI / 4,
          (3 * Math.PI) / 4,
          -Math.PI / 4,
          (-3 * Math.PI) / 4,
        ];
        for (const diag of diagAngles) {
          if (Math.abs(angle - diag) <= tolRad) {
            const avgDelta = (absDx + absDy) / 2;
            const snappedDelta = options.snapToGrid ? snapCoord(avgDelta) : avgDelta;
            targetX = Math.round((prev.x + Math.sign(dx) * snappedDelta) * 100) / 100;
            targetY = Math.round((prev.y + Math.sign(dy) * snappedDelta) * 100) / 100;
            break;
          }
        }
      }
    }

    result.push({
      x: Math.round(targetX * 100) / 100,
      y: Math.round(targetY * 100) / 100,
    });
  }

  // If consecutive segments are exact H then exact V (orthogonal L-corner), intersect cleanly
  return result;
}

export interface RawSegment2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Projects point `(px, py)` onto segment `(x1, y1)-(x2, y2)` and returns `{ x, y, t, dist }`.
 */
function projectPointOnSegment2D(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number; t: number; dist: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) {
    return { x: x1, y: y1, t: 0, dist: Math.hypot(px - x1, py - y1) };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return {
    x: Math.round(projX * 100) / 100,
    y: Math.round(projY * 100) / 100,
    t,
    dist: Math.hypot(px - projX, py - projY),
  };
}

/**
 * Step 4 — Grudar e fechar (`weldAndClosePolylines`):
 * - Closes a stroke loop if its end point is within `weldRadiusSquares` of its start point.
 * - Welds stroke endpoints to existing wall endpoints or earlier stroke vertices within `weldRadiusSquares`.
 * - Snaps endpoints onto existing wall segments or stroke segments (T-junction) within `weldRadiusSquares`
 *   and splits the target segment at the junction so zero light can leak through corners.
 */
export function weldAndClosePolylines(
  polylines: GridPoint[][],
  existingWalls: MapWallSegment[] = [],
  weldRadiusSquares: number = 0.42
): {
  newSegments: RawSegment2D[];
  updatedExistingWalls: MapWallSegment[];
} {
  const snapR = Math.max(0.05, weldRadiusSquares);
  const existingCopy: MapWallSegment[] = existingWalls.map((w) => ({ ...w }));

  // Collect anchor vertices (initially from existing walls)
  const anchors: GridPoint[] = [];
  for (const w of existingCopy) {
    anchors.push({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
  }

  const findNearestAnchor = (pt: GridPoint): GridPoint | null => {
    let best: GridPoint | null = null;
    let bestD = snapR;
    for (const a of anchors) {
      const d = Math.hypot(a.x - pt.x, a.y - pt.y);
      if (d <= bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };

  const processedPolylines: GridPoint[][] = [];

  for (const poly of polylines) {
    if (poly.length < 2) continue;
    const pts = poly.map((p) => ({ ...p }));

    // Check self-closure first (if >= 3 vertices and end is near start)
    if (pts.length >= 3) {
      const dLoop = Math.hypot(
        pts[pts.length - 1].x - pts[0].x,
        pts[pts.length - 1].y - pts[0].y
      );
      if (dLoop <= snapR * 1.25) {
        pts[pts.length - 1] = { ...pts[0] };
      }
    }

    // Weld start and end vertices to nearest anchor if within snapR
    const startAnchor = findNearestAnchor(pts[0]);
    if (startAnchor) {
      const wasClosed =
        pts.length >= 3 &&
        Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < 1e-4;
      pts[0] = { ...startAnchor };
      if (wasClosed) {
        pts[pts.length - 1] = { ...startAnchor };
      }
    }

    const endAnchor = findNearestAnchor(pts[pts.length - 1]);
    if (endAnchor) {
      pts[pts.length - 1] = { ...endAnchor };
    }

    // Register all vertices of this polyline as anchors for subsequent strokes
    for (const p of pts) {
      anchors.push({ ...p });
    }

    processedPolylines.push(pts);
  }

  // Convert polylines into raw segments
  let newSegments: RawSegment2D[] = [];
  for (const pts of processedPolylines) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) >= 0.04) {
        newSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }
  }

  // T-Junction snapping & splitting against existingWalls and other newSegments
  const snapEndpointToSegments = (
    epX: number,
    epY: number,
    ignoreNewIdx: number
  ): { x: number; y: number } => {
    // If already at an existing endpoint, no interior split needed
    for (const w of existingCopy) {
      if (
        Math.hypot(w.x1 - epX, w.y1 - epY) < 0.04 ||
        Math.hypot(w.x2 - epX, w.y2 - epY) < 0.04
      ) {
        return { x: epX, y: epY };
      }
    }
    for (let i = 0; i < newSegments.length; i++) {
      if (i === ignoreNewIdx) continue;
      const s = newSegments[i];
      if (
        Math.hypot(s.x1 - epX, s.y1 - epY) < 0.04 ||
        Math.hypot(s.x2 - epX, s.y2 - epY) < 0.04
      ) {
        return { x: epX, y: epY };
      }
    }

    // Check interior of existingCopy
    for (let i = 0; i < existingCopy.length; i++) {
      const w = existingCopy[i];
      const proj = projectPointOnSegment2D(epX, epY, w.x1, w.y1, w.x2, w.y2);
      if (proj.dist <= snapR && proj.t > 0.05 && proj.t < 0.95) {
        // Split existing wall `w` at `(proj.x, proj.y)` so the T-junction is airtight
        const segA: MapWallSegment = {
          ...w,
          id: `${w.id}-a`,
          x1: w.x1,
          y1: w.y1,
          x2: proj.x,
          y2: proj.y,
        };
        const segB: MapWallSegment = {
          ...w,
          id: `${w.id}-b`,
          x1: proj.x,
          y1: proj.y,
          x2: w.x2,
          y2: w.y2,
        };
        existingCopy.splice(i, 1, segA, segB);
        return { x: proj.x, y: proj.y };
      }
    }

    // Check interior of other newSegments
    for (let i = 0; i < newSegments.length; i++) {
      if (i === ignoreNewIdx) continue;
      const s = newSegments[i];
      const proj = projectPointOnSegment2D(epX, epY, s.x1, s.y1, s.x2, s.y2);
      if (proj.dist <= snapR && proj.t > 0.05 && proj.t < 0.95) {
        const segA: RawSegment2D = { x1: s.x1, y1: s.y1, x2: proj.x, y2: proj.y };
        const segB: RawSegment2D = { x1: proj.x, y1: proj.y, x2: s.x2, y2: s.y2 };
        newSegments.splice(i, 1, segA, segB);
        return { x: proj.x, y: proj.y };
      }
    }

    return { x: epX, y: epY };
  };

  for (let i = 0; i < newSegments.length; i++) {
    const p1 = snapEndpointToSegments(newSegments[i].x1, newSegments[i].y1, i);
    newSegments[i].x1 = p1.x;
    newSegments[i].y1 = p1.y;
    const p2 = snapEndpointToSegments(newSegments[i].x2, newSegments[i].y2, i);
    newSegments[i].x2 = p2.x;
    newSegments[i].y2 = p2.y;
  }

  return {
    newSegments,
    updatedExistingWalls: existingCopy,
  };
}

/**
 * Step 5 — Limpeza final (`finalizeWallSegments`):
 * - Merges consecutive collinear segments that share an endpoint.
 * - Discards segments shorter than `minSegmentLengthSquares`.
 * - Deduplicates identical segments.
 */
export function finalizeWallSegments(
  rawSegments: RawSegment2D[],
  minSegmentLengthSquares: number = 0.3,
  idPrefix: string = 'wall-pencil'
): MapWallSegment[] {
  const minLen = Math.max(0.1, minSegmentLengthSquares);
  const filtered = rawSegments.filter(
    (s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= minLen * 0.5
  );

  // Merge consecutive collinear segments sharing an endpoint
  const merged: RawSegment2D[] = [];
  for (const seg of filtered) {
    if (merged.length === 0) {
      merged.push({ ...seg });
      continue;
    }
    const prev = merged[merged.length - 1];
    const sharesEndpoint =
      Math.hypot(seg.x1 - prev.x2, seg.y1 - prev.y2) <= 0.04;

    if (sharesEndpoint) {
      const dx1 = prev.x2 - prev.x1;
      const dy1 = prev.y2 - prev.y1;
      const dx2 = seg.x2 - seg.x1;
      const dy2 = seg.y2 - seg.y1;
      const l1 = Math.hypot(dx1, dy1);
      const l2 = Math.hypot(dx2, dy2);
      if (l1 > 1e-4 && l2 > 1e-4) {
        const cross = Math.abs(dx1 * dy2 - dy1 * dx2) / (l1 * l2);
        const dot = (dx1 * dx2 + dy1 * dy2) / (l1 * l2);
        if (cross < 0.035 && dot > 0.98) {
          prev.x2 = seg.x2;
          prev.y2 = seg.y2;
          continue;
        }
      }
    }
    merged.push({ ...seg });
  }

  // Deduplicate and enforce minSegmentLengthSquares
  const unique: MapWallSegment[] = [];
  const seenKeys = new Set<string>();

  merged.forEach((s, idx) => {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (len < minLen) return;
    const x1 = Math.round(s.x1 * 100) / 100;
    const y1 = Math.round(s.y1 * 100) / 100;
    const x2 = Math.round(s.x2 * 100) / 100;
    const y2 = Math.round(s.y2 * 100) / 100;
    const forwardKey = `${x1},${y1}->${x2},${y2}`;
    const reverseKey = `${x2},${y2}->${x1},${y1}`;
    if (seenKeys.has(forwardKey) || seenKeys.has(reverseKey)) return;
    seenKeys.add(forwardKey);

    unique.push({
      id: `${idPrefix}-${idx + 1}`,
      x1,
      y1,
      x2,
      y2,
      tipo: 'parede',
    });
  });

  return unique;
}

/**
 * Full 5-Step Pipeline (`organizePencilStrokesToWalls`):
 * Takes one or more raw freehand strokes (`GridPoint[][]`) drawn by the user with the Wall Pencil tool,
 * runs Steps 1–5 in order, and returns:
 * - `previewSegments`: the organized `MapWallSegment[]` generated from the strokes
 * - `mergedWalls`: the complete wall list (`existingWalls` with any T-junction splits + `previewSegments`)
 *   ready to commit on **Concluir**!
 */
export function organizePencilStrokesToWalls(
  rawStrokes: GridPoint[][],
  existingWalls: MapWallSegment[] = [],
  config: Partial<WallPencilConfig> = {}
): {
  previewSegments: MapWallSegment[];
  mergedWalls: MapWallSegment[];
  cleanedPolylines: GridPoint[][];
} {
  const cfg: WallPencilConfig = { ...DEFAULT_WALL_PENCIL_CONFIG, ...config };
  const cleanedPolylines: GridPoint[][] = [];

  for (const rawStroke of rawStrokes) {
    // 1. Clean raw stroke
    const cleaned = cleanStrokePoints(
      rawStroke,
      cfg.minSegmentLengthSquares,
      cfg.forceStraightLine
    );
    if (cleaned.length < 2) continue;

    // 2. Simplify via Ramer-Douglas-Peucker
    const simplified = cfg.forceStraightLine
      ? cleaned
      : simplifyStrokeRDP(cleaned, cfg.simplifyToleranceSquares);
    if (simplified.length < 2) continue;

    // 3. Straighten near-H/V/45° segments and optional grid snap
    const straightened = straightenAndSnapPolyline(simplified, {
      angleSnapToleranceDeg: cfg.angleSnapToleranceDeg,
      snap45Deg: cfg.snap45Deg,
      snapToGrid: cfg.snapToGrid,
      gridSnapStepSquares: cfg.gridSnapStepSquares,
    });
    if (straightened.length < 2) continue;

    cleanedPolylines.push(straightened);
  }

  if (cleanedPolylines.length === 0) {
    return {
      previewSegments: [],
      mergedWalls: existingWalls ? [...existingWalls] : [],
      cleanedPolylines: [],
    };
  }

  // 4. Weld endpoints, close loops, and split T-junctions
  const { newSegments, updatedExistingWalls } = weldAndClosePolylines(
    cleanedPolylines,
    existingWalls,
    cfg.weldRadiusSquares
  );

  // 5. Finalize collinear merges, minimum length, and deduplication
  const timestamp = Date.now();
  const previewSegments = finalizeWallSegments(
    newSegments,
    cfg.minSegmentLengthSquares,
    `wall-pencil-${timestamp}`
  );

  return {
    previewSegments,
    mergedWalls: [...updatedExistingWalls, ...previewSegments],
    cleanedPolylines,
  };
}

/**
 * Optional Magnetic Pencil helper (`snapPointToLocalImageEdge`):
 * Inspects ONLY a small local pixel window (`[-radiusPx, +radiusPx]`) around `(cursorXPx, cursorYPx)`
 * in an `ImageData`-like buffer (`{ width, height, data }`) and pulls the cursor toward the strongest
 * local dark/high-contrast edge within that radius.
 * Never scans the whole map.
 */
export function snapPointToLocalImageEdge(
  cursorXPx: number,
  cursorYPx: number,
  imageBuffer: { width: number; height: number; data: Uint8ClampedArray } | null | undefined,
  radiusPx: number = 14
): { xPx: number; yPx: number; snapped: boolean } {
  if (!imageBuffer || radiusPx <= 0) {
    return { xPx: cursorXPx, yPx: cursorYPx, snapped: false };
  }

  const { width, height, data } = imageBuffer;
  const cx = Math.round(cursorXPx);
  const cy = Math.round(cursorYPx);
  const r = Math.min(32, Math.max(3, Math.round(radiusPx)));

  if (cx < 2 || cy < 2 || cx >= width - 2 || cy >= height - 2) {
    return { xPx: cursorXPx, yPx: cursorYPx, snapped: false };
  }

  const getLuma = (x: number, y: number): number => {
    const idx = (y * width + x) * 4;
    return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  };

  let bestScore = 0;
  let bestX = cursorXPx;
  let bestY = cursorYPx;

  const minX = Math.max(1, cx - r);
  const maxX = Math.min(width - 2, cx + r);
  const minY = Math.max(1, cy - r);
  const maxY = Math.min(height - 2, cy + r);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x - cursorXPx, y - cursorYPx);
      if (dist > r) continue;

      // Local Sobel-like gradient + darkness weight
      const gx = getLuma(x + 1, y) - getLuma(x - 1, y);
      const gy = getLuma(x, y + 1) - getLuma(x, y - 1);
      const gradMag = Math.hypot(gx, gy); // 0..360
      const luma = getLuma(x, y); // 0..255 (lower = darker wall line)
      const darknessBonus = Math.max(0, (180 - luma) * 0.45);
      const distanceFalloff = 1 - (dist / (r + 1)) * 0.35;

      const score = (gradMag + darknessBonus) * distanceFalloff;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  // Only snap if there is a meaningful local contrast/dark line (score > 42)
  if (bestScore > 42) {
    return {
      xPx: cursorXPx * 0.25 + bestX * 0.75,
      yPx: cursorYPx * 0.25 + bestY * 0.75,
      snapped: true,
    };
  }

  return { xPx: cursorXPx, yPx: cursorYPx, snapped: false };
}
