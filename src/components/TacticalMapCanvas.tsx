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
} from 'lucide-react';
import type { CharacterSheet, MapDrawing, MapScene, MapToken } from '../types/vtt.ts';
import {
  DND_CONDITIONS,
  computeDynamicTokenVisionCircles,
  getConditionMeta,
  hasConditionInList,
  isTokenInsideFog,
  toggleConditionInList,
} from '../utils/dndRules.ts';

export type ActiveMapTool = 'hand' | 'select' | 'fog' | 'draw' | 'measure' | 'pointer' | 'text';

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
  onOpenSheet: (sheetId: string) => void;
  onAddDrawing: (drawing: MapDrawing) => void;
  onToggleSceneFog: () => void;
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
  onOpenSheet,
  onAddDrawing,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dragging state for pan or 60fps zero-lag token movement
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [dragOffsetGrid, setDragOffsetGrid] = useState({ dx: 0, dy: 0 });
  const [liveDragPos, setLiveDragPos] = useState<{
    tokenId: string;
    x: number;
    y: number;
  } | null>(null);
  const lastLiveBroadcastRef = useRef<number>(0);

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

  // Combine scene tokens with 60fps liveDragPos so the dragged token and its fog/light move instantaneously with the mouse
  const effectiveTokens = useMemo(() => {
    if (!liveDragPos) return scene.tokens;
    return scene.tokens.map((t) =>
      t.id === liveDragPos.tokenId ? { ...t, x: liveDragPos.x, y: liveDragPos.y } : t
    );
  }, [scene.tokens, liveDragPos]);

  const fogViewerOptions = useMemo(
    () => ({
      viewerRole: userRole,
      viewerSheetId: activePlayingSheetId || null,
      viewerTokenId: selectedTokenId || null,
    }),
    [userRole, activePlayingSheetId, selectedTokenId]
  );

  // Render Dynamic Fog of War & Token Torch Light on Canvas whenever tokens move!
  // - Mestre ('mestre'): sees everything (semi-transparent fog + all tokens' vision/light circles).
  // - Jogador ('jogador'): ONLY sees where their OWN character's token illuminates! Other players' tokens do not reveal fog for them.
  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, mapWidthPx, mapHeightPx);

    if (!scene.nevoaAtiva) return;

    // 1. Fill map with Owlbear atmospheric fog:
    //    - Mestre sees through the fog (0.58 alpha) so they see the entire map and all tokens.
    //    - Jogador gets opaque fog (0.96 alpha) so they only see where their own token illuminates.
    ctx.save();
    ctx.fillStyle =
      userRole === 'mestre' ? 'rgba(10, 11, 16, 0.58)' : 'rgba(7, 8, 12, 0.96)';
    ctx.fillRect(0, 0, mapWidthPx, mapHeightPx);

    // 2. Cut out vision and light circles dynamically based on viewer role & player's own token
    const circles = computeDynamicTokenVisionCircles(
      effectiveTokens,
      gridSize,
      fogViewerOptions
    );
    ctx.globalCompositeOperation = 'destination-out';

    for (const c of circles) {
      if (c.effectiveRadiusPx <= 0) continue;
      const grad = ctx.createRadialGradient(
        c.xPx,
        c.yPx,
        c.effectiveRadiusPx * 0.55,
        c.xPx,
        c.yPx,
        c.effectiveRadiusPx
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(0.82, 'rgba(0, 0, 0, 0.92)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.xPx, c.yPx, c.effectiveRadiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    // Also cut out any manually GM-revealed fog areas
    for (const poly of scene.nevoaAreasManuais || []) {
      if (poly.revelado) {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(poly.x, poly.y, poly.largura, poly.altura);
      }
    }

    // 3. Draw warm ambient torch/arcane light tint where visible tokens emit light
    ctx.globalCompositeOperation = 'source-over';
    for (const c of circles) {
      if (c.lightRadiusPx <= 0) continue;
      const lightGrad = ctx.createRadialGradient(
        c.xPx,
        c.yPx,
        4,
        c.xPx,
        c.yPx,
        c.lightRadiusPx
      );
      lightGrad.addColorStop(0, `${c.lightColor}33`);
      lightGrad.addColorStop(0.6, `${c.lightColor}18`);
      lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.arc(c.xPx, c.yPx, c.lightRadiusPx, 0, Math.PI * 2);
      ctx.fill();
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
  ]);

  // Convert client mouse coordinates to map pixel coordinates
  const clientToMapCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  const handleMouseDownCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const coords = clientToMapCoords(e.clientX, e.clientY);

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
    const coords = clientToMapCoords(e.clientX, e.clientY);

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

        // Update local position immediately at 60fps (no step-freeze, no localStorage overhead)
        setLiveDragPos({
          tokenId: draggingTokenId,
          x: clampedX,
          y: clampedY,
        });

        // Throttled lightweight WebSocket broadcast every 50ms
        const now = performance.now();
        if (now - lastLiveBroadcastRef.current > 50) {
          lastLiveBroadcastRef.current = now;
          onMoveToken(
            draggingTokenId,
            Math.round(clampedX * 100) / 100,
            Math.round(clampedY * 100) / 100,
            true
          );
        }
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
      onChangePan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const finishDragIfActive = () => {
    if (draggingTokenId && liveDragPos) {
      const snapEnabled = scene.snappingAtivo !== false;
      const finalX = snapEnabled
        ? Math.round(liveDragPos.x * 2) / 2
        : Math.round(liveDragPos.x * 100) / 100;
      const finalY = snapEnabled
        ? Math.round(liveDragPos.y * 2) / 2
        : Math.round(liveDragPos.y * 100) / 100;
      onMoveToken(draggingTokenId, finalX, finalY, false);
    }
    setDraggingTokenId(null);
    setLiveDragPos(null);
  };

  const handleMouseUpCanvas = () => {
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
              : activeTool === 'measure' || activeTool === 'draw'
                ? 'crosshair'
                : 'default',
      }}
    >
      {/* Transformed Map Plane */}
      <div
        data-map-surface="true"
        style={{
          width: `${mapWidthPx}px`,
          height: `${mapHeightPx}px`,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
          transition:
            isPanning || draggingTokenId
              ? 'none'
              : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
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
              x={gridSize * 4}
              y={gridSize * 3}
              width={gridSize * 14}
              height={gridSize * 9}
              fill="none"
              stroke="#4b5563"
              strokeWidth="6"
              strokeDasharray="16 6"
            />
            <circle cx={gridSize * 7} cy={gridSize * 5} r={16} fill="#374151" stroke="#9ca3af" strokeWidth="3" />
            <circle cx={gridSize * 15} cy={gridSize * 5} r={16} fill="#374151" stroke="#9ca3af" strokeWidth="3" />
            <circle cx={gridSize * 7} cy={gridSize * 10} r={16} fill="#374151" stroke="#9ca3af" strokeWidth="3" />
            <circle cx={gridSize * 15} cy={gridSize * 10} r={16} fill="#374151" stroke="#9ca3af" strokeWidth="3" />
            <circle
              cx={gridSize * 11}
              cy={gridSize * 7.5}
              r={gridSize * 1.6}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2.5"
              strokeDasharray="8 6"
            />
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
            gridSize
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

          return (
            <div
              key={token.id}
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
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (token.fichaId) {
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

              {/* Token Torch / Light Halo Indicator (Visible to everyone because it is a torch light!) */}
              {token.luzQuadrados > 0 && (
                <div
                  className="absolute -inset-2 rounded-full pointer-events-none animate-pulse"
                  style={{
                    boxShadow: `0 0 24px 6px ${token.luzCor || '#f59e0b'}55`,
                  }}
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

      {/* Selected Token Context HUD Popover (Rename, Edit Light/Vision/Size, Conditions, Open Linked Sheet, Delete) */}
      {selectedToken &&
        (userRole === 'mestre' ||
          !isTokenInsideFog(
            selectedToken,
            effectiveTokens,
            sheets,
            scene.nevoaAtiva,
            gridSize,
            fogViewerOptions
          )) && (
          <div
            className="fixed top-3 left-1/2 -translate-x-1/2 z-30 bg-[#1d1e26]/95 border border-zinc-700 rounded-2xl shadow-2xl px-3.5 py-2 flex flex-wrap items-center gap-2.5 text-xs text-zinc-100 max-w-[92vw]"
            role="toolbar"
            aria-label={`Controles do token ${selectedToken.nome}`}
          >
            {/* Editable Token Name & Avatar */}
            <div className="flex items-center gap-2 pr-2 border-r border-zinc-700">
              <img
                src={selectedToken.imagemUrl}
                alt={selectedToken.nome}
                className="w-7 h-7 rounded-full border shrink-0"
                style={{ borderColor: selectedToken.cor }}
              />
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
                    title="Clique para editar o nome do token"
                    className="font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-600 focus:border-violet-400 focus:outline-none w-32 text-xs"
                  />
                  <Edit3 className="w-3 h-3 text-zinc-400 shrink-0" />
                </div>
                <div className="text-[10px] font-mono text-zinc-400">
                  Pos: ({Math.round(selectedToken.x)}, {Math.round(selectedToken.y)})
                </div>
              </div>
            </div>

            {/* Light Source Radius (Add Torch / Luz ao Personagem — Visible to Everyone!) */}
            <div
              className="flex items-center gap-1.5"
              title="Luz de Tocha (Visível para TODOS os jogadores na Névoa)"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-300">Luz:</span>
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
              <input
                type="number"
                min={0}
                max={16}
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
            </div>

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

            {/* Lock / Delete Token */}
            {userRole === 'mestre' && (
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
                  title={selectedToken.bloqueado ? 'Desbloquear Token' : 'Bloquear Posição'}
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
                  title="Apagar token do mapa"
                  aria-label={`Remover token ${selectedToken.nome}`}
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
