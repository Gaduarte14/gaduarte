import React, { useState } from 'react';
import {
  Dices,
  Swords,
  Music,
  EyeOff,
  Send,
  Play,
  Square,
  SkipForward,
  FolderPlus,
  Folder,
  Volume2,
  Repeat,
  Trash2,
  Plus,
  Sparkles,
  Shield,
  Heart,
  FileText,
  Radio,
  AlertCircle,
  Edit3,
  Check,
  Crosshair,
} from 'lucide-react';
import type {
  CharacterSheet,
  CombatLogEntry,
  InitiativeState,
  MapToken,
  MusicFolder,
  MusicTrack,
} from '../types/vtt.ts';
import {
  calculateInitiativeModifier,
  extractYouTubeId,
  formatModifier,
  interpolateSheetVariables,
} from '../utils/dndRules.ts';
import { rollInput, type ParsedRollGroup, type RollMode } from '../utils/engine.ts';
import type { DamageHistoryEntry } from '../utils/dano.ts';

interface RightQuestPortalSidebarProps {
  activeTab: 'chat' | 'iniciativa' | 'musica' | 'fichas';
  onChangeTab: (tab: 'chat' | 'iniciativa' | 'musica' | 'fichas') => void;
  logs: CombatLogEntry[];
  damageHistory: DamageHistoryEntry[];
  sheets: CharacterSheet[];
  activeSheetId: string;
  onSelectActiveSheet: (sheetId: string) => void;
  onOpenFullSheet: (sheetId: string) => void;
  onRenameSheet: (sheetId: string, newName: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  userRole: 'mestre' | 'jogador';
  onPushRoll: (
    rolls: ParsedRollGroup[],
    privadoMestre: boolean,
    rawInput: string
  ) => void;
  onExecuteDamageLine: (rawLine: string, privadoMestre: boolean) => void;
  iniciativa: InitiativeState;
  tokensOnMap: MapToken[];
  onRollTableInitiativeAllTokens: () => void;
  onNextTurn: () => void;
  onFocusTokenOnMap: (tokenId?: string, fichaId?: string) => void;
  onResetInitiative: () => void;
  onUpdateParticipantInitiative: (participantId: string, newTotal: number) => void;
  musicFolders: MusicFolder[];
  musicTracks: MusicTrack[];
  onCreateMusicFolder: (nome: string) => void;
  onAddMusicTrack: (track: Omit<MusicTrack, 'id'>) => void;
  onToggleTrackPlay: (trackId: string) => void;
  onChangeTrackVolume: (trackId: string, volume: number) => void;
  onToggleTrackLoop: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onCloseSidebar: () => void;
}

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd%'] as const;

/**
 * Converte texto de detalhe do Rollem (ex.: "[~3~, 6, 6, 4] + 5") trocando ~valor~ por texto riscado <s>,
 * escapando qualquer conteúdo seguro via nós React (nunca usa dangerouslySetInnerHTML).
 */
function renderRollemDetailWithStrikethrough(detail: string): React.ReactNode {
  const parts = detail.split(/(~[^~]+~)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <s key={idx} className="text-rose-400/80 line-through decoration-rose-400 px-0.5">
          {inner}
        </s>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const RightQuestPortalSidebar: React.FC<RightQuestPortalSidebarProps> = ({
  activeTab,
  onChangeTab,
  logs,
  damageHistory,
  sheets,
  activeSheetId,
  onSelectActiveSheet,
  onOpenFullSheet,
  onRenameSheet,
  onDeleteSheet,
  userRole,
  onPushRoll,
  onExecuteDamageLine,
  iniciativa,
  tokensOnMap,
  onRollTableInitiativeAllTokens,
  onNextTurn,
  onFocusTokenOnMap,
  onResetInitiative,
  onUpdateParticipantInitiative,
  musicFolders,
  musicTracks,
  onCreateMusicFolder,
  onAddMusicTrack,
  onToggleTrackPlay,
  onChangeTrackVolume,
  onToggleTrackLoop,
  onDeleteTrack,
  onCloseSidebar,
}) => {
  // Rollem Dice Chat States (Section 5 & 6)
  const [diceInput, setDiceInput] = useState('');
  const [diceMode, setDiceMode] = useState<RollMode>(null);
  const [rollError, setRollError] = useState<string>('');
  const [rollPrivateGM, setRollPrivateGM] = useState(false);
  const [filterLogType, setFilterLogType] = useState<'todos' | 'combate' | 'privado'>('todos');

  // Damage / Healing / VDT Bar States (dano.ts)
  const [damageInput, setDamageInput] = useState('');
  const [damageError, setDamageError] = useState('');

  // Inline sheet rename state in Fichas tab
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameSheetText, setRenameSheetText] = useState('');

  // Music Player States
  const [selectedMusicFolderId, setSelectedMusicFolderId] = useState<string | null>(null);
  const [newMusicFolderName, setNewMusicFolderName] = useState('');
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [newTrackType, setNewTrackType] = useState<'musica' | 'ambiente' | 'efeito'>('musica');
  const [musicError, setMusicError] = useState('');

  const activeSheet = sheets.find((s) => s.id === activeSheetId) || sheets[0];

  // Toggle Advantage / Disadvantage: NEVER rolls when clicked, only arms/disarms mode!
  const handleToggleMode = (targetMode: 'adv' | 'dis') => {
    setDiceMode((prev) => (prev === targetMode ? null : targetMode));
  };

  // Execute roll via pure engine.ts rollInput(text, mode)
  const executeRollText = (rawText: string) => {
    try {
      const textWithVars =
        rawText.includes('{') && activeSheet
          ? interpolateSheetVariables(rawText, activeSheet)
          : rawText;

      const parsedRolls = rollInput(textWithVars, diceMode);
      setRollError('');
      onPushRoll(parsedRolls, rollPrivateGM, rawText);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fórmula inválida';
      setRollError(`Não entendi: ${msg}`);
      return false;
    }
  };

  const handleDiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = executeRollText(diceInput);
    if (ok) {
      setDiceInput('');
    }
  };

  // Execute Damage / Heal (`cu`) / Temporary HP (`vdt`) / Resistance (`R`) line via dano.ts
  const handleDamageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onExecuteDamageLine(damageInput, rollPrivateGM);
      setDamageError('');
      setDamageInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro ao aplicar efeito';
      setDamageError(msg);
    }
  };

  // Quick dice buttons (d4, d6, d8, d10, d12, d20, d%) roll immediately on click using current diceMode
  const handleQuickDieClick = (dieToken: string) => {
    executeRollText(dieToken);
  };

  const handleAddTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ytId = extractYouTubeId(newTrackUrl);
    if (!newTrackTitle.trim() || !ytId) {
      setMusicError(
        'Informe um título e um link válido do YouTube (ex: youtube.com/watch?v=... ou youtu.be/...).'
      );
      return;
    }
    setMusicError('');
    onAddMusicTrack({
      titulo: newTrackTitle.trim(),
      pastaId: selectedMusicFolderId,
      youtubeUrl: newTrackUrl.trim(),
      youtubeId: ytId,
      tipoSom: newTrackType,
      tocando: true,
      volume: 65,
      loop: true,
    });
    setNewTrackTitle('');
    setNewTrackUrl('');
  };

  // Filter & show last 40 rolls ordered by ts
  const visibleLogs = logs
    .filter((log) => {
      if (log.privadoMestre && userRole !== 'mestre') return false;
      if (filterLogType === 'privado') return log.privadoMestre;
      if (filterLogType === 'combate') {
        return [
          'ataque',
          'salvaguarda',
          'iniciativa',
          'magia',
          'dano',
          'cura',
          'macro',
        ].includes(log.tipoAcao);
      }
      return true;
    })
    .slice(0, 40);

  const currentlyPlayingTracks = musicTracks.filter((t) => t.tocando);
  const filteredTracks = musicTracks.filter((t) =>
    selectedMusicFolderId ? t.pastaId === selectedMusicFolderId : true
  );

  return (
    <aside
      className="fixed top-16 right-4 bottom-20 w-96 max-w-[92vw] z-30 bg-[#181922]/95 border border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
      aria-label="Painel Lateral Quest Portal"
    >
      {/* Top Segmented Navigation */}
      <div className="flex items-center justify-between px-2.5 py-2 bg-[#20222e] border-b border-zinc-800">
        <div className="grid grid-cols-4 gap-1 bg-[#14151c] p-1 rounded-xl border border-zinc-800 flex-1">
          <button
            type="button"
            onClick={() => onChangeTab('chat')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'chat' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Dices className="w-3.5 h-3.5 shrink-0" />
            <span>Dados</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('iniciativa')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'iniciativa'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5 shrink-0" />
            <span>Iniciativa</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('musica')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'musica' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5 shrink-0" />
            <span>Música ({currentlyPlayingTracks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('fichas')}
            className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'fichas' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Fichas</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCloseSidebar}
          className="ml-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
          title="Recolher Painel Lateral"
        >
          ✕
        </button>
      </div>

      {/* Active Character Quick Bar */}
      {activeSheet && (
        <div className="px-3 py-2 bg-[#1c1d28] border-b border-zinc-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-zinc-400">Rolando como:</span>
            <select
              aria-label="Selecionar Personagem Ativo para Rolagem"
              value={activeSheet.id}
              onChange={(e) => onSelectActiveSheet(e.target.value)}
              className="bg-[#12131a] border border-zinc-700 rounded-lg px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:border-violet-500 truncate"
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomePersonagem}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => onOpenFullSheet(activeSheet.id)}
            className="px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/40 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
          >
            Abrir Ficha 5e
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: ROLLEM DICE CHAT & DAMAGE / HEAL / VDT ENGINE                  */}
      {/* ===================================================================== */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Log Filter Bar */}
          <div className="px-3 py-1.5 bg-[#15161e] border-b border-zinc-800/80 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterLogType('todos')}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                  filterLogType === 'todos' ? 'bg-zinc-700 text-white' : 'text-zinc-400'
                }`}
              >
                Todos ({visibleLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterLogType('combate')}
                className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                  filterLogType === 'combate' ? 'bg-zinc-700 text-white' : 'text-zinc-400'
                }`}
              >
                Combate
              </button>
              {userRole === 'mestre' && (
                <button
                  type="button"
                  onClick={() => setFilterLogType('privado')}
                  className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 cursor-pointer ${
                    filterLogType === 'privado'
                      ? 'bg-amber-500/30 text-amber-200'
                      : 'text-amber-400/80'
                  }`}
                >
                  <EyeOff className="w-3 h-3" /> Ocultos (GM)
                </button>
              )}
            </div>
            <span className="text-zinc-500 font-mono text-[10px]">Rollem + Dano</span>
          </div>

          {/* Scrollable Rollem Log List (Last 40 Rolls) */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-2.5"
            role="log"
            aria-label="Histórico de Rolagens Rollem"
          >
            {visibleLogs.map((entry) => {
              const displayName = entry.name || entry.personagemNome || entry.autorNome;
              const displayColor = entry.color || entry.autorCor || '#8b5cf6';
              const timeStr = new Date(entry.ts || entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              const rollGroups: ParsedRollGroup[] =
                entry.rolls && entry.rolls.length > 0
                  ? entry.rolls
                  : [
                      {
                        label: entry.titulo || '',
                        formula: entry.formulaResolvida || entry.formulaOriginal,
                        results: [
                          {
                            t: entry.resultadoFinal,
                            d:
                              entry.dadosIndividuais.length > 0
                                ? `[${entry.dadosIndividuais
                                    .map((d) => (d.descartado ? `~${d.valor}~` : String(d.valor)))
                                    .join(', ')}]${
                                    entry.modificadorTotal !== 0
                                      ? entry.modificadorTotal > 0
                                        ? ` + ${entry.modificadorTotal}`
                                        : ` - ${Math.abs(entry.modificadorTotal)}`
                                      : ''
                                  }`
                                : String(entry.resultadoFinal),
                          },
                        ],
                      },
                    ];

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl p-3 border transition-all ${
                    entry.privadoMestre
                      ? 'bg-amber-950/25 border-amber-500/40'
                      : 'bg-[#20222e] border-zinc-800'
                  }`}
                >
                  {/* Header: Player colored dot + Name + Time + Private GM badge */}
                  <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: displayColor }}
                      />
                      <span className="font-bold text-white truncate">{displayName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry.privadoMestre && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                          <EyeOff className="w-2.5 h-2.5" /> GM Privado
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 font-mono">{timeStr}</span>
                    </div>
                  </div>

                  {/* Each Roll Group from rollInput */}
                  <div className="space-y-2">
                    {rollGroups.map((group, gIdx) => (
                      <div
                        key={gIdx}
                        className="bg-[#14151c]/90 rounded-lg p-2.5 border border-zinc-800/80"
                      >
                        {group.label && (
                          <div className="text-xs font-bold text-violet-300 mb-1">
                            {group.label}
                          </div>
                        )}

                        <div className="space-y-1">
                          {group.results.map((res, rIdx) => (
                            <div
                              key={rIdx}
                              className="flex items-baseline justify-between gap-2 font-mono"
                            >
                              <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                                <span className="text-lg font-extrabold text-white tabular-nums">
                                  {res.t}
                                </span>
                                <span className="text-xs text-zinc-400 break-all">
                                  <span className="font-sans text-zinc-500 mr-1" aria-hidden="true">
                                    ←
                                  </span>
                                  {renderRollemDetailWithStrikethrough(res.d)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-1 text-[10px] font-mono text-zinc-500">
                          {group.formula}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Extra Details or Damage Breakdown */}
                  {entry.detalhesTexto && (
                    <div className="mt-1.5 text-[11px] font-mono text-emerald-300/90 bg-[#14151c] px-2.5 py-1.5 rounded-lg border border-zinc-800">
                      {entry.detalhesTexto}
                    </div>
                  )}

                  {entry.danoExtra && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs bg-rose-950/30 px-2.5 py-1.5 rounded-lg border border-rose-500/20 font-mono">
                      <span className="text-rose-200">
                        Dano ({entry.danoExtra.tipo}): {entry.danoExtra.formula}{' '}
                        {entry.danoExtra.detalhe || `[${entry.danoExtra.dados.join(', ')}]`}
                      </span>
                      <span className="font-bold text-rose-300 text-sm">
                        {entry.danoExtra.total}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rollem Controls Dock + Dano/Cura/VDT Automatic Sheet Applier */}
          <div className="p-2.5 bg-[#20222e] border-t border-zinc-800 space-y-2">
            {/* Row 1: Quick Dice (Roll Immediately) */}
            <div className="grid grid-cols-7 gap-1">
              {QUICK_DICE.map((die) => (
                <button
                  key={die}
                  type="button"
                  onClick={() => handleQuickDieClick(die)}
                  title={`Rolar ${die} agora${
                    diceMode === 'adv'
                      ? ' (com Vantagem)'
                      : diceMode === 'dis'
                        ? ' (com Desvantagem)'
                        : ''
                  }`}
                  className="py-1 rounded-lg bg-[#14151c] hover:bg-violet-600 text-zinc-200 hover:text-white text-[11px] font-mono font-bold border border-zinc-800 transition-colors cursor-pointer"
                >
                  {die}
                </button>
              ))}
            </div>

            {/* Row 2: Vantagem & Desvantagem Mode Toggles (Arm Only, Do NOT Roll!) + Private GM Toggle */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                aria-pressed={diceMode === 'adv'}
                onClick={() => handleToggleMode('adv')}
                className={`py-1 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  diceMode === 'adv'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/50'
                    : 'bg-[#14151c] text-emerald-400 border-zinc-800 hover:border-emerald-500/50'
                }`}
              >
                Vantagem
              </button>

              <button
                type="button"
                aria-pressed={diceMode === 'dis'}
                onClick={() => handleToggleMode('dis')}
                className={`py-1 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  diceMode === 'dis'
                    ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-950/50'
                    : 'bg-[#14151c] text-rose-400 border-zinc-800 hover:border-rose-500/50'
                }`}
              >
                Desvantagem
              </button>

              <button
                type="button"
                aria-pressed={rollPrivateGM}
                onClick={() => setRollPrivateGM((prev) => !prev)}
                className={`py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                  rollPrivateGM
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-[#14151c] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Rolagem Oculta (Apenas o Mestre vê)"
              >
                <EyeOff className="w-3 h-3 shrink-0" />
                <span className="truncate">{rollPrivateGM ? 'GM Oculto' : 'Público'}</span>
              </button>
            </div>

            {/* Row 3: Rollem Formula Input + Rolar Button */}
            <form onSubmit={handleDiceSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label="Fórmula de Dados Rollem"
                placeholder="Ex: 4#1d20+10 ataque, 4d6dl1, [d20+5 espada]"
                value={diceInput}
                onChange={(e) => {
                  setDiceInput(e.target.value);
                  if (rollError) setRollError('');
                }}
                className="flex-1 bg-[#14151c] border border-zinc-700 focus:border-violet-500 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Rolar</span>
              </button>
            </form>

            {rollError && (
              <div
                role="alert"
                className="flex items-center gap-1.5 text-xs text-rose-400 font-medium px-1"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{rollError}</span>
              </div>
            )}

            {/* Row 4: Sistema de Dano, Cura (cu), Vida Temporária (vdt) e Resistência (R) direto nas Fichas */}
            <form
              onSubmit={handleDamageSubmit}
              className="pt-1.5 border-t border-zinc-800/90 space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400 px-0.5">
                <span className="font-semibold text-rose-300 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400" /> Dano / Cura (cu) / VDT / Resistência (R)
                </span>
                <span className="font-mono text-zinc-500">Ex: 1d10+5 elara R</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label="Comando de Dano, Cura ou Vida Temporária"
                  placeholder="Ex: 1d10+5 elara R, 1d8+4 cu thorin, 2d6 vdt elara"
                  value={damageInput}
                  onChange={(e) => {
                    setDamageInput(e.target.value);
                    if (damageError) setDamageError('');
                  }}
                  className="flex-1 bg-[#14151c] border border-zinc-700 focus:border-rose-500 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Aplicar
                </button>
              </div>
              {damageError && (
                <div
                  role="alert"
                  className="flex items-center gap-1.5 text-xs text-rose-400 font-medium px-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{damageError}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: INTEGRATED INITIATIVE TRACKER WITH CAMERA FOCUS & LIGHTBULB 💡 */}
      {/* ===================================================================== */}
      {activeTab === 'iniciativa' && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
          {/* 1-Click Auto-Add & Roll All Table Tokens Button */}
          <div className="bg-[#20222e] border border-zinc-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Ordem de Combate ({iniciativa.participantes.length})
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Rodada {iniciativa.rodada} · Foca câmera em todos + 💡 no turno
                </p>
              </div>
              {iniciativa.ativo && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Em Combate
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onRollTableInitiativeAllTokens}
              className="w-full py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Adicionar Tokens da Mesa e Rolar {'{iniciativa}'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onNextTurn}
                disabled={iniciativa.participantes.length === 0}
                className="flex-1 py-1.5 px-3 rounded-lg bg-[#282b3a] hover:bg-violet-600 disabled:opacity-40 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" /> Próximo Turno (Focar 💡)
              </button>
              <button
                type="button"
                onClick={onResetInitiative}
                className="py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 text-xs transition-colors cursor-pointer"
                title="Limpar Iniciativa"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Sorted Participants List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {iniciativa.participantes.length === 0 ? (
              <div className="text-center py-8 px-4 bg-[#14151c] rounded-xl border border-zinc-800/80 text-xs text-zinc-400">
                Clique no botão acima para puxar todos os tokens de personagens e monstros da mesa
                ({tokensOnMap.filter((t) => t.categoria === 'character').length} tokens no mapa) e
                rolar automaticamente `1d20 + {'{iniciativa}'}` nas fichas!
              </div>
            ) : (
              iniciativa.participantes.map((part, idx) => {
                const isCurrentTurn = iniciativa.ativo && idx === iniciativa.turnoIndice;
                if (part.oculto && userRole !== 'mestre') return null;

                return (
                  <div
                    key={part.id}
                    onClick={() => onFocusTokenOnMap(part.tokenId, part.fichaId)}
                    className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isCurrentTurn
                        ? 'bg-amber-950/30 border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-[#20222e] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <img
                          src={part.avatarUrl}
                          alt={part.nome}
                          className="w-10 h-10 rounded-full object-cover bg-zinc-900 border-2"
                          style={{ borderColor: part.cor }}
                        />
                        {isCurrentTurn && (
                          <span
                            className="absolute -top-1.5 -right-1.5 text-xs leading-none"
                            title="Vez deste personagem na iniciativa"
                          >
                            💡
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{part.nome}</span>
                          {isCurrentTurn && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-400/50 font-bold">
                              💡 Vez Atual
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <Heart className="w-3 h-3" /> {part.pvAtual}/{part.pvMaximo}
                          </span>
                          <span className="flex items-center gap-0.5 text-sky-400">
                            <Shield className="w-3 h-3" /> CA {part.ca}
                          </span>
                          {part.dadoRolado > 0 && (
                            <span className="text-zinc-500">
                              (d20:{part.dadoRolado}
                              {formatModifier(part.modificadorIniciativa)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total Initiative Score Badge (Editable) */}
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onFocusTokenOnMap(part.tokenId, part.fichaId)}
                        className="p-1.5 rounded-lg bg-[#14151c] hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                        title={`Focar câmera no token de ${part.nome}`}
                        aria-label={`Focar em ${part.nome}`}
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex flex-col items-end">
                        <input
                          type="number"
                          aria-label={`Iniciativa de ${part.nome}`}
                          value={part.iniciativaTotal}
                          onChange={(e) =>
                            onUpdateParticipantInitiative(part.id, Number(e.target.value) || 0)
                          }
                          className="w-12 py-1 text-center rounded-lg bg-[#14151c] border border-zinc-700 font-mono font-bold text-sm text-amber-300 focus:outline-none focus:border-violet-500"
                        />
                        <span className="text-[9px] text-zinc-500 uppercase font-mono mt-0.5">
                          Iniciativa
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: BACKGROUND MULTI-TRACK YOUTUBE AUDIO MIXER WITH FOLDERS        */}
      {/* ===================================================================== */}
      {activeTab === 'musica' && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
          <div className="bg-[#20222e] border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio
                className={`w-4 h-4 ${
                  currentlyPlayingTracks.length > 0
                    ? 'text-emerald-400 animate-pulse'
                    : 'text-zinc-500'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-white">Motor de Áudio em Segundo Plano</div>
                <div className="text-[10px] text-zinc-400">
                  Áudio oculto (sem vídeo). Continua tocando se fechar a aba ou painel.
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] shrink-0">
              {currentlyPlayingTracks.length} ativa(s)
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedMusicFolderId(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                  selectedMusicFolderId === null
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#20222e] text-zinc-300 hover:text-white'
                }`}
              >
                Todas ({musicTracks.length})
              </button>
              {musicFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedMusicFolderId(folder.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                    selectedMusicFolderId === folder.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#20222e] text-zinc-300 hover:text-white'
                  }`}
                >
                  <Folder className="w-3 h-3 text-amber-400" />
                  {folder.nome}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newMusicFolderName.trim()) return;
                onCreateMusicFolder(newMusicFolderName.trim());
                setNewMusicFolderName('');
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                placeholder="Criar nova pasta de música..."
                value={newMusicFolderName}
                onChange={(e) => setNewMusicFolderName(e.target.value)}
                className="flex-1 bg-[#14151c] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-[#252733] hover:bg-violet-600 text-xs font-medium text-zinc-200 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" /> Nova Pasta
              </button>
            </form>
          </div>

          <form
            onSubmit={handleAddTrackSubmit}
            className="bg-[#20222e] border border-zinc-800 rounded-xl p-2.5 space-y-2"
          >
            <div className="text-[11px] font-bold text-zinc-300">
              Adicionar Link do YouTube na Pasta
            </div>
            <input
              type="text"
              placeholder="Título da faixa (ex: Chuva na Floresta / Boss Theme)"
              value={newTrackTitle}
              onChange={(e) => setNewTrackTitle(e.target.value)}
              className="w-full bg-[#14151c] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Cole o link do YouTube (watch?v=... ou youtu.be/...)"
                value={newTrackUrl}
                onChange={(e) => setNewTrackUrl(e.target.value)}
                className="flex-1 bg-[#14151c] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
              <select
                value={newTrackType}
                onChange={(e) =>
                  setNewTrackType(e.target.value as 'musica' | 'ambiente' | 'efeito')
                }
                className="bg-[#14151c] border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
              >
                <option value="musica">Música</option>
                <option value="ambiente">Ambiente</option>
                <option value="efeito">Efeito</option>
              </select>
            </div>
            {musicError && <p className="text-[11px] text-rose-400">{musicError}</p>}
            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Áudio do YouTube
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredTracks.map((track) => (
              <div
                key={track.id}
                className={`rounded-xl p-2.5 border transition-all ${
                  track.tocando
                    ? 'bg-violet-950/30 border-violet-500/60'
                    : 'bg-[#20222e] border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {track.tocando && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      )}
                      <span className="text-xs font-bold text-white truncate">{track.titulo}</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">
                      Camada: {track.tipoSom} · Áudio em 2º Plano
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleTrackPlay(track.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                        track.tocando
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#14151c] text-zinc-300 hover:text-white border border-zinc-700'
                      }`}
                      title={
                        track.tocando ? 'Pausar faixa' : 'Tocar faixa (suporta múltiplas ao mesmo tempo)'
                      }
                    >
                      {track.tocando ? (
                        <>
                          <Square className="w-3 h-3" /> Tocando
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" /> Tocar
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleTrackLoop(track.id)}
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        track.loop
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                          : 'bg-[#14151c] border-zinc-800 text-zinc-500'
                      }`}
                      title="Repetir em Loop"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrack(track.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 cursor-pointer"
                      title="Remover faixa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={track.volume}
                    onChange={(e) => onChangeTrackVolume(track.id, Number(e.target.value))}
                    className="flex-1 accent-violet-500 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-zinc-300 w-8 text-right">
                    {track.volume}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SAVED CHARACTER SHEETS, RENAME/DELETE & DAMAGE LOG             */}
      {/* ===================================================================== */}
      {activeTab === 'fichas' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {sheets.map((sheet) => {
            const initMod = calculateInitiativeModifier(sheet);
            const isRenaming = renamingSheetId === sheet.id;
            return (
              <div
                key={sheet.id}
                className="bg-[#20222e] border border-zinc-800 rounded-xl p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img
                      src={sheet.avatarUrl}
                      alt={sheet.nomePersonagem}
                      className="w-11 h-11 rounded-full object-cover bg-zinc-900 border-2 shrink-0"
                      style={{ borderColor: sheet.corToken }}
                    />
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            aria-label="Novo nome do personagem"
                            value={renameSheetText}
                            onChange={(e) => setRenameSheetText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && renameSheetText.trim()) {
                                onRenameSheet(sheet.id, renameSheetText.trim());
                                setRenamingSheetId(null);
                              }
                            }}
                            autoFocus
                            className="w-full bg-[#14151c] border border-violet-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (renameSheetText.trim()) {
                                onRenameSheet(sheet.id, renameSheetText.trim());
                              }
                              setRenamingSheetId(null);
                            }}
                            className="p-1 rounded bg-emerald-600 text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-white truncate">
                            {sheet.nomePersonagem}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingSheetId(sheet.id);
                              setRenameSheetText(sheet.nomePersonagem);
                            }}
                            className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                            title="Alterar nome do personagem"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="text-xs text-zinc-400 truncate">
                        {sheet.raca} · {sheet.classeNivel}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenFullSheet(sheet.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      Editar Ficha
                    </button>
                    {userRole === 'mestre' && sheets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSheet(sheet.id)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-900/60 text-zinc-400 hover:text-rose-300 cursor-pointer"
                        title={`Apagar ficha de ${sheet.nomePersonagem}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center bg-[#14151c] p-2 rounded-lg border border-zinc-800/80 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">PV</span>
                    <span className="text-emerald-400 font-bold">
                      {sheet.pvAtual}/{sheet.pvMaximo}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">PV Temp</span>
                    <span className="text-amber-300 font-bold">+{sheet.pvTemporario || 0}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">CA</span>
                    <span className="text-sky-400 font-bold">{sheet.classeArmadura}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">{'{iniciativa}'}</span>
                    <span className="text-violet-400 font-bold">{formatModifier(initMod)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Recent Damage / Healing / VDT Applications History */}
          {damageHistory.length > 0 && (
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Últimas Aplicações de Dano / Cura / VDT
              </div>
              {damageHistory.slice(0, 8).map((h) => (
                <div
                  key={h.id}
                  className="bg-[#14151c] border border-zinc-800 rounded-xl p-2.5 text-xs font-mono space-y-1"
                >
                  {h.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="text-zinc-200 truncate">
                        <strong>{it.targetDisplayName}</strong> ({it.effect.kind.toUpperCase()}){' '}
                        {it.effect.hasR ? '[R]' : ''}
                      </span>
                      <span className="text-amber-300 shrink-0">
                        PV {it.report.antes.pv}→{it.report.depois.pv} · Temp {it.report.antes.temp}→
                        {it.report.depois.temp}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
