import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  Eye,
  EyeOff,
  Trash2,
  BookOpen,
  Heart,
  Lock,
  Unlock,
  Edit3,
  Sparkles,
  Plus,
  Minus,
  DoorOpen,
  DoorClosed,
  BrickWall,
} from 'lucide-react';
import type {
  CharacterSheet,
  ExploredFogCircle,
  MapDrawing,
  MapScene,
  MapToken,
  MapWallSegment,
} from '../types/vtt.ts';
import {
  DND_CONDITIONS,
  buildSmoothFalloffGradientStops,
  computeDynamicTokenVisionCircles,
  computePlayerExploredMemoryCircles,
  computeVisibilityPolygon,
  getBlockingWallsPx,
  getConditionMeta,
  hasConditionInList,
  isPlayerTokenTouchingDoor,
  isTokenInsideFog,
  recordTokenFogMemoryPath,
  recordTokenFogMemoryStep,
  resolveTokenMovementWithWalls,
  snapPointToExistingWallEndpoints,
  toggleConditionInList,
} from '../utils/dndRules.ts';
import {
  DEFAULT_WALL_PENCIL_CONFIG,
  organizePencilStrokesToWalls,
  snapPointToLocalImageEdge,
  type GridPoint,
  type WallPencilConfig,
} from '../utils/wallPencilEngine.ts';
import {
  WallPencilToolOverlay,
  type WallDrawSubMode,
} from './WallPencilToolOverlay.tsx';

export type ActiveMapTool =
  | 'hand'
  | 'select'
  | 'fog'
  | 'light'
  | 'wall'
  | 'door'
  | 'draw'
  | 'measure'
  | 'pointer'
  | 'text';

interface TacticalMapCanvasProps {
  scene: MapScene;
  sheets: CharacterSheet[];
  userRole: 'mestre' | 'jogador';
  activePlayingSheetId?: string | null;
  activeTool: ActiveMapTool;
  zoom: number;
  pan: { x: number; y: number };
  onChangePan: (pan: { x: number; y: number }) => void;
  onChangeZoom: (zoom: number) => void;
  selectedTokenId: string | null;
  activeTurnTokenId?: string | null;
  activeTurnFichaId?: string | null;
  onSelectToken: (tokenId: string | null) => void;
  onMoveToken: (tokenId: string, newX: number, newY: number, isLiveDrag?: boolean) => void;
  onUpdateToken: (updated: MapToken) => void;
  onDeleteToken: (tokenId: string) => void;
  onPlaceLightToken?: (gridX: number, gridY: number) => void;
  onAddWallSegment?: (segment: MapWallSegment) => void;
  onCommitWallBatch?: (mergedWalls: MapWallSegment[]) => void;
  canUndoWallBatch?: boolean;
  onUndoWallBatch?: () => void;
  onToggleDoorSegment?: (segmentId: string) => void;
  onDeleteWallSegment?: (segmentId: string) => void;
  onOpenSheet: (sheetId: string) => void;
  onAddDrawing: (drawing: MapDrawing) => void;
  onToggleSceneFog: () => void;
}

function hexColorToRgbString(hex: string): string {
  const clean = (hex || '#f59e0b').replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) || 245;
    const g = parseInt(clean.slice(2, 4), 16) || 158;
    const b = parseInt(clean.slice(4, 6), 16) || 11;
    return `${r}, ${g}, ${b}`;
  }
  return '245, 158, 11';
}

export const TacticalMapCanvas: React.FC<TacticalMapCanvasProps> = ({
  scene,
  sheets,
  userRole,
  activePlayingSheetId,
  activeTool,
  zoom,
  pan,
  onChangePan,
  onChangeZoom,
  selectedTokenId,
  activeTurnTokenId,
  activeTurnFichaId,
  onSelectToken,
  onMoveToken,
  onUpdateToken,
  onDeleteToken,
  onPlaceLightToken,
  onAddWallSegment,
  onCommitWallBatch,
  canUndoWallBatch = false,
  onUndoWallBatch,
  onToggleDoorSegment,
  onDeleteWallSegment,
  onOpenSheet,
  onAddDrawing,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const memoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafMoveRef = useRef<number | null>(null);

  // Dragging state for pan or 60fps zero-lag token movement
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [dragOffsetGrid, setDragOffsetGrid] = useState({ dx: 0, dy: 0 });
  const [liveDragPos, setLiveDragPos] = useState<{
    tokenId: string;
    x: number;
    y: number;
    memoriaExplorada?: ExploredFogCircle[];
  } | null>(null);
  const lastLiveBroadcastRef = useRef<number>(0);
  const [wallCollisionFlash, setWallCollisionFlash] = useState<boolean>(false);

  // Wall / Door live drawing state (for GM)
  const [wallDraft, setWallDraft] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    tipo: 'parede' | 'porta';
  } | null>(null);

  // Freehand Wall Pencil (Riscar e Concluir) state
  const [wallSubMode, setWallSubMode] = useState<WallDrawSubMode>('pencil');
  const [wallPencilConfig, setWallPencilConfig] = useState<WallPencilConfig>(
    DEFAULT_WALL_PENCIL_CONFIG
  );
  const [wallPencilStrokes, setWallPencilStrokes] = useState<GridPoint[][]>([]);
  const [activeWallPencilStroke, setActiveWallPencilStroke] = useState<GridPoint[]>([]);
  const activeWallPencilStrokeRef = useRef<GridPoint[]>([]);
  const [shiftHeldDuringPencil, setShiftHeldDuringPencil] = useState<boolean>(false);
  const mapImageBufferRef = useRef<{
    url: string;
    width: number;
    height: number;
    data: Uint8ClampedArray;
  } | null>(null);

  // Quick condition popover on selected token HUD
  const [showHudConditions, setShowHudConditions] = useState(false);

  // Ruler measurement state
  const [measurePoints, setMeasurePoints] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // Freehand drawing state
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  const gridSize = scene.tamanhoGradePx || 64;
  const mapWidthPx = scene.larguraQuadrados * gridSize;
  const mapHeightPx = scene.alturaQuadrados * gridSize;

  // Lazy-load image pixel buffer ONLY when Optional Magnetic Pencil is enabled on a map with an image
  useEffect(() => {
    if (!wallPencilConfig.magneticEnabled || !scene.fundoUrl) return;
    if (
      mapImageBufferRef.current &&
      mapImageBufferRef.current.url === scene.fundoUrl &&
      mapImageBufferRef.current.width === mapWidthPx &&
      mapImageBufferRef.current.height === mapHeightPx
    ) {
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const off = document.createElement('canvas');
        off.width = mapWidthPx;
        off.height = mapHeightPx;
        const c2d = off.getContext('2d');
        if (!c2d) return;
        c2d.drawImage(img, 0, 0, mapWidthPx, mapHeightPx);
        const imgData = c2d.getImageData(0, 0, mapWidthPx, mapHeightPx);
        mapImageBufferRef.current = {
          url: scene.fundoUrl,
          width: mapWidthPx,
          height: mapHeightPx,
          data: imgData.data,
        };
      } catch {
        // Ignore CORS tainted canvas if external
      }
    };
    img.src = scene.fundoUrl;
    return () => {
      cancelled = true;
    };
  }, [wallPencilConfig.magneticEnabled, scene.fundoUrl, mapWidthPx, mapHeightPx]);

  // All current raw strokes for the Wall Pencil tool (completed strokes + active stroke being drawn)
  const allWallPencilStrokes = useMemo(() => {
    if (activeWallPencilStroke.length >= 2) {
      return [...wallPencilStrokes, activeWallPencilStroke];
    }
    return wallPencilStrokes;
  }, [wallPencilStrokes, activeWallPencilStroke]);

  // Real-time 5-step organization preview for the Wall Pencil tool
  const wallPencilOrganized = useMemo(() => {
    if (allWallPencilStrokes.length === 0) {
      return {
        previewSegments: [] as MapWallSegment[],
        mergedWalls: scene.paredes || [],
        cleanedPolylines: [] as GridPoint[][],
      };
    }
    return organizePencilStrokesToWalls(allWallPencilStrokes, scene.paredes || [], {
      ...wallPencilConfig,
      forceStraightLine: wallPencilConfig.forceStraightLine || shiftHeldDuringPencil,
    });
  }, [allWallPencilStrokes, scene.paredes, wallPencilConfig, shiftHeldDuringPencil]);

  const handleConcludeWallPencil = () => {
    if (wallPencilOrganized.previewSegments.length === 0) return;
    if (onCommitWallBatch) {
      onCommitWallBatch(wallPencilOrganized.mergedWalls);
    } else if (onAddWallSegment) {
      for (const seg of wallPencilOrganized.previewSegments) {
        onAddWallSegment(seg);
      }
    }
    setWallPencilStrokes([]);
    setActiveWallPencilStroke([]);
  };

  // Combine scene tokens with 60fps liveDragPos & live explored memory trail so the dragged token and its fog/light/memory update instantaneously
  const effectiveTokens = useMemo(() => {
    if (!liveDragPos) return scene.tokens;
    return scene.tokens.map((t) =>
      t.id === liveDragPos.tokenId
        ? {
            ...t,
            x: liveDragPos.x,
            y: liveDragPos.y,
            memoriaExplorada: liveDragPos.memoriaExplorada ?? t.memoriaExplorada,
          }
        : t
    );
  }, [scene.tokens, liveDragPos]);

  const fogViewerOptions = useMemo(
    () => ({
      viewerRole: userRole,
      viewerSheetId: activePlayingSheetId || null,
      viewerTokenId: userRole === 'jogador' ? null : selectedTokenId || null,
      paredes: scene.paredes,
      colisaoParedesAtiva: Boolean(scene.colisaoParedesAtiva),
    }),
    [
      userRole,
      activePlayingSheetId,
      selectedTokenId,
      scene.paredes,
      scene.colisaoParedesAtiva,
    ]
  );

  const blockingWallsPx = useMemo(
    () => getBlockingWallsPx(scene.paredes, gridSize, Boolean(scene.colisaoParedesAtiva)),
    [scene.paredes, gridSize, scene.colisaoParedesAtiva]
  );

  // Render 3-Tier Dynamic Fog of War + Token Memory + Smooth Falloff Torch Light on Canvas:
  // 1. Escuridão Total (Unexplored): 100% pitch-black ('rgba(3, 4, 7, 1.0)') for Players where their token has never illuminated/seen.
  // 2. Memória do Token (Explored Trail): Places where the player's token already walked with active [Luz] or [Visão] stay with the semi-transparent fog ("a névoa de agora", ~0.64 alpha) instead of total darkness!
  // 3. Visão / Luz Ativa Agora com Falloff Suave: Center has maximum intensity (d = 0 -> 1.0) and smoothly attenuates to 0 at the limit (d = 1 -> 0.0) without any hard edge or ring!
  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, mapWidthPx, mapHeightPx);

    if (!scene.nevoaAtiva) return;

    ctx.save();

    // 1. Base Layer: Escuridão Total (100% pitch black for Jogador, translucent preview for Mestre)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle =
      userRole === 'mestre' ? 'rgba(8, 9, 14, 0.66)' : 'rgba(3, 4, 7, 1.0)';
    ctx.fillRect(0, 0, mapWidthPx, mapHeightPx);

    // 2. Token Memory Layer ("a névoa de agora" where the player's token already passed with [Luz] or [Visão]):
    const memoryCircles = computePlayerExploredMemoryCircles(
      effectiveTokens,
      gridSize,
      fogViewerOptions
    );

    if (memoryCircles.length > 0) {
      if (!memoryCanvasRef.current) {
        memoryCanvasRef.current = document.createElement('canvas');
      }
      const memCanvas = memoryCanvasRef.current;
      if (memCanvas.width !== mapWidthPx || memCanvas.height !== mapHeightPx) {
        memCanvas.width = mapWidthPx;
        memCanvas.height = mapHeightPx;
      }
      const memCtx = memCanvas.getContext('2d');
      if (memCtx) {
        memCtx.clearRect(0, 0, mapWidthPx, mapHeightPx);
        memCtx.globalCompositeOperation = 'source-over';
        const memStops = buildSmoothFalloffGradientStops(0.45);
        for (const mc of memoryCircles) {
          if (mc.radiusPx <= 0) continue;

          if (blockingWallsPx.length > 0) {
            const memPoly = computeVisibilityPolygon(
              mc.xPx,
              mc.yPx,
              mc.radiusPx,
              blockingWallsPx
            );
            if (memPoly.length < 3) continue;
            memCtx.save();
            memCtx.beginPath();
            memCtx.moveTo(memPoly[0].x, memPoly[0].y);
            for (let i = 1; i < memPoly.length; i++) {
              memCtx.lineTo(memPoly[i].x, memPoly[i].y);
            }
            memCtx.closePath();
            memCtx.clip();
          }

          const memGrad = memCtx.createRadialGradient(
            mc.xPx,
            mc.yPx,
            0,
            mc.xPx,
            mc.yPx,
            mc.radiusPx
          );
          for (const stop of memStops) {
            memGrad.addColorStop(stop.offset, `rgba(0, 0, 0, ${stop.intensity})`);
          }
          memCtx.fillStyle = memGrad;
          memCtx.beginPath();
          memCtx.arc(mc.xPx, mc.yPx, mc.radiusPx, 0, Math.PI * 2);
          memCtx.fill();

          if (blockingWallsPx.length > 0) {
            memCtx.restore();
          }
        }

        // Erase partial alpha from the pitch-black fog so explored memory areas stay with "a névoa de agora" (~0.64 alpha)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = userRole === 'mestre' ? 0.42 : 0.36;
        ctx.drawImage(memCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
      }
    }

    // 3. Active Vision & Active Light Cutout with Smooth Natural Falloff (d = 0 -> 1.0 down to d = 1 -> 0.0, clipped by 2D Raycast Visibility Polygon!)
    const circles = computeDynamicTokenVisionCircles(
      effectiveTokens,
      gridSize,
      fogViewerOptions
    );
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1.0;

    for (const c of circles) {
      if (c.effectiveRadiusPx <= 0) continue;

      if (blockingWallsPx.length > 0) {
        const poly = computeVisibilityPolygon(
          c.xPx,
          c.yPx,
          c.effectiveRadiusPx,
          blockingWallsPx
        );
        if (poly.length < 3) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();
        ctx.clip();
      }

      const stops = buildSmoothFalloffGradientStops(c.falloff ?? 0.5);
      const grad = ctx.createRadialGradient(
        c.xPx,
        c.yPx,
        0,
        c.xPx,
        c.yPx,
        c.effectiveRadiusPx
      );
      for (const stop of stops) {
        grad.addColorStop(stop.offset, `rgba(0, 0, 0, ${stop.intensity})`);
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.xPx, c.yPx, c.effectiveRadiusPx, 0, Math.PI * 2);
      ctx.fill();

      if (blockingWallsPx.length > 0) {
        ctx.restore();
      }
    }

    // Also cut out any manually GM-revealed fog areas
    for (const poly of scene.nevoaAreasManuais || []) {
      if (poly.revelado) {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(poly.x, poly.y, poly.largura, poly.altura);
      }
    }

    // 4. Draw warm ambient torch/arcane light tint with Smooth Falloff where visible tokens or placed [Luz] emit light (also strictly clipped by walls/closed doors!)
    ctx.globalCompositeOperation = 'source-over';
    for (const c of circles) {
      if (c.lightRadiusPx <= 0) continue;
      if (blockingWallsPx.length > 0) {
        const lightPoly = computeVisibilityPolygon(
          c.xPx,
          c.yPx,
          c.lightRadiusPx,
          blockingWallsPx
        );
        if (lightPoly.length < 3) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(lightPoly[0].x, lightPoly[0].y);
        for (let i = 1; i < lightPoly.length; i++) {
          ctx.lineTo(lightPoly[i].x, lightPoly[i].y);
        }
        ctx.closePath();
        ctx.clip();
      }

      const rgb = hexColorToRgbString(c.lightColor);
      const tintStops = buildSmoothFalloffGradientStops(c.falloff ?? 0.5);
      const lightGrad = ctx.createRadialGradient(
        c.xPx,
        c.yPx,
        0,
        c.xPx,
        c.yPx,
        c.lightRadiusPx
      );
      for (const stop of tintStops) {
        const alpha = Number((0.24 * stop.intensity).toFixed(4));
        lightGrad.addColorStop(stop.offset, `rgba(${rgb}, ${alpha})`);
      }
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.arc(c.xPx, c.yPx, c.lightRadiusPx, 0, Math.PI * 2);
      ctx.fill();

      if (blockingWallsPx.length > 0) {
        ctx.restore();
      }
    }

    ctx.restore();
  }, [
    effectiveTokens,
    scene.nevoaAtiva,
    scene.nevoaAreasManuais,
    sheets,
    mapWidthPx,
    mapHeightPx,
    gridSize,
    userRole,
    fogViewerOptions,
    blockingWallsPx,
  ]);

  // Convert client mouse coordinates to map pixel coordinates
  const clientToMapCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  // Convert pixel coordinate to grid coordinate with optional local magnetic edge pull
  const mapCoordsToPencilGridPoint = (pxX: number, pxY: number): GridPoint => {
    let effX = pxX;
    let effY = pxY;
    if (wallPencilConfig.magneticEnabled && mapImageBufferRef.current) {
      const snapped = snapPointToLocalImageEdge(
        pxX,
        pxY,
        mapImageBufferRef.current,
        wallPencilConfig.magneticRadiusPx
      );
      effX = snapped.xPx;
      effY = snapped.yPx;
    }
    return {
      x: Math.max(0, Math.min(scene.larguraQuadrados, effX / gridSize)),
      y: Math.max(0, Math.min(scene.alturaQuadrados, effY / gridSize)),
    };
  };

  const handleMouseDownCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const coords = clientToMapCoords(e.clientX, e.clientY);

    if (activeTool === 'light') {
      const gridX = Math.max(
        0,
        Math.min(scene.larguraQuadrados - 1, coords.x / gridSize - 0.5)
      );
      const gridY = Math.max(
        0,
        Math.min(scene.alturaQuadrados - 1, coords.y / gridSize - 0.5)
      );
      onPlaceLightToken?.(gridX, gridY);
      return;
    }

    if (activeTool === 'wall' && userRole === 'mestre' && wallSubMode === 'pencil') {
      setShiftHeldDuringPencil(Boolean(e.shiftKey));
      const pt = mapCoordsToPencilGridPoint(coords.x, coords.y);
      activeWallPencilStrokeRef.current = [pt];
      setActiveWallPencilStroke([pt]);
      return;
    }

    if (activeTool === 'wall' || activeTool === 'door') {
      if (userRole === 'mestre') {
        const rawSnapX = Math.max(
          0,
          Math.min(scene.larguraQuadrados, Math.round((coords.x / gridSize) * 2) / 2)
        );
        const rawSnapY = Math.max(
          0,
          Math.min(scene.alturaQuadrados, Math.round((coords.y / gridSize) * 2) / 2)
        );
        const snappedPt = snapPointToExistingWallEndpoints(
          rawSnapX,
          rawSnapY,
          scene.paredes,
          0.35
        );
        setWallDraft({
          x1: snappedPt.x,
          y1: snappedPt.y,
          x2: snappedPt.x,
          y2: snappedPt.y,
          tipo: activeTool === 'door' ? 'porta' : 'parede',
        });
      }
      return;
    }

    if (activeTool === 'measure') {
      setMeasurePoints({
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
      });
      return;
    }

    if (activeTool === 'draw') {
      setCurrentStroke([{ x: coords.x, y: coords.y }]);
      return;
    }

    if (activeTool === 'text') {
      const novoTexto = 'Marcador Tático';
      onAddDrawing({
        id: `draw-${Date.now()}`,
        tipo: 'text',
        pontos: [{ x: coords.x, y: coords.y }],
        cor: '#fde047',
        espessura: 2,
        texto: novoTexto,
        autor: 'Mesa',
      });
      return;
    }

    // Default: start panning if clicking background
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.mapSurface === 'true') {
      onSelectToken(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const coords = clientToMapCoords(clientX, clientY);

    if (activeWallPencilStrokeRef.current.length > 0) {
      if (e.shiftKey !== shiftHeldDuringPencil) {
        setShiftHeldDuringPencil(Boolean(e.shiftKey));
      }
      const pt = mapCoordsToPencilGridPoint(coords.x, coords.y);
      const curr = activeWallPencilStrokeRef.current;
      const last = curr[curr.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.03) {
        const nextStroke = [...curr, pt];
        activeWallPencilStrokeRef.current = nextStroke;
        setActiveWallPencilStroke(nextStroke);
      }
      return;
    }

    if (wallDraft) {
      const rawSnapX = Math.max(
        0,
        Math.min(scene.larguraQuadrados, Math.round((coords.x / gridSize) * 2) / 2)
      );
      const rawSnapY = Math.max(
        0,
        Math.min(scene.alturaQuadrados, Math.round((coords.y / gridSize) * 2) / 2)
      );
      const snappedPt = snapPointToExistingWallEndpoints(
        rawSnapX,
        rawSnapY,
        scene.paredes,
        0.35
      );
      setWallDraft((prev) =>
        prev ? { ...prev, x2: snappedPt.x, y2: snappedPt.y } : null
      );
      return;
    }

    if (draggingTokenId) {
      const token = scene.tokens.find((t) => t.id === draggingTokenId);
      if (token && !token.bloqueado) {
        const rawGridX = coords.x / gridSize - dragOffsetGrid.dx;
        const rawGridY = coords.y / gridSize - dragOffsetGrid.dy;
        const clampedX = Math.max(
          0,
          Math.min(scene.larguraQuadrados - token.larguraQuadrados, rawGridX)
        );
        const clampedY = Math.max(
          0,
          Math.min(scene.alturaQuadrados - token.alturaQuadrados, rawGridY)
        );

        // Coalesce state updates at 60fps via requestAnimationFrame
        if (rafMoveRef.current !== null) {
          cancelAnimationFrame(rafMoveRef.current);
        }
        rafMoveRef.current = requestAnimationFrame(() => {
          rafMoveRef.current = null;
          setLiveDragPos((prev) => {
            const baseMem = prev?.memoriaExplorada ?? token.memoriaExplorada;
            const prevPos = prev ? { x: prev.x, y: prev.y } : { x: token.x, y: token.y };

            // Resolve wall and closed-door collision!
            const resolved = token.ehFonteDeLuz
              ? { x: clampedX, y: clampedY, collided: false }
              : resolveTokenMovementWithWalls(
                  prevPos.x,
                  prevPos.y,
                  clampedX,
                  clampedY,
                  token.larguraQuadrados || 1,
                  token.alturaQuadrados || 1,
                  scene.paredes,
                  Boolean(scene.colisaoParedesAtiva)
                );

            if (resolved.collided) {
              setWallCollisionFlash(true);
            } else {
              setWallCollisionFlash(false);
            }

            const nextMem = recordTokenFogMemoryPath(
              baseMem,
              {
                ...token,
                x: resolved.x,
                y: resolved.y,
              },
              prevPos
            );

            // Throttled lightweight WebSocket broadcast every 50ms
            const now = performance.now();
            if (now - lastLiveBroadcastRef.current > 50) {
              lastLiveBroadcastRef.current = now;
              onMoveToken(
                draggingTokenId,
                Math.round(resolved.x * 100) / 100,
                Math.round(resolved.y * 100) / 100,
                true
              );
            }

            return {
              tokenId: draggingTokenId,
              x: resolved.x,
              y: resolved.y,
              memoriaExplorada: nextMem,
            };
          });
        });
      }
      return;
    }

    if (measurePoints) {
      setMeasurePoints((prev) =>
        prev ? { ...prev, endX: coords.x, endY: coords.y } : null
      );
      return;
    }

    if (currentStroke.length > 0) {
      setCurrentStroke((prev) => [...prev, { x: coords.x, y: coords.y }]);
      return;
    }

    if (isPanning) {
      if (rafMoveRef.current !== null) {
        cancelAnimationFrame(rafMoveRef.current);
      }
      const nextPanX = clientX - panStart.x;
      const nextPanY = clientY - panStart.y;
      rafMoveRef.current = requestAnimationFrame(() => {
        rafMoveRef.current = null;
        onChangePan({
          x: nextPanX,
          y: nextPanY,
        });
      });
    }
  };

  const finishDragIfActive = () => {
    if (rafMoveRef.current !== null) {
      cancelAnimationFrame(rafMoveRef.current);
      rafMoveRef.current = null;
    }
    if (draggingTokenId && liveDragPos) {
      const snapEnabled = scene.snappingAtivo !== false;
      const rawSnapX = snapEnabled
        ? Math.round(liveDragPos.x * 2) / 2
        : Math.round(liveDragPos.x * 100) / 100;
      const rawSnapY = snapEnabled
        ? Math.round(liveDragPos.y * 2) / 2
        : Math.round(liveDragPos.y * 100) / 100;
      const origToken = scene.tokens.find((t) => t.id === draggingTokenId);

      // Ensure final snap also respects walls/closed doors
      const resolvedFinal =
        origToken && !origToken.ehFonteDeLuz
          ? resolveTokenMovementWithWalls(
              liveDragPos.x,
              liveDragPos.y,
              rawSnapX,
              rawSnapY,
              origToken.larguraQuadrados || 1,
              origToken.alturaQuadrados || 1,
              scene.paredes,
              Boolean(scene.colisaoParedesAtiva)
            )
          : { x: rawSnapX, y: rawSnapY, collided: false };

      const finalX = resolvedFinal.x;
      const finalY = resolvedFinal.y;

      if (origToken && !origToken.ehFonteDeLuz && liveDragPos.memoriaExplorada) {
        const finalMem = recordTokenFogMemoryStep(liveDragPos.memoriaExplorada, {
          ...origToken,
          x: finalX,
          y: finalY,
        });
        onUpdateToken({
          ...origToken,
          x: finalX,
          y: finalY,
          memoriaExplorada: finalMem,
        });
      } else {
        onMoveToken(draggingTokenId, finalX, finalY, false);
      }
    }
    setDraggingTokenId(null);
    setLiveDragPos(null);
    setWallCollisionFlash(false);
  };

  const handleMouseUpCanvas = () => {
    if (activeWallPencilStrokeRef.current.length > 0) {
      const finished = activeWallPencilStrokeRef.current;
      activeWallPencilStrokeRef.current = [];
      if (finished.length >= 2) {
        setWallPencilStrokes((prev) => [...prev, finished]);
      }
      setActiveWallPencilStroke([]);
      setShiftHeldDuringPencil(false);
    }
    if (wallDraft) {
      const len = Math.hypot(wallDraft.x2 - wallDraft.x1, wallDraft.y2 - wallDraft.y1);
      if (len >= 0.4 && onAddWallSegment) {
        onAddWallSegment({
          id: `${wallDraft.tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x1: wallDraft.x1,
          y1: wallDraft.y1,
          x2: wallDraft.x2,
          y2: wallDraft.y2,
          tipo: wallDraft.tipo,
          aberta: wallDraft.tipo === 'porta' ? false : undefined,
        });
      }
      setWallDraft(null);
    }
    if (draggingTokenId) {
      finishDragIfActive();
    }
    if (measurePoints) {
      setMeasurePoints(null);
    }
    if (currentStroke.length > 1) {
      onAddDrawing({
        id: `draw-${Date.now()}`,
        tipo: 'freehand',
        pontos: currentStroke,
        cor: '#a78bfa',
        espessura: 4,
        autor: 'Mesa',
      });
      setCurrentStroke([]);
    } else if (currentStroke.length > 0) {
      setCurrentStroke([]);
    }
    setIsPanning(false);
  };

  const handleWheelCanvas = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const nextZoom = Math.min(2.2, Math.max(0.45, Number((zoom + delta).toFixed(2))));
    onChangeZoom(nextZoom);
  };

  const selectedToken = effectiveTokens.find((t) => t.id === selectedTokenId);

  // Calculate distance in feet (5ft per square) when using Measure tool
  const measureDistanceFt = measurePoints
    ? Math.round(
        (Math.hypot(
          measurePoints.endX - measurePoints.startX,
          measurePoints.endY - measurePoints.startY
        ) /
          gridSize) *
          5
      )
    : 0;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMoveCanvas}
      onMouseUp={handleMouseUpCanvas}
      onMouseLeave={handleMouseUpCanvas}
      onWheel={handleWheelCanvas}
      data-testid="tactical-map-viewport"
      data-map-surface="true"
      className="fixed inset-0 bg-[#191a21] overflow-hidden select-none"
      style={{
        cursor:
          draggingTokenId
            ? 'grabbing'
            : activeTool === 'hand' || isPanning
              ? 'grab'
              : activeTool === 'measure' ||
                  activeTool === 'draw' ||
                  activeTool === 'wall' ||
                  activeTool === 'door' ||
                  activeTool === 'light'
                ? 'crosshair'
                : 'default',
      }}
    >
      {/* Transformed Map Plane (60 FPS GPU-Composited) */}
      <div
        data-map-surface="true"
        style={{
          width: `${mapWidthPx}px`,
          height: `${mapHeightPx}px`,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          transition:
            isPanning || draggingTokenId || wallDraft
              ? 'none'
              : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.055) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.055) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
        className="relative bg-[#1d1f27] shadow-2xl border border-zinc-800/80"
      >
        {/* Lossless Map Background Image if uploaded */}
        {scene.fundoUrl && (
          <img
            src={scene.fundoUrl}
            alt={scene.nome}
            data-map-surface="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {/* Subtle Tactical Dungeon Chamber Architecture overlay when no custom background is set */}
        {!scene.fundoUrl && (
          <svg
            viewBox={`0 0 ${mapWidthPx} ${mapHeightPx}`}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-35"
          >
            <rect
              x={gridSize * 3}
              y={gridSize * 2}
              width={gridSize * 20}
              height={gridSize * 12}
              fill="none"
              stroke="#4b5563"
              strokeWidth="4"
              strokeDasharray="16 6"
            />
            <circle cx={gridSize * 12.5} cy={gridSize * 8} r={gridSize * 1.4} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeDasharray="8 6" />
          </svg>
        )}

        {/* Structural Walls (`parede`) and Doors (`porta`) Layer — EXCLUSIVO DO MESTRE (Invisível à visão do Jogador) */}
        {userRole === 'mestre' &&
          scene.colisaoParedesAtiva &&
          (scene.paredes?.length || wallDraft) && (
          <svg
            data-testid="gm-structural-walls-svg"
            viewBox={`0 0 ${mapWidthPx} ${mapHeightPx}`}
            className="absolute inset-0 w-full h-full pointer-events-none z-[15]"
          >
            {(scene.paredes || []).map((seg) => {
              const x1 = seg.x1 * gridSize;
              const y1 = seg.y1 * gridSize;
              const x2 = seg.x2 * gridSize;
              const y2 = seg.y2 * gridSize;

              if (seg.tipo === 'porta') {
                return (
                  <g key={seg.id}>
                    {/* Door Frame Shadow */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#090a0f"
                      strokeWidth={seg.aberta ? 6 : 10}
                      strokeLinecap="round"
                    />
                    {/* Door Leaf */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={seg.aberta ? '#34d399' : '#f59e0b'}
                      strokeWidth={seg.aberta ? 4 : 6}
                      strokeDasharray={seg.aberta ? '6 8' : undefined}
                      strokeLinecap="round"
                    />
                  </g>
                );
              }

              return (
                <g key={seg.id}>
                  {/* Stone Wall Outer Shadow */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#090a0f"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  {/* Stone Wall Inner Ridge */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#64748b"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* Live GM Wall/Door Draft Line */}
            {wallDraft && (
              <line
                x1={wallDraft.x1 * gridSize}
                y1={wallDraft.y1 * gridSize}
                x2={wallDraft.x2 * gridSize}
                y2={wallDraft.y2 * gridSize}
                stroke={wallDraft.tipo === 'porta' ? '#f59e0b' : '#38bdf8'}
                strokeWidth="7"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            )}
          </svg>
        )}

        {/* Freehand & Tactical Drawings SVG Layer */}
        <svg
          viewBox={`0 0 ${mapWidthPx} ${mapHeightPx}`}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          {scene.desenhos.map((d) => {
            if (d.tipo === 'text' && d.pontos[0]) {
              return (
                <text
                  key={d.id}
                  x={d.pontos[0].x}
                  y={d.pontos[0].y}
                  fill={d.cor}
                  fontSize="16"
                  fontWeight="bold"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {d.texto}
                </text>
              );
            }
            const pathData = d.pontos
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
              .join(' ');
            return (
              <path
                key={d.id}
                d={pathData}
                fill="none"
                stroke={d.cor}
                strokeWidth={d.espessura}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {currentStroke.length > 1 && (
            <path
              d={currentStroke.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}

          {/* Ruler / Measure Line */}
          {measurePoints && (
            <g>
              <line
                x1={measurePoints.startX}
                y1={measurePoints.startY}
                x2={measurePoints.endX}
                y2={measurePoints.endY}
                stroke="#fde047"
                strokeWidth="3"
                strokeDasharray="8 6"
              />
              <rect
                x={(measurePoints.startX + measurePoints.endX) / 2 - 42}
                y={(measurePoints.startY + measurePoints.endY) / 2 - 28}
                width="84"
                height="24"
                rx="6"
                fill="#181920"
                stroke="#fde047"
              />
              <text
                x={(measurePoints.startX + measurePoints.endX) / 2}
                y={(measurePoints.startY + measurePoints.endY) / 2 - 12}
                textAnchor="middle"
                fill="#fde047"
                fontSize="12"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
              >
                {measureDistanceFt} ft ({(measureDistanceFt * 0.3).toFixed(1)}m)
              </text>
            </g>
          )}
        </svg>

        {/* Dynamic Fog of War & Token Torch Light Canvas Layer */}
        <canvas
          ref={fogCanvasRef}
          width={mapWidthPx}
          height={mapHeightPx}
          className="absolute inset-0 pointer-events-none z-20"
        />

        {/* Interactive Doors (`Porta` — Abrir / Fechar) & GM Wall Segment Controls Layer */}
        {scene.colisaoParedesAtiva &&
          (scene.paredes || []).map((seg) => {
            const midXPx = ((seg.x1 + seg.x2) / 2) * gridSize;
            const midYPx = ((seg.y1 + seg.y2) / 2) * gridSize;

            if (seg.tipo === 'porta') {
              // Mestre vê todas as portas sempre; Jogador SÓ vê o ícone da porta quando encostar/aproximar o token na porta!
              const playerTouchingDoor = isPlayerTokenTouchingDoor(
                effectiveTokens,
                seg,
                fogViewerOptions
              );
              if (userRole === 'jogador' && !playerTouchingDoor) {
                return null;
              }

              return (
                <div
                  key={`door-ctrl-${seg.id}`}
                  style={{
                    left: `${midXPx}px`,
                    top: `${midYPx}px`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-1"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    data-testid={`map-door-toggle-${seg.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDoorSegment?.(seg.id);
                    }}
                    title={
                      seg.aberta
                        ? 'Porta Aberta (Luz e Tokens passam) — Clique para Fechar'
                        : 'Porta Fechada (Bloqueia Luz e Tokens) — Clique para Abrir'
                    }
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xl border transition-all cursor-pointer ${
                      seg.aberta
                        ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200 hover:bg-emerald-800'
                        : 'bg-amber-950/95 border-amber-400 text-amber-200 hover:bg-amber-800'
                    } ${userRole === 'jogador' ? 'ring-2 ring-amber-300/80 animate-pulse' : ''}`}
                  >
                    {seg.aberta ? (
                      <>
                        <DoorOpen className="w-3.5 h-3.5 text-emerald-300" />
                        <span>{userRole === 'jogador' ? 'Fechar Porta' : 'Aberta'}</span>
                      </>
                    ) : (
                      <>
                        <DoorClosed className="w-3.5 h-3.5 text-amber-300" />
                        <span>{userRole === 'jogador' ? 'Abrir Porta' : 'Fechada'}</span>
                      </>
                    )}
                  </button>

                  {userRole === 'mestre' && (activeTool === 'wall' || activeTool === 'door') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteWallSegment?.(seg.id);
                      }}
                      title="Remover esta porta"
                      className="w-5 h-5 rounded-full bg-rose-900/90 border border-rose-400 text-rose-200 flex items-center justify-center hover:bg-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            }

            // For solid walls (`parede`), show a delete button at midpoint when GM is in 'wall' or 'door' edit tool
            if (userRole === 'mestre' && (activeTool === 'wall' || activeTool === 'door')) {
              return (
                <button
                  key={`wall-del-${seg.id}`}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWallSegment?.(seg.id);
                  }}
                  style={{
                    left: `${midXPx}px`,
                    top: `${midYPx}px`,
                  }}
                  title="Remover este segmento de parede"
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-30 w-5 h-5 rounded-full bg-zinc-900/90 border border-sky-400/70 text-sky-300 hover:bg-rose-700 hover:border-rose-400 hover:text-white flex items-center justify-center shadow cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              );
            }

            return null;
          })}

        {/* Interactive Tokens Layer — Hides tokens outside the Player's OWN token illumination (Only GM sees everything!) */}
        {effectiveTokens.map((token) => {
          const insidePlayerFog = isTokenInsideFog(
            token,
            effectiveTokens,
            sheets,
            scene.nevoaAtiva,
            gridSize,
            fogViewerOptions
          );

          const insideGlobalFogForGmBadge = isTokenInsideFog(
            token,
            effectiveTokens,
            sheets,
            scene.nevoaAtiva,
            gridSize,
            {
              paredes: scene.paredes,
              colisaoParedesAtiva: Boolean(scene.colisaoParedesAtiva),
            }
          );

          // If the user is a Player ('jogador') and the token is outside their OWN token's illumination, hide it!
          if (userRole === 'jogador' && insidePlayerFog) {
            return null;
          }

          const isSelected = token.id === selectedTokenId;
          const isTurnToken = Boolean(
            (activeTurnTokenId && token.id === activeTurnTokenId) ||
              (activeTurnFichaId && token.fichaId === activeTurnFichaId)
          );
          const linkedSheet = token.fichaId
            ? sheets.find((s) => s.id === token.fichaId)
            : undefined;
          const hpCur = linkedSheet?.pvAtual ?? token.pvAtual;
          const hpMax = linkedSheet?.pvMaximo ?? token.pvMaximo;
          const hpTemp = linkedSheet?.pvTemporario ?? 0;
          const acVal = linkedSheet?.classeArmadura ?? token.ca;
          const activeConditions =
            linkedSheet?.condicoes !== undefined
              ? linkedSheet.condicoes
              : token.condicoes || [];
          const hpPercent =
            hpCur !== undefined && hpMax
              ? Math.max(0, Math.min(100, Math.round((hpCur / hpMax) * 100)))
              : null;

          // Special rendering for 100% invisible placed Light Source tokens (`ehFonteDeLuz: true`)
          if (token.ehFonteDeLuz) {
            return (
              <div
                key={token.id}
                data-testid={`light-token-${token.id}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelectToken(token.id);
                  if (!token.bloqueado) {
                    const coords = clientToMapCoords(e.clientX, e.clientY);
                    setDraggingTokenId(token.id);
                    setDragOffsetGrid({
                      dx: coords.x / gridSize - token.x,
                      dy: coords.y / gridSize - token.y,
                    });
                    setLiveDragPos({
                      tokenId: token.id,
                      x: token.x,
                      y: token.y,
                    });
                  }
                }}
                style={{
                  left: `${token.x * gridSize}px`,
                  top: `${token.y * gridSize}px`,
                  width: `${token.larguraQuadrados * gridSize}px`,
                  height: `${token.alturaQuadrados * gridSize}px`,
                  willChange: draggingTokenId === token.id ? 'left, top' : undefined,
                }}
                className="absolute z-30 group cursor-pointer active:cursor-grabbing flex items-center justify-center"
                role="button"
                tabIndex={0}
                title={`Luz (${token.luzQuadrados}q) — Clique para selecionar, aumentar ou diminuir`}
                aria-label={`Fonte de Luz invisível (${token.luzQuadrados} quadrados)`}
              >
                {/* 100% Invisible Token body when unselected; shows dashed selection ring when selected or hovered */}
                <div
                  className={`w-full h-full rounded-full transition-opacity flex items-center justify-center ${
                    isSelected
                      ? 'opacity-100 ring-2 ring-amber-400 bg-amber-500/15 shadow-lg'
                      : activeTool === 'light'
                        ? 'opacity-70 ring-1 ring-amber-400/60 bg-amber-500/10'
                        : 'opacity-0 group-hover:opacity-60 ring-1 ring-amber-400/50 bg-amber-500/10'
                  }`}
                >
                  <Flame className="w-4 h-4 text-amber-300 drop-shadow" />
                </div>

                {/* Floating On-Map +/- Light Radius Controls when this invisible Light is selected */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    data-testid="selected-light-floating-controls"
                    className="absolute -top-11 left-1/2 -translate-x-1/2 z-50 bg-[#181922]/95 border border-amber-500/70 rounded-xl px-2 py-1 shadow-2xl flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <button
                      type="button"
                      data-testid="light-decrease-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateToken({
                          ...token,
                          luzQuadrados: Math.max(0, (token.luzQuadrados || 0) - 1),
                        });
                      }}
                      title="Diminuir alcance da Luz (-1 quadrado)"
                      className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-amber-600/40 text-amber-300 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono font-bold text-amber-300 px-1">
                      💡 {token.luzQuadrados}q
                    </span>
                    <button
                      type="button"
                      data-testid="light-increase-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateToken({
                          ...token,
                          luzQuadrados: Math.min(24, (token.luzQuadrados || 0) + 1),
                        });
                      }}
                      title="Aumentar alcance da Luz (+1 quadrado)"
                      className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-amber-600/40 text-amber-300 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      data-testid="light-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteToken(token.id);
                      }}
                      title="Apagar este ponto de Luz"
                      className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-rose-900/70 text-zinc-400 hover:text-rose-300 flex items-center justify-center cursor-pointer transition-colors ml-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={token.id}
              onMouseDown={(e) => {
                e.stopPropagation();
                const isOwnPlayerToken =
                  userRole === 'mestre' ||
                  token.ehFonteDeLuz ||
                  Boolean(activePlayingSheetId && token.fichaId === activePlayingSheetId);
                if (isOwnPlayerToken) {
                  onSelectToken(token.id);
                }
                if (!token.bloqueado && isOwnPlayerToken) {
                  const coords = clientToMapCoords(e.clientX, e.clientY);
                  setDraggingTokenId(token.id);
                  setDragOffsetGrid({
                    dx: coords.x / gridSize - token.x,
                    dy: coords.y / gridSize - token.y,
                  });
                  setLiveDragPos({
                    tokenId: token.id,
                    x: token.x,
                    y: token.y,
                    memoriaExplorada: recordTokenFogMemoryStep(token.memoriaExplorada, token),
                  });
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (
                  token.fichaId &&
                  (userRole === 'mestre' || token.fichaId === activePlayingSheetId)
                ) {
                  onOpenSheet(token.fichaId);
                }
              }}
              style={{
                left: `${token.x * gridSize}px`,
                top: `${token.y * gridSize}px`,
                width: `${token.larguraQuadrados * gridSize}px`,
                height: `${token.alturaQuadrados * gridSize}px`,
                willChange: draggingTokenId === token.id ? 'left, top' : undefined,
              }}
              className={`absolute z-30 group cursor-grab active:cursor-grabbing ${
                activeTool === 'wall' ||
                activeTool === 'door' ||
                activeTool === 'draw' ||
                activeTool === 'measure'
                  ? 'pointer-events-none'
                  : ''
              } ${
                isSelected ? 'ring-3 ring-violet-400 rounded-full shadow-2xl' : ''
              } ${isTurnToken ? 'ring-3 ring-amber-400 rounded-full' : ''} ${
                insideGlobalFogForGmBadge && userRole === 'mestre'
                  ? 'opacity-75 ring-2 ring-amber-500/80 rounded-full'
                  : ''
              }`}
              role="button"
              tabIndex={0}
              aria-label={`Token ${token.nome} em (${Math.round(token.x)}, ${Math.round(token.y)})`}
            >
              {/* Small Lightbulb Emoji (💡) Above Token When It Is This Token's Turn in Initiative */}
              {isTurnToken && (
                <div
                  className="absolute -top-9 left-1/2 -translate-x-1/2 z-40 px-1.5 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/80 text-[11px] leading-none shadow-lg flex items-center gap-0.5 pointer-events-none animate-bounce"
                  title={`Vez de ${token.nome} na Iniciativa!`}
                  data-testid="turn-lightbulb-indicator"
                >
                  <span>💡</span>
                </div>
              )}

              {/* Token Torch / Light Ring Indicator (Tightly bound to token border so it never spills across walls) */}
              {token.luzQuadrados > 0 && (
                <div
                  className="absolute inset-0 rounded-full pointer-events-none ring-2 ring-amber-400/70"
                />
              )}

              {/* GM-only Badge when token is hidden inside the Fog of War */}
              {insideGlobalFogForGmBadge && userRole === 'mestre' && !isTurnToken && (
                <div
                  className="absolute -top-9 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/70 text-[9px] font-mono text-amber-300 flex items-center gap-0.5 whitespace-nowrap pointer-events-none shadow"
                  title="Este token está dentro da Névoa de Guerra: Oculto para Jogadores (Somente o Mestre vê)"
                >
                  <EyeOff className="w-2.5 h-2.5" /> Na Névoa (Só GM)
                </div>
              )}

              {/* Token Avatar */}
              <img
                src={token.imagemUrl}
                alt={token.nome}
                draggable={false}
                className="w-full h-full rounded-full object-cover border-2 shadow-lg pointer-events-none"
                style={{ borderColor: token.cor || '#8b5cf6' }}
              />

              {/* Visual D&D 5e Status Condition Badges Overlay on Token */}
              {activeConditions.length > 0 && (
                <div
                  className="absolute -right-2 -bottom-1 z-40 flex flex-wrap justify-end gap-0.5 max-w-[78px] pointer-events-auto"
                  data-testid={`token-conditions-${token.id}`}
                >
                  {activeConditions.map((condStr) => {
                    const meta = getConditionMeta(condStr);
                    return (
                      <span
                        key={meta.key}
                        title={`${meta.label} (${meta.englishName}): ${meta.resumo}`}
                        data-testid={`token-condition-badge-${meta.key}`}
                        className="w-5 h-5 rounded-full bg-zinc-950/95 border flex items-center justify-center text-[11px] leading-none shadow-md"
                        style={{
                          borderColor: meta.color,
                          boxShadow: `0 0 6px ${meta.color}88`,
                        }}
                      >
                        {meta.icon}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* HP Bar & AC Badge Above Token */}
              {hpPercent !== null && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-16 flex flex-col items-center pointer-events-none">
                  <div className="w-full h-2 bg-zinc-950/90 rounded-full overflow-hidden border border-zinc-700">
                    <div
                      className={`h-full ${
                        hpPercent > 50
                          ? 'bg-emerald-500'
                          : hpPercent > 25
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      }`}
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-white bg-zinc-950/85 px-1 rounded mt-0.5 tabular-nums whitespace-nowrap">
                    {hpCur}/{hpMax}
                    {hpTemp > 0 ? `+${hpTemp}` : ''} {acVal ? `· CA ${acVal}` : ''}
                  </span>
                </div>
              )}

              {/* Token Name Plate Below */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-zinc-950/90 border border-zinc-700/80 text-[10px] font-semibold text-zinc-100 shadow pointer-events-none">
                {token.nome}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Light Placement Tool Banner */}
      {activeTool === 'light' && (
        <div
          data-testid="active-light-tool-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-950/95 border border-amber-400/80 text-amber-200 px-4 py-1.5 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none"
        >
          <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>
            Modo Adicionar [Luz]: Clique em qualquer lugar do mapa para colocar uma iluminação invisível
          </span>
        </div>
      )}

      {/* Active Wall Pencil Tool Overlay (Riscar e Concluir) for GM */}
      {userRole === 'mestre' && activeTool === 'wall' && (
        <WallPencilToolOverlay
          subMode={wallSubMode}
          onChangeSubMode={setWallSubMode}
          config={wallPencilConfig}
          onChangeConfig={setWallPencilConfig}
          strokeCount={allWallPencilStrokes.length}
          previewSegmentCount={wallPencilOrganized.previewSegments.length}
          hasBackgroundImage={Boolean(scene.fundoUrl)}
          canUndoCommittedBatch={canUndoWallBatch}
          onConcludeStrokes={handleConcludeWallPencil}
          onUndoLastStroke={() =>
            setWallPencilStrokes((prev) => prev.slice(0, -1))
          }
          onCancelStrokes={() => {
            setWallPencilStrokes([]);
            setActiveWallPencilStroke([]);
          }}
          onUndoCommittedWalls={() => onUndoWallBatch?.()}
        />
      )}

      {/* Active Manual Door Drawing Tool Banner (GM only) */}
      {userRole === 'mestre' && activeTool === 'door' && (
        <div
          data-testid="active-wall-tool-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-zinc-950/95 border border-emerald-400/80 text-emerald-200 px-4 py-1.5 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none"
        >
          <DoorOpen className="w-4 h-4 text-emerald-400" />
          <span>
            Modo Adicionar [Porta]: Clique e arraste no mapa para criar uma porta manual
          </span>
        </div>
      )}

      {/* Selected Token Context HUD Popover (Rename, Edit Light/Vision/Size, Conditions, Open Linked Sheet, Delete) */}
      {selectedToken &&
        activeTool !== 'wall' &&
        activeTool !== 'door' &&
        (userRole === 'mestre' ||
          selectedToken.ehFonteDeLuz ||
          Boolean(
            activePlayingSheetId && selectedToken.fichaId === activePlayingSheetId
          )) &&
        (userRole === 'mestre' ||
          selectedToken.ehFonteDeLuz ||
          !isTokenInsideFog(
            selectedToken,
            effectiveTokens,
            sheets,
            scene.nevoaAtiva,
            gridSize,
            fogViewerOptions
          )) && (
          <div
            className="fixed top-3 left-1/2 -translate-x-1/2 lg:left-[284px] lg:right-[456px] lg:translate-x-0 z-30 bg-[#1d1e26]/95 border border-zinc-700 rounded-2xl shadow-2xl px-3 py-1.5 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-100 max-w-[92vw] w-fit mx-auto"
            role="toolbar"
            aria-label={`Controles do token ${selectedToken.nome}`}
          >
            {/* Editable Token Name & Avatar / Light Icon */}
            <div className="flex items-center gap-2 pr-2 border-r border-zinc-700">
              {selectedToken.ehFonteDeLuz ? (
                <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-amber-300" />
                </div>
              ) : (
                <img
                  src={selectedToken.imagemUrl}
                  alt={selectedToken.nome}
                  className="w-7 h-7 rounded-full border shrink-0"
                  style={{ borderColor: selectedToken.cor }}
                />
              )}
              <div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    aria-label="Renomear Token"
                    value={selectedToken.nome}
                    onChange={(e) =>
                      onUpdateToken({
                        ...selectedToken,
                        nome: e.target.value,
                      })
                    }
                    title="Clique para editar o nome"
                    className="font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-600 focus:border-violet-400 focus:outline-none w-28 text-xs"
                  />
                  <Edit3 className="w-3 h-3 text-zinc-400 shrink-0" />
                </div>
                <div className="text-[10px] font-mono text-zinc-400">
                  Pos: ({Math.round(selectedToken.x)}, {Math.round(selectedToken.y)})
                </div>
              </div>
            </div>

            {/* Light Source Radius (Add / Increase / Decrease Luz — Visible to Everyone!) */}
            <div
              className="flex items-center gap-1.5"
              title="Luz (Visível para TODOS os jogadores na Névoa)"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-300">Luz:</span>
              {!selectedToken.ehFonteDeLuz && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateToken({
                      ...selectedToken,
                      luzQuadrados: selectedToken.luzQuadrados > 0 ? 0 : 4,
                    })
                  }
                  className={`px-2 py-1 rounded-lg font-mono font-semibold cursor-pointer ${
                    selectedToken.luzQuadrados > 0
                      ? 'bg-amber-500/25 border border-amber-500/60 text-amber-300'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {selectedToken.luzQuadrados > 0
                    ? `Tocha (${selectedToken.luzQuadrados}q)`
                    : '+ Add Luz'}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onUpdateToken({
                    ...selectedToken,
                    luzQuadrados: Math.max(0, (selectedToken.luzQuadrados || 0) - 1),
                  })
                }
                title="Diminuir Luz (-1 quadrado)"
                className="w-6 h-6 rounded bg-zinc-800 hover:bg-amber-600/30 text-amber-300 flex items-center justify-center cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={0}
                max={24}
                aria-label="Raio de luz em quadrados"
                value={selectedToken.luzQuadrados}
                onChange={(e) =>
                  onUpdateToken({
                    ...selectedToken,
                    luzQuadrados: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-11 px-1.5 py-1 text-center font-mono bg-[#14151c] border border-zinc-700 rounded text-amber-300"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateToken({
                    ...selectedToken,
                    luzQuadrados: Math.min(24, (selectedToken.luzQuadrados || 0) + 1),
                  })
                }
                title="Aumentar Luz (+1 quadrado)"
                className="w-6 h-6 rounded bg-zinc-800 hover:bg-amber-600/30 text-amber-300 flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Smooth Light Falloff Parameter (0 = uniform to 1 = fast decay, default 0.5) */}
            {(selectedToken.luzQuadrados > 0 || selectedToken.visaoQuadrados > 0) && (
              <div
                className="flex items-center gap-1.5 bg-[#14151c] border border-zinc-700/80 rounded-lg px-2 py-1"
                title="Suavidade do Falloff da Luz/Visão (0 = mais uniforme até a borda · 0.5 = natural · 1 = apaga mais rápido)"
              >
                <span className="text-[10px] text-zinc-400">Falloff:</span>
                <input
                  type="range"
                  data-testid="light-falloff-slider"
                  aria-label="Suavidade do falloff da luz"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedToken.luzFalloff ?? 0.5}
                  onChange={(e) =>
                    onUpdateToken({
                      ...selectedToken,
                      luzFalloff: Number(e.target.value),
                    })
                  }
                  className="w-14 accent-amber-400 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-amber-300 tabular-nums">
                  {(selectedToken.luzFalloff ?? 0.5).toFixed(2)}
                </span>
              </div>
            )}

            {!selectedToken.ehFonteDeLuz && (
              <>
                {/* Vision Radius in Fog of War (Exclusive to Own Player & GM) */}
                <div
                  className="flex items-center gap-1.5"
                  title="Visão Exclusiva do Personagem (Somente o próprio jogador e o Mestre veem)"
                >
                  <Eye className="w-4 h-4 text-violet-400" />
                  <span className="text-zinc-300">Visão:</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    aria-label="Raio de visão em quadrados"
                    value={selectedToken.visaoQuadrados}
                    onChange={(e) =>
                      onUpdateToken({
                        ...selectedToken,
                        visaoQuadrados: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-11 px-1.5 py-1 text-center font-mono bg-[#14151c] border border-zinc-700 rounded text-violet-300"
                  />
                </div>

                {/* Quick D&D 5e Conditions Selector on Token HUD */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowHudConditions((p) => !p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer border ${
                      (selectedToken.condicoes?.length || 0) > 0
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                    }`}
                    title="Gerenciar Condições de Status (D&D 5e) no Token"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Condições
                    {(selectedToken.condicoes?.length || 0) > 0
                      ? ` (${selectedToken.condicoes.length})`
                      : ''}
                  </button>
                  {showHudConditions && (
                    <div className="absolute top-9 left-0 z-50 w-72 bg-[#181922] border border-zinc-700 rounded-xl shadow-2xl p-2.5 grid grid-cols-2 gap-1">
                      {DND_CONDITIONS.map((cond) => {
                        const active = hasConditionInList(selectedToken.condicoes, cond.key);
                        return (
                          <button
                            key={cond.key}
                            type="button"
                            onClick={() =>
                              onUpdateToken({
                                ...selectedToken,
                                condicoes: toggleConditionInList(
                                  selectedToken.condicoes,
                                  cond.key
                                ),
                              })
                            }
                            title={`${cond.label}: ${cond.resumo}`}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                              active
                                ? 'bg-zinc-900 text-white border-amber-400'
                                : 'bg-[#12131a] border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span>{cond.icon}</span>
                            <span className="truncate">{cond.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Token Size Selector (1x1, 2x2, 3x3) */}
                {userRole === 'mestre' && (
                  <select
                    aria-label="Tamanho do Token"
                    value={selectedToken.larguraQuadrados}
                    onChange={(e) => {
                      const sz = Number(e.target.value) || 1;
                      onUpdateToken({
                        ...selectedToken,
                        larguraQuadrados: sz,
                        alturaQuadrados: sz,
                      });
                    }}
                    title="Tamanho do Token na Grade"
                    className="bg-[#14151c] border border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono text-zinc-200 cursor-pointer"
                  >
                    <option value={1}>1×1 (5ft)</option>
                    <option value={2}>2×2 (10ft)</option>
                    <option value={3}>3×3 (15ft)</option>
                    <option value={4}>4×4 (20ft)</option>
                  </select>
                )}

                {/* GM Manual Hide Toggle */}
                {userRole === 'mestre' && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateToken({
                        ...selectedToken,
                        ocultoParaJogadores: !selectedToken.ocultoParaJogadores,
                      })
                    }
                    className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer ${
                      selectedToken.ocultoParaJogadores
                        ? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
                        : 'bg-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                    title="Ocultar/Revelar manualmente para os jogadores"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    {selectedToken.ocultoParaJogadores ? 'Invisível' : 'Visível'}
                  </button>
                )}

                {/* Quick HP Adjustment */}
                {selectedToken.pvAtual !== undefined && (
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-emerald-400" />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateToken({
                          ...selectedToken,
                          pvAtual: Math.max(0, (selectedToken.pvAtual || 0) - 2),
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 hover:bg-rose-800 font-mono cursor-pointer"
                    >
                      -2
                    </button>
                    <span className="font-mono text-zinc-200 tabular-nums">
                      {selectedToken.pvAtual}/{selectedToken.pvMaximo}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateToken({
                          ...selectedToken,
                          pvAtual: Math.min(
                            selectedToken.pvMaximo || 99,
                            (selectedToken.pvAtual || 0) + 2
                          ),
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 hover:bg-emerald-800 font-mono cursor-pointer"
                    >
                      +2
                    </button>
                  </div>
                )}

                {/* Open Linked Character Sheet */}
                {selectedToken.fichaId && (
                  <button
                    type="button"
                    onClick={() => onOpenSheet(selectedToken.fichaId!)}
                    className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Ficha 5e
                  </button>
                )}
              </>
            )}

            {/* Lock / Delete Token or Light Source */}
            {(userRole === 'mestre' || selectedToken.ehFonteDeLuz) && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateToken({
                      ...selectedToken,
                      bloqueado: !selectedToken.bloqueado,
                    })
                  }
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                  title={selectedToken.bloqueado ? 'Desbloquear Posição' : 'Bloquear Posição'}
                >
                  {selectedToken.bloqueado ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteToken(selectedToken.id)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-900/60 text-zinc-400 hover:text-rose-300 cursor-pointer"
                  title="Apagar do mapa"
                  aria-label={`Remover ${selectedToken.nome}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
    </div>
  );
};
