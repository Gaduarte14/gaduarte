import React, { useState } from 'react';
import {
  Pencil,
  Check,
  X,
  Undo2,
  Magnet,
  SlidersHorizontal,
  Grid,
  Minus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import type { WallPencilConfig } from '../utils/wallPencilEngine.ts';

export type WallDrawSubMode = 'pencil' | 'line';

interface WallPencilToolOverlayProps {
  subMode: WallDrawSubMode;
  onChangeSubMode: (mode: WallDrawSubMode) => void;
  config: WallPencilConfig;
  onChangeConfig: (next: WallPencilConfig) => void;
  strokeCount: number;
  previewSegmentCount: number;
  hasBackgroundImage: boolean;
  canUndoCommittedBatch: boolean;
  onConcludeStrokes: () => void;
  onUndoLastStroke: () => void;
  onCancelStrokes: () => void;
  onUndoCommittedWalls: () => void;
}

export const WallPencilToolOverlay: React.FC<WallPencilToolOverlayProps> = ({
  subMode,
  onChangeSubMode,
  config,
  onChangeConfig,
  strokeCount,
  previewSegmentCount,
  hasBackgroundImage,
  canUndoCommittedBatch,
  onConcludeStrokes,
  onUndoLastStroke,
  onCancelStrokes,
  onUndoCommittedWalls,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(true);

  return (
    <div
      data-testid="wall-pencil-tool-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed top-3 left-[252px] right-[435px] mx-auto z-40 max-w-[540px] bg-[#161822]/95 border border-sky-500/60 rounded-2xl shadow-2xl px-3.5 py-2 text-xs text-zinc-100 backdrop-blur-md"
    >
      {/* Top Row: Mode Switcher + Main Action Buttons (Concluir / Desfazer traço / Cancelar / Ctrl+Z) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-[#0f1017] p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            data-testid="wall-submode-pencil-btn"
            onClick={() => onChangeSubMode('pencil')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              subMode === 'pencil'
                ? 'bg-sky-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Modo Lápis: risque livremente uma ou mais paredes no mapa e clique em Concluir para organizar"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Lápis (Riscar e Concluir)</span>
          </button>

          <button
            type="button"
            data-testid="wall-submode-line-btn"
            onClick={() => onChangeSubMode('line')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              subMode === 'line'
                ? 'bg-sky-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Modo Linha Reta imediata: clique e arraste para criar 1 parede reta na hora"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Linha Reta</span>
          </button>
        </div>

        {/* Action Buttons for Pencil Mode */}
        <div className="flex items-center gap-1.5">
          {subMode === 'pencil' && (
            <>
              <button
                type="button"
                data-testid="wall-pencil-conclude-btn"
                disabled={previewSegmentCount === 0}
                onClick={onConcludeStrokes}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  previewSegmentCount > 0
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
                title="Converter os rabiscos organizados em paredes definitivas no mapa"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  Concluir{previewSegmentCount > 0 ? ` (${previewSegmentCount})` : ''}
                </span>
              </button>

              <button
                type="button"
                data-testid="wall-pencil-undo-stroke-btn"
                disabled={strokeCount === 0}
                onClick={onUndoLastStroke}
                className={`px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                  strokeCount > 0
                    ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
                title="Desfazer o último traço riscado antes de concluir"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Último traço</span>
              </button>

              <button
                type="button"
                data-testid="wall-pencil-cancel-btn"
                disabled={strokeCount === 0}
                onClick={onCancelStrokes}
                className={`px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                  strokeCount > 0
                    ? 'bg-rose-950/70 hover:bg-rose-900 border-rose-500/50 text-rose-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
                title="Cancelar e limpar todos os traços atuais sem criar paredes"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </>
          )}

          {canUndoCommittedBatch && (
            <button
              type="button"
              data-testid="wall-pencil-undo-batch-btn"
              onClick={onUndoCommittedWalls}
              className="px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/50 text-amber-200 transition-colors cursor-pointer"
              title="Desfazer a última conclusão de paredes (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ctrl+Z</span>
            </button>
          )}

          {subMode === 'pencil' && (
            <button
              type="button"
              onClick={() => setShowAdvanced((p) => !p)}
              title="Mostrar/ocultar ajustes de organização do lápis"
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
            >
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Status Hint Line */}
      {subMode === 'pencil' && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
          <span>
            {strokeCount === 0
              ? '✏️ Risque uma ou mais paredes no mapa — o preview organizado aparece em tempo real. Depois clique em Concluir.'
              : `${strokeCount} traço(s) riscado(s) → ${previewSegmentCount} segmento(s) retos e conectados prontos para Concluir.`}
          </span>
        </div>
      )}

      {/* Collapsible Controls for the 5-Step Pipeline + Optional Magnetic Pencil */}
      {subMode === 'pencil' && showAdvanced && (
        <div className="mt-2.5 pt-2.5 border-t border-zinc-800/90 space-y-2.5">
          {/* Row 1: Sliders for Simplification, Angle Tolerance, Snap Radius, Min Length */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <label className="flex flex-col gap-1 bg-[#10121a] border border-zinc-800 rounded-xl p-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 text-sky-400" />
                  Simplificação
                </span>
                <span className="font-mono text-sky-300">
                  {config.simplifyToleranceSquares.toFixed(2)}q
                </span>
              </div>
              <input
                type="range"
                aria-label="Nível de simplificação"
                min={0.04}
                max={0.5}
                step={0.02}
                value={config.simplifyToleranceSquares}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    simplifyToleranceSquares: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-400 cursor-pointer"
              />
            </label>

            <label className="flex flex-col gap-1 bg-[#10121a] border border-zinc-800 rounded-xl p-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Ângulo Reto</span>
                <span className="font-mono text-sky-300">
                  {config.angleSnapToleranceDeg}°
                </span>
              </div>
              <input
                type="range"
                aria-label="Tolerância de ângulo"
                min={0}
                max={20}
                step={1}
                value={config.angleSnapToleranceDeg}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    angleSnapToleranceDeg: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-400 cursor-pointer"
              />
            </label>

            <label className="flex flex-col gap-1 bg-[#10121a] border border-zinc-800 rounded-xl p-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Raio de Encaixe</span>
                <span className="font-mono text-sky-300">
                  {config.weldRadiusSquares.toFixed(2)}q
                </span>
              </div>
              <input
                type="range"
                aria-label="Raio de encaixe (snap)"
                min={0.1}
                max={0.85}
                step={0.05}
                value={config.weldRadiusSquares}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    weldRadiusSquares: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-400 cursor-pointer"
              />
            </label>

            <label className="flex flex-col gap-1 bg-[#10121a] border border-zinc-800 rounded-xl p-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Tam. Mínimo</span>
                <span className="font-mono text-sky-300">
                  {config.minSegmentLengthSquares.toFixed(2)}q
                </span>
              </div>
              <input
                type="range"
                aria-label="Tamanho mínimo de segmento"
                min={0.15}
                max={1.0}
                step={0.05}
                value={config.minSegmentLengthSquares}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    minSegmentLengthSquares: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-400 cursor-pointer"
              />
            </label>
          </div>

          {/* Row 2: Toggles (Alinhar ao grid, Diagonais 45°, Linha reta, Lápis Magnético opcional) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10121a] border border-zinc-800 text-[11px] text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.snapToGrid}
                  onChange={(e) =>
                    onChangeConfig({ ...config, snapToGrid: e.target.checked })
                  }
                  className="rounded border-zinc-600 text-sky-500"
                />
                <Grid className="w-3 h-3 text-sky-400" />
                <span>Alinhar ao grid</span>
              </label>

              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10121a] border border-zinc-800 text-[11px] text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.snap45Deg}
                  onChange={(e) =>
                    onChangeConfig({ ...config, snap45Deg: e.target.checked })
                  }
                  className="rounded border-zinc-600 text-sky-500"
                />
                <span>Diagonais 45°</span>
              </label>

              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10121a] border border-zinc-800 text-[11px] text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.forceStraightLine}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      forceStraightLine: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-600 text-sky-500"
                />
                <span>Forçar linha reta (ou Shift)</span>
              </label>
            </div>

            {/* Optional Magnetic Pencil */}
            <div className="flex items-center gap-2 bg-[#10121a] border border-zinc-800 rounded-lg px-2.5 py-1">
              <label
                className="flex items-center gap-1.5 text-[11px] text-zinc-200 cursor-pointer"
                title={
                  hasBackgroundImage
                    ? 'Puxa levemente o traço para a borda escura/contraste da imagem do mapa apenas ao redor do cursor'
                    : 'Adicione uma imagem de mapa à cena para usar o ajuste magnético de borda local'
                }
              >
                <input
                  type="checkbox"
                  data-testid="wall-pencil-magnetic-toggle"
                  checked={config.magneticEnabled}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      magneticEnabled: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-600 text-violet-500"
                />
                <Magnet className="w-3.5 h-3.5 text-violet-400" />
                <span>Lápis Magnético</span>
              </label>

              {config.magneticEnabled && (
                <div className="flex items-center gap-1.5 pl-1 border-l border-zinc-800">
                  <input
                    type="range"
                    aria-label="Raio do lápis magnético"
                    min={6}
                    max={28}
                    step={2}
                    value={config.magneticRadiusPx}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        magneticRadiusPx: Number(e.target.value),
                      })
                    }
                    className="w-16 accent-violet-400 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-violet-300">
                    {config.magneticRadiusPx}px
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
