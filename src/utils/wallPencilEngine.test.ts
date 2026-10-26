import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanStrokePoints,
  simplifyStrokeRDP,
  straightenAndSnapPolyline,
  weldAndClosePolylines,
  finalizeWallSegments,
  organizePencilStrokesToWalls,
  snapPointToLocalImageEdge,
} from './wallPencilEngine.ts';
import type { MapWallSegment } from '../types/vtt.ts';

describe('Ferramenta de Parede com Lápis (wallPencilEngine)', () => {
  it('Etapa 1: cleanStrokePoints remove pontos duplicados, suaviza tremor e descarta cliques acidentais curtos', () => {
    // Accidental tiny click (< 0.3 squares) is discarded
    const tiny = cleanStrokePoints(
      [
        { x: 4, y: 4 },
        { x: 4.05, y: 4.04 },
      ],
      0.3,
      false
    );
    assert.equal(tiny.length, 0);

    // Force straight line collapses intermediate points to [start, end]
    const straight = cleanStrokePoints(
      [
        { x: 2, y: 3 },
        { x: 3.5, y: 3.4 },
        { x: 5, y: 3.1 },
        { x: 8, y: 3 },
      ],
      0.3,
      true
    );
    assert.equal(straight.length, 2);
    assert.deepEqual(straight[0], { x: 2, y: 3 });
    assert.deepEqual(straight[1], { x: 8, y: 3 });
  });

  it('Etapa 2: simplifyStrokeRDP simplifica rabisco trêmulo mas preserva cantos reais em L', () => {
    // Trembling L-shaped stroke from (2,2) -> (8,2) -> (8,7)
    const lStroke = [
      { x: 2, y: 2 },
      { x: 3.5, y: 2.04 },
      { x: 5.0, y: 1.97 },
      { x: 6.5, y: 2.03 },
      { x: 8.0, y: 2.0 }, // True corner!
      { x: 8.03, y: 3.5 },
      { x: 7.97, y: 5.0 },
      { x: 8.0, y: 7.0 },
    ];
    const simplified = simplifyStrokeRDP(lStroke, 0.15);
    assert.equal(simplified.length, 3);
    assert.deepEqual(simplified[0], { x: 2, y: 2 });
    assert.deepEqual(simplified[1], { x: 8, y: 2 });
    assert.deepEqual(simplified[2], { x: 8, y: 7 });
  });

  it('Etapa 3: straightenAndSnapPolyline endireita segmentos quase horizontais/verticais dentro da tolerância de ângulo', () => {
    const slightlyTilted = [
      { x: 2, y: 4 },
      { x: 10, y: 4.4 }, // ~2.86 degrees tilt -> within 8° tolerance -> snaps to y = 4
      { x: 10.3, y: 9 }, // ~3.4 degrees tilt -> within 8° tolerance -> snaps to x = 10
    ];
    const straightened = straightenAndSnapPolyline(slightlyTilted, {
      angleSnapToleranceDeg: 8,
      snap45Deg: false,
      snapToGrid: false,
      gridSnapStepSquares: 0.5,
    });
    assert.equal(straightened.length, 3);
    assert.deepEqual(straightened[0], { x: 2, y: 4 });
    assert.deepEqual(straightened[1], { x: 10, y: 4 });
    assert.deepEqual(straightened[2], { x: 10, y: 9 });
  });

  it('Etapa 4 e 5: organizePencilStrokesToWalls fecha polígonos automaticamente e divide paredes em junções T sem brechas', () => {
    const existingWalls: MapWallSegment[] = [
      { id: 'w-top', x1: 2, y1: 2, x2: 12, y2: 2, tipo: 'parede' },
    ];

    // User draws a vertical dividing wall starting near the middle of `w-top` at (7, 2.25) down to (7, 8)
    const { previewSegments, mergedWalls } = organizePencilStrokesToWalls(
      [
        [
          { x: 7, y: 2.22 },
          { x: 7.04, y: 5 },
          { x: 7, y: 8 },
        ],
      ],
      existingWalls,
      {
        simplifyToleranceSquares: 0.18,
        angleSnapToleranceDeg: 8,
        weldRadiusSquares: 0.45,
      }
    );

    assert.equal(previewSegments.length, 1);
    assert.equal(previewSegments[0].x1, 7);
    assert.equal(previewSegments[0].y1, 2); // Snapped to y=2 on w-top!
    assert.equal(previewSegments[0].x2, 7);
    assert.equal(previewSegments[0].y2, 8);

    // And `w-top` was split at (7, 2) into two segments so the T-junction is 100% airtight!
    assert.equal(mergedWalls.length, 3);
  });

  it('Lápis Magnético Opcional: snapPointToLocalImageEdge puxa o cursor apenas para borda escura local dentro do raio', () => {
    const width = 40;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4).fill(220); // Light floor everywhere
    // Draw a vertical dark wall line at x = 20
    for (let y = 0; y < height; y++) {
      const idx = (y * width + 20) * 4;
      data[idx] = 15;
      data[idx + 1] = 15;
      data[idx + 2] = 20;
      data[idx + 3] = 255;
    }

    // Cursor at x = 24, y = 20 with radius 10px -> pulled toward x = 20
    const res = snapPointToLocalImageEdge(24, 20, { width, height, data }, 10);
    assert.equal(res.snapped, true);
    assert.ok(res.xPx < 22, `Expected cursor xPx (${res.xPx}) to be pulled toward dark edge at x=20`);
  });
});
