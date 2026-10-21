import React, { useState } from 'react';
import {
  X,
  Dices,
  EyeOff,
  Plus,
  Trash2,
  Shield,
  Heart,
  Zap,
  Sparkles,
  BookOpen,
  ScrollText,
  Swords,
  Upload,
} from 'lucide-react';
import type {
  AbilityKey,
  CharacterAttack,
  CharacterMacro,
  CharacterSheet,
  InventoryItem,
  SpellEntry,
} from '../types/vtt.ts';
import {
  ABILITY_LABELS,
  DND_CONDITIONS,
  DND_SKILLS,
  calculateAbilityModifier,
  calculateInitiativeModifier,
  calculatePassivePerception,
  calculateSavingThrowBonus,
  calculateSkillBonus,
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  formatModifier,
  getConditionMeta,
  hasConditionInList,
  toggleConditionInList,
} from '../utils/dndRules.ts';

interface CharacterSheetDrawerProps {
  sheet: CharacterSheet;
  onUpdateSheet: (updated: CharacterSheet) => void;
  onRollFromSheet: (params: {
    sheet: CharacterSheet;
    tipoAcao: 'ataque' | 'salvaguarda' | 'pericia' | 'atributo' | 'iniciativa' | 'magia' | 'macro';
    titulo: string;
    formula: string;
    danoFormula?: string;
    tipoDano?: string;
    privadoMestre: boolean;
    detalhesTexto?: string;
  }) => void;
  onClose: () => void;
}

const ABILITY_ORDER: AbilityKey[] = [
  'forca',
  'destreza',
  'constituicao',
  'inteligencia',
  'sabedoria',
  'carisma',
];

export const CharacterSheetDrawer: React.FC<CharacterSheetDrawerProps> = ({
  sheet,
  onUpdateSheet,
  onRollFromSheet,
  onClose,
}) => {
  const [activePage, setActivePage] = useState<'page1' | 'page2' | 'page3'>('page1');
  const [rollPrivateDefault, setRollPrivateDefault] = useState<boolean>(false);

  // New Macro State
  const [newMacroName, setNewMacroName] = useState('');
  const [newMacroFormula, setNewMacroFormula] = useState('1d20+{destreza_mod}+{proficiencia}');
  const [newMacroDamage, setNewMacroDamage] = useState('');
  const [newMacroDesc, setNewMacroDesc] = useState('');

  // New Attack State
  const [newAttackName, setNewAttackName] = useState('');
  const [newAttackBonus, setNewAttackBonus] = useState('+6');
  const [newAttackDamage, setNewAttackDamage] = useState('1d8+4');
  const [newAttackType, setNewAttackType] = useState('Cortante');

  // New Inventory Item State
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemWeight, setNewItemWeight] = useState('1 kg');

  // New Spell State
  const [newSpellName, setNewSpellName] = useState('');
  const [newSpellLevel, setNewSpellLevel] = useState(1);
  const [newSpellDamage, setNewSpellDamage] = useState('');

  const updateField = <K extends keyof CharacterSheet>(field: K, value: CharacterSheet[K]) => {
    onUpdateSheet({
      ...sheet,
      [field]: value,
      atualizadoEm: Date.now(),
    });
  };

  const handleAbilityChange = (ability: AbilityKey, score: number) => {
    onUpdateSheet({
      ...sheet,
      atributos: {
        ...sheet.atributos,
        [ability]: Math.max(1, Math.min(30, Number(score) || 10)),
      },
      atualizadoEm: Date.now(),
    });
  };

  const toggleSaveProficiency = (ability: AbilityKey) => {
    onUpdateSheet({
      ...sheet,
      salvaguardasProficiencia: {
        ...sheet.salvaguardasProficiencia,
        [ability]: !sheet.salvaguardasProficiencia[ability],
      },
      atualizadoEm: Date.now(),
    });
  };

  const toggleSkillProficiency = (skillKey: keyof CharacterSheet['periciasProficiencia']) => {
    const nextProf = !sheet.periciasProficiencia[skillKey];
    const currentExp = sheet.periciasEspecializacao || ({} as Record<string, boolean>);
    onUpdateSheet({
      ...sheet,
      periciasProficiencia: {
        ...sheet.periciasProficiencia,
        [skillKey]: nextProf,
      },
      periciasEspecializacao: {
        ...currentExp,
        [skillKey]: nextProf ? Boolean(currentExp[skillKey]) : false,
      } as Record<keyof CharacterSheet['periciasProficiencia'], boolean>,
      atualizadoEm: Date.now(),
    });
  };

  const toggleSkillExpertise = (skillKey: keyof CharacterSheet['periciasProficiencia']) => {
    const currentExp = sheet.periciasEspecializacao || ({} as Record<string, boolean>);
    const nextExp = !currentExp[skillKey];
    onUpdateSheet({
      ...sheet,
      periciasProficiencia: {
        ...sheet.periciasProficiencia,
        [skillKey]: nextExp ? true : sheet.periciasProficiencia[skillKey],
      },
      periciasEspecializacao: {
        ...currentExp,
        [skillKey]: nextExp,
      } as Record<keyof CharacterSheet['periciasProficiencia'], boolean>,
      atualizadoEm: Date.now(),
    });
  };

  const handleAddAttack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttackName.trim()) return;
    const atk: CharacterAttack = {
      id: `atk-${Date.now()}`,
      nome: newAttackName.trim(),
      bonusAtaque: newAttackBonus.trim() || '+5',
      danoFormula: newAttackDamage.trim() || '1d6+2',
      tipoDano: newAttackType.trim() || 'Cortante',
      alcance: '1,5m',
    };
    updateField('ataques', [...sheet.ataques, atk]);
    setNewAttackName('');
  };

  const handleAddMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMacroName.trim() || !newMacroFormula.trim()) return;
    const mac: CharacterMacro = {
      id: `mac-${Date.now()}`,
      nome: newMacroName.trim(),
      formula: newMacroFormula.trim(),
      danoFormula: newMacroDamage.trim() || undefined,
      descricao: newMacroDesc.trim() || undefined,
      privadoPadrao: rollPrivateDefault,
    };
    updateField('macros', [...sheet.macros, mac]);
    setNewMacroName('');
    setNewMacroDamage('');
    setNewMacroDesc('');
  };

  const handleAddInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const item: InventoryItem = {
      id: `inv-${Date.now()}`,
      nome: newItemName.trim(),
      quantidade: Math.max(1, Number(newItemQty) || 1),
      peso: newItemWeight.trim() || '0,5 kg',
      equipado: true,
    };
    updateField('inventario', [...sheet.inventario, item]);
    setNewItemName('');
    setNewItemQty(1);
  };

  const handleAddSpell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpellName.trim()) return;
    const sp: SpellEntry = {
      id: `sp-${Date.now()}`,
      nome: newSpellName.trim(),
      nivel: Number(newSpellLevel) || 0,
      preparada: true,
      formulaDano: newSpellDamage.trim() || undefined,
    };
    updateField('magias', [...sheet.magias, sp]);
    setNewSpellName('');
    setNewSpellDamage('');
  };

  const handleLosslessAppearanceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateSheet({
          ...sheet,
          aparenciaUrl: reader.result,
          avatarUrl: reader.result,
          atualizadoEm: Date.now(),
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const initMod = calculateInitiativeModifier(sheet);
  const passivePerception = calculatePassivePerception(sheet);
  const spellDC = calculateSpellSaveDC(sheet);
  const spellAtk = calculateSpellAttackBonus(sheet);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-2 md:p-5 overflow-y-auto"
      role="dialog"
      aria-label={`Ficha D&D 5e de ${sheet.nomePersonagem}`}
    >
      <div className="w-full max-w-6xl bg-[#16171f] border border-zinc-700/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top D&D 5e Official Header Banner */}
        <div className="bg-[#1e202b] border-b border-zinc-800 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <label className="relative group cursor-pointer shrink-0" title="Clique para enviar retrato sem perda de qualidade">
              <img
                src={sheet.avatarUrl || sheet.aparenciaUrl}
                alt={sheet.nomePersonagem}
                className="w-14 h-14 rounded-xl object-cover border-2"
                style={{ borderColor: sheet.corToken || '#8b5cf6' }}
              />
              <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-[10px] text-white font-semibold transition-opacity">
                Trocar
              </span>
              <input type="file" accept="image/*" onChange={handleLosslessAppearanceUpload} className="hidden" />
            </label>

            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Nome do Personagem"
                  value={sheet.nomePersonagem}
                  onChange={(e) => updateField('nomePersonagem', e.target.value)}
                  className="text-xl font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-violet-500 focus:outline-none"
                  style={{ fontFamily: 'Cinzel, serif' }}
                />
                <span className="text-xs text-zinc-400 font-mono">· DUNGEONS & DRAGONS 5E</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 mt-1.5 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 block">CLASSE E NÍVEL</span>
                  <input
                    type="text"
                    aria-label="Classe e Nível"
                    value={sheet.classeNivel}
                    onChange={(e) => updateField('classeNivel', e.target.value)}
                    className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 w-full"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-violet-300 font-semibold block">SUBCLASSE</span>
                  <input
                    type="text"
                    aria-label="Subclasse"
                    placeholder="Ex: Evocação, Campeão..."
                    value={sheet.subclasse || ''}
                    onChange={(e) => updateField('subclasse', e.target.value)}
                    className="bg-[#14151c] border border-violet-500/40 rounded px-2 py-0.5 text-violet-200 w-full"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">ANTECEDENTE</span>
                  <input
                    type="text"
                    value={sheet.antecedente}
                    onChange={(e) => updateField('antecedente', e.target.value)}
                    className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 w-full"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">NOME DO JOGADOR</span>
                  <input
                    type="text"
                    value={sheet.nomeJogador}
                    onChange={(e) => updateField('nomeJogador', e.target.value)}
                    className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 w-full"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">RAÇA</span>
                  <input
                    type="text"
                    value={sheet.raca}
                    onChange={(e) => updateField('raca', e.target.value)}
                    className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 w-full"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">TENDÊNCIA</span>
                  <input
                    type="text"
                    value={sheet.tendencia}
                    onChange={(e) => updateField('tendencia', e.target.value)}
                    className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 w-full"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">EXPERIÊNCIA (XP)</span>
                  <input
                    type="number"
                    value={sheet.experiencia}
                    onChange={(e) => updateField('experiencia', Number(e.target.value) || 0)}
                    className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 font-mono tabular-nums w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Page Tabs + Roll Mode Toggle + Close */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Global Roll Mode toggle inside sheet */}
            <button
              type="button"
              onClick={() => setRollPrivateDefault((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                rollPrivateDefault
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                  : 'bg-[#14151c] border-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title="Alternar modo padrão de rolagem (Público no Chat vs Privado do Mestre)"
            >
              <EyeOff className="w-3.5 h-3.5" />
              {rollPrivateDefault ? 'Modo: Rolar no Privado (GM)' : 'Modo: Rolar Público'}
            </button>

            <div className="flex items-center bg-[#14151c] p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setActivePage('page1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activePage === 'page1' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                1. Atributos & Combate
              </button>
              <button
                type="button"
                onClick={() => setActivePage('page2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activePage === 'page2' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                2. História & Aparência
              </button>
              <button
                type="button"
                onClick={() => setActivePage('page3')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activePage === 'page3' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ScrollText className="w-3.5 h-3.5" />
                3. Grimório & Magias
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Ficha de Personagem"
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sheet Body — Scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {activePage === 'page1' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Column 1 (4 cols): 6 Ability Scores + Saving Throws + 18 Skills */}
              <div className="lg:col-span-4 grid grid-cols-12 gap-3">
                {/* Left Vertical Strip: 6 Ability Scores */}
                <div className="col-span-4 space-y-2.5">
                  {ABILITY_ORDER.map((ability) => {
                    const score = sheet.atributos[ability];
                    const mod = calculateAbilityModifier(score);
                    const info = ABILITY_LABELS[ability];
                    return (
                      <div
                        key={ability}
                        className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-2.5 text-center flex flex-col items-center shadow-inner"
                      >
                        <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400">
                          {info.nome}
                        </span>
                        <input
                          type="number"
                          aria-label={`Valor de ${info.nome}`}
                          value={score}
                          onChange={(e) => handleAbilityChange(ability, Number(e.target.value))}
                          className="w-14 text-center text-xl font-bold font-mono tabular-nums text-white bg-transparent border-b border-zinc-700 focus:border-violet-500 focus:outline-none my-1"
                        />
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              onRollFromSheet({
                                sheet,
                                tipoAcao: 'atributo',
                                titulo: `Teste de ${info.nome}`,
                                formula: `1d20${formatModifier(mod)}`,
                                privadoMestre: rollPrivateDefault,
                              })
                            }
                            className="px-2.5 py-0.5 rounded-full bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/40 text-xs font-mono font-bold tabular-nums transition-colors cursor-pointer"
                            title={`Rolar Teste de ${info.nome} no chat`}
                          >
                            {formatModifier(mod)}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRollFromSheet({
                                sheet,
                                tipoAcao: 'atributo',
                                titulo: `Teste de ${info.nome} (Privado GM)`,
                                formula: `1d20${formatModifier(mod)}`,
                                privadoMestre: true,
                              })
                            }
                            className="p-1 rounded bg-zinc-800 hover:bg-amber-600/30 text-zinc-400 hover:text-amber-300 transition-colors"
                            title={`Rolar ${info.nome} em Privado para o Mestre`}
                            aria-label={`Rolar ${info.nome} privado`}
                          >
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Passive Wisdom (Perception) Box */}
                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-mono font-bold text-amber-400 tabular-nums">
                      {passivePerception}
                    </div>
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase leading-tight mt-0.5">
                      Sabedoria Passiva (Percepção)
                    </div>
                  </div>
                </div>

                {/* Right Sub-Column (8 cols): Inspiration, Proficiency, Saving Throws, 18 Skills */}
                <div className="col-span-8 space-y-3">
                  {/* Inspiration & Proficiency Bonus */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateField('inspiracao', !sheet.inspiracao)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                        sheet.inspiracao
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                          : 'bg-[#1d1f2a] border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <span className="text-xs font-semibold">Inspiração</span>
                      <Sparkles className="w-4 h-4" />
                    </button>

                    <div className="bg-[#1d1f2a] border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300">Proficiência</span>
                      <input
                        type="number"
                        aria-label="Bônus de Proficiência"
                        value={sheet.bonusProficiencia}
                        onChange={(e) => updateField('bonusProficiencia', Number(e.target.value) || 2)}
                        className="w-10 text-right font-mono font-bold text-sm text-violet-400 bg-transparent focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  {/* TESTES DE RESISTÊNCIA (SAVING THROWS) — Public + Private GM Roll Buttons */}
                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Testes de Resistência (Salvaguardas)
                      </h3>
                      <span className="text-[10px] text-zinc-400">Chat / GM</span>
                    </div>
                    <div className="space-y-1.5">
                      {ABILITY_ORDER.map((ability) => {
                        const isProf = sheet.salvaguardasProficiencia[ability];
                        const totalBonus = calculateSavingThrowBonus(sheet, ability);
                        const label = ABILITY_LABELS[ability].nome;
                        return (
                          <div
                            key={ability}
                            className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isProf}
                                onChange={() => toggleSaveProficiency(ability)}
                                aria-label={`Proficiência em Salvaguarda de ${label}`}
                                className="rounded-full border-zinc-600 text-violet-600 focus:ring-0 cursor-pointer"
                              />
                              <span className="text-xs font-mono font-bold text-violet-300 w-7 tabular-nums">
                                {formatModifier(totalBonus)}
                              </span>
                              <span className="text-xs text-zinc-200 truncate">{label}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  onRollFromSheet({
                                    sheet,
                                    tipoAcao: 'salvaguarda',
                                    titulo: `Salvaguarda de ${label}`,
                                    formula: `1d20${formatModifier(totalBonus)}`,
                                    privadoMestre: rollPrivateDefault,
                                  })
                                }
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600/25 hover:bg-violet-600 text-violet-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                                title={`Rolar Salvaguarda de ${label} no Chat de Dados`}
                              >
                                <Dices className="w-3 h-3" />
                                Rolar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onRollFromSheet({
                                    sheet,
                                    tipoAcao: 'salvaguarda',
                                    titulo: `Salvaguarda de ${label} (Privado Mestre)`,
                                    formula: `1d20${formatModifier(totalBonus)}`,
                                    privadoMestre: true,
                                  })
                                }
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-amber-600/30 text-zinc-400 hover:text-amber-300 text-[10px] font-medium transition-colors cursor-pointer"
                                title={`Rolar Salvaguarda de ${label} em Privado para o Mestre`}
                                aria-label={`Rolar Salvaguarda de ${label} em Privado`}
                              >
                                <EyeOff className="w-3 h-3" />
                                GM
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PERÍCIAS (18 SKILLS WITH 2 CHECKBOXES: PROFICIENTE + EXPERTISE 2X) */}
                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                          Perícias (18 Perícias D&D)
                        </h3>
                        <span className="text-[10px] text-zinc-400">
                          1º Quadrado: Proficiente · 2º Quadrado: Expertise (2× Prof)
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400">Chat / GM</span>
                    </div>
                    <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
                      {DND_SKILLS.map((skill) => {
                        const isProf = Boolean(sheet.periciasProficiencia[skill.key]);
                        const isExp = Boolean(sheet.periciasEspecializacao?.[skill.key]);
                        const bonus = calculateSkillBonus(sheet, skill.key);
                        return (
                          <div
                            key={skill.key}
                            className="flex items-center justify-between gap-1 py-1 px-1.5 rounded hover:bg-zinc-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isProf}
                                onChange={() => toggleSkillProficiency(skill.key)}
                                aria-label={`Proficiência em ${skill.label}`}
                                title="1º Quadrado: Proficiente (+Proficiência)"
                                className="rounded border-zinc-600 accent-violet-600 focus:ring-0 cursor-pointer"
                              />
                              <input
                                type="checkbox"
                                checked={isExp}
                                onChange={() => toggleSkillExpertise(skill.key)}
                                aria-label={`Expertise em ${skill.label}`}
                                title="2º Quadrado: Expertise (Dobra o bônus de Proficiência!)"
                                className="rounded border-amber-500/80 accent-amber-500 focus:ring-0 cursor-pointer"
                              />
                              <span
                                className={`text-xs font-mono font-bold w-7 tabular-nums ${
                                  isExp
                                    ? 'text-amber-300'
                                    : isProf
                                      ? 'text-emerald-400'
                                      : 'text-zinc-300'
                                }`}
                              >
                                {formatModifier(bonus)}
                              </span>
                              <span className="text-xs text-zinc-200 truncate">{skill.label}</span>
                              <span className="text-[10px] text-zinc-500">
                                ({skill.abilityShort})
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  onRollFromSheet({
                                    sheet,
                                    tipoAcao: 'pericia',
                                    titulo: `Perícia: ${skill.label}${isExp ? ' (Expertise)' : ''}`,
                                    formula: `1d20${formatModifier(bonus)}`,
                                    privadoMestre: rollPrivateDefault,
                                  })
                                }
                                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-violet-600 text-zinc-300 hover:text-white text-[10px] transition-colors cursor-pointer"
                                title={`Rolar ${skill.label} no Chat`}
                              >
                                <Dices className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onRollFromSheet({
                                    sheet,
                                    tipoAcao: 'pericia',
                                    titulo: `Perícia: ${skill.label}${isExp ? ' (Expertise)' : ''} (Privado GM)`,
                                    formula: `1d20${formatModifier(bonus)}`,
                                    privadoMestre: true,
                                  })
                                }
                                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-amber-600/30 text-zinc-400 hover:text-amber-300 text-[10px] transition-colors cursor-pointer"
                                title={`Rolar ${skill.label} no Privado do Mestre`}
                              >
                                <EyeOff className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2 (4 cols): AC, {iniciativa}, Speed, HP, Death Saves, Attacks, & Custom Macros */}
              <div className="lg:col-span-4 space-y-4">
                {/* Top Combat Triad: CA, Iniciativa ({iniciativa}), Deslocamento */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3 text-center">
                    <Shield className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                    <input
                      type="number"
                      aria-label="Classe de Armadura"
                      value={sheet.classeArmadura}
                      onChange={(e) => updateField('classeArmadura', Number(e.target.value) || 10)}
                      className="w-full text-center text-xl font-bold font-mono tabular-nums text-white bg-transparent focus:outline-none"
                    />
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block mt-0.5">
                      Classe Armd
                    </span>
                  </div>

                  <div className="bg-[#1d1f2a] border border-violet-500/40 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onRollFromSheet({
                            sheet,
                            tipoAcao: 'iniciativa',
                            titulo: `Iniciativa (${sheet.nomePersonagem})`,
                            formula: `1d20+{iniciativa}`,
                            privadoMestre: rollPrivateDefault,
                          })
                        }
                        className="text-xl font-bold font-mono tabular-nums text-violet-300 hover:text-white cursor-pointer"
                        title="Clique para rolar 1d20+{iniciativa}"
                      >
                        {formatModifier(initMod)}
                      </button>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-violet-300 block mt-1">
                      {'{iniciativa}'}
                    </span>
                  </div>

                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3 text-center">
                    <input
                      type="text"
                      aria-label="Deslocamento"
                      value={sheet.deslocamento}
                      onChange={(e) => updateField('deslocamento', e.target.value)}
                      className="w-full text-center text-lg font-bold font-mono text-white bg-transparent focus:outline-none mt-1"
                    />
                    <span className="text-[10px] font-bold uppercase text-zinc-400 block mt-1">
                      Desloc.
                    </span>
                  </div>
                </div>

                {/* Hit Points (Pontos de Vida Atuais, Máximos e Temporários) */}
                <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                      <Heart className="w-4 h-4" />
                      Pontos de Vida
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      Dados de Vida: {sheet.dadosVidaTotal}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-[#14151c] border border-zinc-800 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-zinc-400 block">PV ATUAIS</span>
                      <input
                        type="number"
                        aria-label="Pontos de Vida Atuais"
                        value={sheet.pvAtual}
                        onChange={(e) => updateField('pvAtual', Number(e.target.value))}
                        className="w-full text-center text-lg font-bold font-mono tabular-nums text-emerald-400 bg-transparent focus:outline-none"
                      />
                    </div>
                    <div className="bg-[#14151c] border border-zinc-800 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-zinc-400 block">PV TOTAIS</span>
                      <input
                        type="number"
                        aria-label="Pontos de Vida Totais"
                        value={sheet.pvMaximo}
                        onChange={(e) => updateField('pvMaximo', Number(e.target.value))}
                        className="w-full text-center text-lg font-bold font-mono tabular-nums text-white bg-transparent focus:outline-none"
                      />
                    </div>
                    <div className="bg-[#14151c] border border-zinc-800 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-zinc-400 block">TEMPORÁRIOS</span>
                      <input
                        type="number"
                        aria-label="Pontos de Vida Temporários"
                        value={sheet.pvTemporario}
                        onChange={(e) => updateField('pvTemporario', Number(e.target.value))}
                        className="w-full text-center text-lg font-bold font-mono tabular-nums text-sky-400 bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Death Saves (Testes Contra a Morte) */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
                    <span className="text-zinc-400 font-medium">Testes Contra a Morte</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-emerald-400 mr-1">Sucessos</span>
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() =>
                              updateField('sucessosMorte', sheet.sucessosMorte === n ? n - 1 : n)
                            }
                            className={`w-3.5 h-3.5 rounded-full border ${
                              sheet.sucessosMorte >= n
                                ? 'bg-emerald-500 border-emerald-400'
                                : 'border-zinc-600'
                            }`}
                            aria-label={`Sucesso contra a morte ${n}`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-rose-400 mr-1">Fracassos</span>
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() =>
                              updateField('fracassosMorte', sheet.fracassosMorte === n ? n - 1 : n)
                            }
                            className={`w-3.5 h-3.5 rounded-full border ${
                              sheet.fracassosMorte >= n ? 'bg-rose-500 border-rose-400' : 'border-zinc-600'
                            }`}
                            aria-label={`Fracasso contra a morte ${n}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CONDIÇÕES DE STATUS (D&D 5E OFICIAL) — Sincroniza Ícones sobre o Token no Mapa Tático */}
                <div
                  className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3.5 space-y-2.5"
                  data-testid="sheet-conditions-panel"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Condições de Status (D&D 5e)
                      </h3>
                      <span className="text-[10px] text-zinc-400 block">
                        Aplica ícones visuais diretamente sobre o token no mapa tático
                      </span>
                    </div>
                    {(sheet.condicoes?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => updateField('condicoes', [])}
                        className="px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-800 border border-rose-500/40 text-[10px] font-semibold text-rose-300 hover:text-white transition-colors cursor-pointer"
                        title="Remover todas as condições ativas"
                      >
                        Limpar ({sheet.condicoes?.length})
                      </button>
                    )}
                  </div>

                  {/* Grid of 16 Official D&D 5e Conditions */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {DND_CONDITIONS.map((cond) => {
                      const active = hasConditionInList(sheet.condicoes, cond.key);
                      return (
                        <button
                          key={cond.key}
                          type="button"
                          onClick={() =>
                            updateField(
                              'condicoes',
                              toggleConditionInList(sheet.condicoes, cond.key)
                            )
                          }
                          title={`${cond.label} (${cond.englishName}): ${cond.resumo}`}
                          aria-pressed={active}
                          data-testid={`condition-btn-${cond.key}`}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left text-[11px] font-medium transition-all cursor-pointer ${
                            active
                              ? 'bg-zinc-900 text-white shadow-md ring-1'
                              : 'bg-[#14151c] border-zinc-800/90 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                          }`}
                          style={
                            active
                              ? {
                                  borderColor: cond.color,
                                  boxShadow: `0 0 10px -2px ${cond.color}55`,
                                }
                              : undefined
                          }
                        >
                          <span className="text-sm leading-none shrink-0">{cond.icon}</span>
                          <span className="truncate">{cond.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Conditions Mechanical Summary List */}
                  {(sheet.condicoes?.length || 0) > 0 && (
                    <div className="pt-2 border-t border-zinc-800/90 space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                        Efeitos Ativos no Token ({sheet.condicoes?.length}):
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {(sheet.condicoes || []).map((cName) => {
                          const meta = getConditionMeta(cName);
                          return (
                            <div
                              key={meta.key}
                              className="flex items-start justify-between gap-2 px-2 py-1 rounded bg-[#14151c] border border-zinc-800 text-[11px]"
                            >
                              <div className="min-w-0">
                                <span
                                  className="font-bold mr-1"
                                  style={{ color: meta.color }}
                                >
                                  {meta.icon} {meta.label}:
                                </span>
                                <span className="text-zinc-300">{meta.resumo}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateField(
                                    'condicoes',
                                    toggleConditionInList(sheet.condicoes, meta.key)
                                  )
                                }
                                className="text-zinc-500 hover:text-rose-400 shrink-0 cursor-pointer"
                                title={`Remover ${meta.label}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ATAQUES E MAGIAS */}
                <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2.5">
                    Ataques e Conjurações Rápidas
                  </h3>
                  <div className="space-y-2 mb-3">
                    {sheet.ataques.map((atk) => (
                      <div
                        key={atk.id}
                        className="bg-[#14151c] border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{atk.nome}</div>
                          <div className="text-[11px] font-mono text-zinc-400">
                            Bônus: <span className="text-violet-300">{atk.bonusAtaque}</span> · Dano:{' '}
                            <span className="text-rose-300">{atk.danoFormula}</span> ({atk.tipoDano})
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onRollFromSheet({
                                sheet,
                                tipoAcao: 'ataque',
                                titulo: `Ataque: ${atk.nome}`,
                                formula: atk.bonusAtaque.startsWith('+') || atk.bonusAtaque.startsWith('-')
                                  ? `1d20${atk.bonusAtaque}`
                                  : '1d20',
                                danoFormula: atk.danoFormula,
                                tipoDano: atk.tipoDano,
                                privadoMestre: rollPrivateDefault,
                              })
                            }
                            className="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            Atacar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRollFromSheet({
                                sheet,
                                tipoAcao: 'ataque',
                                titulo: `Ataque: ${atk.nome} (Privado GM)`,
                                formula: atk.bonusAtaque.startsWith('+') || atk.bonusAtaque.startsWith('-')
                                  ? `1d20${atk.bonusAtaque}`
                                  : '1d20',
                                danoFormula: atk.danoFormula,
                                tipoDano: atk.tipoDano,
                                privadoMestre: true,
                              })
                            }
                            className="p-1.5 rounded bg-zinc-800 hover:bg-amber-600/30 text-zinc-400 hover:text-amber-300"
                            title="Atacar em Privado (Mestre)"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateField(
                                'ataques',
                                sheet.ataques.filter((a) => a.id !== atk.id)
                              )
                            }
                            className="p-1 text-zinc-500 hover:text-rose-400"
                            aria-label={`Remover ataque ${atk.nome}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Add Attack Form */}
                  <form onSubmit={handleAddAttack} className="grid grid-cols-12 gap-1.5">
                    <input
                      type="text"
                      placeholder="Nome da arma/ataque"
                      value={newAttackName}
                      onChange={(e) => setNewAttackName(e.target.value)}
                      className="col-span-5 px-2 py-1 text-xs bg-[#14151c] border border-zinc-800 rounded text-white"
                    />
                    <input
                      type="text"
                      placeholder="+7"
                      value={newAttackBonus}
                      onChange={(e) => setNewAttackBonus(e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs font-mono bg-[#14151c] border border-zinc-800 rounded text-white"
                    />
                    <input
                      type="text"
                      placeholder="1d8+4"
                      value={newAttackDamage}
                      onChange={(e) => setNewAttackDamage(e.target.value)}
                      className="col-span-3 px-2 py-1 text-xs font-mono bg-[#14151c] border border-zinc-800 rounded text-white"
                    />
                    <button
                      type="submit"
                      className="col-span-2 bg-zinc-800 hover:bg-violet-600 text-white rounded flex items-center justify-center text-xs"
                      aria-label="Adicionar ataque"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* SISTEMA DE MACROS CUSTOMIZÁVEIS */}
                <div className="bg-[#1d1f2a] border border-violet-500/30 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      Macros Customizáveis de Habilidades
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Aceita {'{iniciativa}'}, {'{forca_mod}'}, {'{proficiencia}'}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {sheet.macros.map((mac) => (
                      <div
                        key={mac.id}
                        className="bg-[#14151c] border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{mac.nome}</div>
                          <div className="text-[11px] font-mono text-violet-300 truncate">
                            {mac.formula} {mac.danoFormula ? `· Dano: ${mac.danoFormula}` : ''}
                          </div>
                          {mac.descricao && (
                            <div className="text-[11px] text-zinc-400 truncate">{mac.descricao}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onRollFromSheet({
                                sheet,
                                tipoAcao: 'macro',
                                titulo: `Macro: ${mac.nome}`,
                                formula: mac.formula,
                                danoFormula: mac.danoFormula,
                                privadoMestre: Boolean(mac.privadoPadrao || rollPrivateDefault),
                                detalhesTexto: mac.descricao,
                              })
                            }
                            className="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            Executar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRollFromSheet({
                                sheet,
                                tipoAcao: 'macro',
                                titulo: `Macro: ${mac.nome} (Privado GM)`,
                                formula: mac.formula,
                                danoFormula: mac.danoFormula,
                                privadoMestre: true,
                                detalhesTexto: mac.descricao,
                              })
                            }
                            className="p-1.5 rounded bg-zinc-800 hover:bg-amber-600/30 text-zinc-400 hover:text-amber-300"
                            title="Executar Macro em Privado para o Mestre"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateField(
                                'macros',
                                sheet.macros.filter((m) => m.id !== mac.id)
                              )
                            }
                            className="p-1 text-zinc-500 hover:text-rose-400"
                            aria-label={`Excluir macro ${mac.nome}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Create Custom Macro Form */}
                  <form onSubmit={handleAddMacro} className="space-y-2 pt-2 border-t border-zinc-800">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="Nome da Macro (ex: Ataque Furtivo)"
                        value={newMacroName}
                        onChange={(e) => setNewMacroName(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-[#14151c] border border-zinc-700 rounded text-white"
                      />
                      <input
                        type="text"
                        placeholder="Fórmula (ex: 1d20+{destreza_mod})"
                        value={newMacroFormula}
                        onChange={(e) => setNewMacroFormula(e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-mono bg-[#14151c] border border-zinc-700 rounded text-white"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Dano extra opcional (ex: 3d6)"
                        value={newMacroDamage}
                        onChange={(e) => setNewMacroDamage(e.target.value)}
                        className="w-1/3 px-2.5 py-1.5 text-xs font-mono bg-[#14151c] border border-zinc-700 rounded text-white"
                      />
                      <input
                        type="text"
                        placeholder="Descrição ou efeito..."
                        value={newMacroDesc}
                        onChange={(e) => setNewMacroDesc(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-[#14151c] border border-zinc-700 rounded text-white"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded whitespace-nowrap cursor-pointer"
                      >
                        + Salvar Macro
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Column 3 (4 cols): Token Vision/Light, Personality, Coins, Inventory, & Features */}
              <div className="lg:col-span-4 space-y-4">
                {/* Dynamic Token Vision & Light Configuration */}
                <div className="bg-[#1d1f2a] border border-amber-500/30 rounded-xl p-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                    Visão (Exclusiva) & Luz de Tocha (Pública) na Névoa
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-zinc-400 block mb-1">
                        Visão Pessoal (Só Você Vê)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={sheet.visaoAlcanceQuadrados}
                        onChange={(e) => updateField('visaoAlcanceQuadrados', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#14151c] border border-zinc-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">
                        Luz / Tocha (Todos Veem)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={sheet.luzAlcanceQuadrados}
                        onChange={(e) => updateField('luzAlcanceQuadrados', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-[#14151c] border border-zinc-700 rounded text-amber-300"
                      />
                    </div>
                  </div>
                </div>

                {/* 2 ESPAÇOS DEDICADOS: SOBRE A CLASSE & SOBRE A SUBCLASSE */}
                <div
                  className="bg-[#1d1f2a] border border-violet-500/35 rounded-xl p-3.5 space-y-3"
                  data-testid="sheet-class-subclass-section"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300">
                      Classe & Subclasse (D&D 5e)
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {sheet.classeNivel}
                      {sheet.subclasse ? ` · ${sheet.subclasse}` : ''}
                    </span>
                  </div>

                  {/* Espaço 1: Sobre a Classe */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="sheet-sobre-classe"
                        className="text-[10px] font-bold uppercase tracking-wider text-zinc-300"
                      >
                        1. Sobre a Classe ({sheet.classeNivel || 'Classe'})
                      </label>
                      <input
                        type="text"
                        aria-label="Nome da Classe e Nível"
                        placeholder="Ex: Guerreiro 5"
                        value={sheet.classeNivel}
                        onChange={(e) => updateField('classeNivel', e.target.value)}
                        className="w-36 px-2 py-0.5 text-[11px] bg-[#14151c] border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <textarea
                      id="sheet-sobre-classe"
                      aria-label="Sobre a Classe"
                      rows={3}
                      placeholder="Anote aqui as características, proficiências, recursos e habilidades principais da sua Classe..."
                      value={sheet.sobreClasse || ''}
                      onChange={(e) => updateField('sobreClasse', e.target.value)}
                      className="w-full p-2 text-xs bg-[#14151c] border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Espaço 2: Sobre a Subclasse */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="sheet-sobre-subclasse"
                        className="text-[10px] font-bold uppercase tracking-wider text-violet-300"
                      >
                        2. Sobre a Subclasse ({sheet.subclasse || 'Subclasse'})
                      </label>
                      <input
                        type="text"
                        aria-label="Nome da Subclasse"
                        placeholder="Ex: Mestre de Batalha"
                        value={sheet.subclasse || ''}
                        onChange={(e) => updateField('subclasse', e.target.value)}
                        className="w-36 px-2 py-0.5 text-[11px] bg-[#14151c] border border-violet-500/40 rounded text-violet-200 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <textarea
                      id="sheet-sobre-subclasse"
                      aria-label="Sobre a Subclasse"
                      rows={3}
                      placeholder="Anote aqui o arquétipo, tradição arcana, juramento ou círculo e as habilidades da sua Subclasse..."
                      value={sheet.sobreSubclasse || ''}
                      onChange={(e) => updateField('sobreSubclasse', e.target.value)}
                      className="w-full p-2 text-xs bg-[#14151c] border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                {/* Moedas (PC, PP, PE, PO, PL) & Equipamento */}
                <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                    Moedas e Inventário
                  </h3>
                  <div className="grid grid-cols-5 gap-1.5 mb-3">
                    {(['pc', 'pp', 'pe', 'po', 'pl'] as const).map((coin) => (
                      <div key={coin} className="bg-[#14151c] border border-zinc-800 rounded p-1.5 text-center">
                        <span className="text-[10px] font-bold uppercase text-amber-400 block">
                          {coin.toUpperCase()}
                        </span>
                        <input
                          type="number"
                          aria-label={`Moedas ${coin.toUpperCase()}`}
                          value={sheet.moedas[coin]}
                          onChange={(e) =>
                            updateField('moedas', {
                              ...sheet.moedas,
                              [coin]: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full text-center text-xs font-mono tabular-nums text-white bg-transparent focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2 pr-1">
                    {sheet.inventario.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#14151c] border border-zinc-800 text-xs"
                      >
                        <div className="truncate">
                          <span className="font-mono text-violet-300 mr-1.5">{item.quantidade}x</span>
                          <span className="text-zinc-200">{item.nome}</span>
                          <span className="text-zinc-500 ml-1.5">({item.peso})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'inventario',
                              sheet.inventario.filter((i) => i.id !== item.id)
                            )
                          }
                          className="text-zinc-500 hover:text-rose-400 ml-2"
                          aria-label={`Remover item ${item.nome}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddInventoryItem} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Novo item ou equipamento..."
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs bg-[#14151c] border border-zinc-800 rounded text-white"
                    />
                    <input
                      type="number"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Number(e.target.value))}
                      className="w-12 px-1.5 py-1 text-xs font-mono bg-[#14151c] border border-zinc-800 rounded text-white text-center"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-violet-600 text-white rounded text-xs"
                    >
                      + Item
                    </button>
                  </form>
                </div>

                {/* Personalidade, Ideais, Ligações, Defeitos */}
                <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3.5 space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                      Traços de Personalidade
                    </label>
                    <textarea
                      rows={2}
                      value={sheet.tracosPersonalidade}
                      onChange={(e) => updateField('tracosPersonalidade', e.target.value)}
                      className="w-full p-2 text-xs bg-[#14151c] border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                      Ideais & Ligações
                    </label>
                    <textarea
                      rows={2}
                      value={sheet.ideais}
                      onChange={(e) => updateField('ideais', e.target.value)}
                      className="w-full p-2 text-xs bg-[#14151c] border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                      Características, Talentos & Idiomas
                    </label>
                    <textarea
                      rows={3}
                      value={sheet.caracteristicasHabilidades}
                      onChange={(e) => updateField('caracteristicasHabilidades', e.target.value)}
                      className="w-full p-2 text-xs bg-[#14151c] border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 2: HISTÓRIA, APARÊNCIA, ALIADOS E TESOURO (Matches Page 2 of User PDF) */}
          {activePage === 'page2' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-4">
                {[
                  { label: 'IDADE', field: 'idade' as const },
                  { label: 'ALTURA', field: 'altura' as const },
                  { label: 'PESO', field: 'pesoCorp' as const },
                  { label: 'OLHOS', field: 'olhos' as const },
                  { label: 'PELE', field: 'pele' as const },
                  { label: 'CABELOS', field: 'cabelos' as const },
                ].map((item) => (
                  <div key={item.field}>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1">{item.label}</label>
                    <input
                      type="text"
                      value={sheet[item.field]}
                      onChange={(e) => updateField(item.field, e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#14151c] border border-zinc-800 rounded text-white"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase text-zinc-300">
                        Aparência do Personagem
                      </span>
                      <label className="flex items-center gap-1 text-xs text-violet-400 hover:underline cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        Upload Sem Perda
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLosslessAppearanceUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="w-full h-56 bg-[#14151c] border border-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                      <img
                        src={sheet.aparenciaUrl || sheet.avatarUrl}
                        alt={sheet.nomePersonagem}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-4">
                    <label className="text-xs font-bold uppercase text-zinc-300 block mb-2">
                      História do Personagem
                    </label>
                    <textarea
                      rows={8}
                      value={sheet.historiaPersonagem}
                      onChange={(e) => updateField('historiaPersonagem', e.target.value)}
                      className="w-full p-3 text-xs bg-[#14151c] border border-zinc-800 rounded-lg text-zinc-200 leading-relaxed"
                    />
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-4">
                    <label className="text-xs font-bold uppercase text-zinc-300 block mb-2">
                      Aliados e Organizações
                    </label>
                    <textarea
                      rows={5}
                      value={sheet.aliadosOrganizacoes}
                      onChange={(e) => updateField('aliadosOrganizacoes', e.target.value)}
                      className="w-full p-3 text-xs bg-[#14151c] border border-zinc-800 rounded-lg text-zinc-200"
                    />
                  </div>

                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-4">
                    <label className="text-xs font-bold uppercase text-zinc-300 block mb-2">
                      Outras Características e Idiomas
                    </label>
                    <textarea
                      rows={5}
                      value={sheet.idiomasProficiencias}
                      onChange={(e) => updateField('idiomasProficiencias', e.target.value)}
                      className="w-full p-3 text-xs bg-[#14151c] border border-zinc-800 rounded-lg text-zinc-200"
                    />
                  </div>

                  <div className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-4">
                    <label className="text-xs font-bold uppercase text-zinc-300 block mb-2">
                      Tesouro & Relíquias
                    </label>
                    <textarea
                      rows={4}
                      value={sheet.tesouro}
                      onChange={(e) => updateField('tesouro', e.target.value)}
                      className="w-full p-3 text-xs bg-[#14151c] border border-zinc-800 rounded-lg text-zinc-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 3: GRIMÓRIO E CONJURAÇÃO (Matches Page 3 of User PDF: Classe de Conjurador, Int, CD 16, +8, Truques & Níveis 1..9) */}
          {activePage === 'page3' && (
            <div className="space-y-5">
              {/* Spellcasting Header Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                    CLASSE DE CONJURADOR
                  </span>
                  <input
                    type="text"
                    value={sheet.classeConjurador}
                    onChange={(e) => updateField('classeConjurador', e.target.value)}
                    placeholder="Ex: Mago, Clérigo, Bardo"
                    className="w-full px-3 py-1.5 text-sm font-semibold bg-[#14151c] border border-zinc-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                    HABILIDADE CHAVE
                  </span>
                  <select
                    value={sheet.habilidadeChaveConjuracao}
                    onChange={(e) => updateField('habilidadeChaveConjuracao', e.target.value as AbilityKey)}
                    className="w-full px-3 py-1.5 text-sm font-semibold bg-[#14151c] border border-zinc-800 rounded-lg text-violet-300"
                  >
                    {ABILITY_ORDER.map((ab) => (
                      <option key={ab} value={ab}>
                        {ABILITY_LABELS[ab].nome} ({ABILITY_LABELS[ab].sigla})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-center bg-[#14151c] border border-zinc-800 rounded-lg p-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                    CD DO TR DE MAGIA
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                    {spellDC}
                  </span>
                </div>

                <div className="text-center bg-[#14151c] border border-zinc-800 rounded-lg p-2">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                    BÔNUS DE ATAQUE DE MAGIA
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onRollFromSheet({
                        sheet,
                        tipoAcao: 'magia',
                        titulo: `Ataque Mágico (${sheet.nomePersonagem})`,
                        formula: `1d20${formatModifier(spellAtk)}`,
                        privadoMestre: rollPrivateDefault,
                      })
                    }
                    className="text-xl font-bold font-mono text-violet-400 hover:text-white tabular-nums cursor-pointer"
                  >
                    {formatModifier(spellAtk)}
                  </button>
                </div>
              </div>

              {/* Add Spell Form */}
              <form
                onSubmit={handleAddSpell}
                className="flex flex-wrap items-center gap-2 bg-[#1d1f2a] border border-zinc-800 rounded-xl p-3"
              >
                <input
                  type="text"
                  placeholder="Nome da Magia (ex: Onda do Trovão, Velocidade, Shield)"
                  value={newSpellName}
                  onChange={(e) => setNewSpellName(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-[#14151c] border border-zinc-700 rounded-lg text-white"
                />
                <select
                  value={newSpellLevel}
                  onChange={(e) => setNewSpellLevel(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs bg-[#14151c] border border-zinc-700 rounded-lg text-white"
                >
                  <option value={0}>0 — Truque (Cantrip)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}º Círculo
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Dano opcional (ex: 3d6)"
                  value={newSpellDamage}
                  onChange={(e) => setNewSpellDamage(e.target.value)}
                  className="w-36 px-3 py-1.5 text-xs font-mono bg-[#14151c] border border-zinc-700 rounded-lg text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  + Adicionar Magia
                </button>
              </form>

              {/* Spell Levels Grid (0 to 9) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map((lvl) => {
                  const spellsAtLevel = sheet.magias.filter((m) => m.nivel === lvl);
                  const slots = sheet.espacosMagia?.[lvl] || { total: 0, usados: 0 };
                  return (
                    <div
                      key={lvl}
                      className="bg-[#1d1f2a] border border-zinc-700/80 rounded-xl p-3.5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
                          <span className="text-xs font-bold uppercase text-violet-300">
                            {lvl === 0 ? '0 · TRUQUES (CANTRIPS)' : `NÍVEL ${lvl} DE MAGIA`}
                          </span>
                          {lvl > 0 && (
                            <div className="flex items-center gap-1.5 text-[11px] font-mono">
                              <span className="text-zinc-400">Espaços:</span>
                              <input
                                type="number"
                                min={0}
                                max={9}
                                value={slots.usados}
                                onChange={(e) =>
                                  updateField('espacosMagia', {
                                    ...sheet.espacosMagia,
                                    [lvl]: { ...slots, usados: Number(e.target.value) || 0 },
                                  })
                                }
                                className="w-8 text-center bg-[#14151c] border border-zinc-700 rounded text-amber-300"
                              />
                              <span>/</span>
                              <input
                                type="number"
                                min={0}
                                max={9}
                                value={slots.total}
                                onChange={(e) =>
                                  updateField('espacosMagia', {
                                    ...sheet.espacosMagia,
                                    [lvl]: { ...slots, total: Number(e.target.value) || 0 },
                                  })
                                }
                                className="w-8 text-center bg-[#14151c] border border-zinc-700 rounded text-white"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {spellsAtLevel.length === 0 && (
                            <p className="text-xs text-zinc-500 italic">Nenhuma magia registrada.</p>
                          )}
                          {spellsAtLevel.map((sp) => (
                            <div
                              key={sp.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#14151c] border border-zinc-800 text-xs"
                            >
                              <div className="truncate">
                                <span className="font-medium text-white">{sp.nome}</span>
                                {sp.formulaDano && (
                                  <span className="ml-2 font-mono text-rose-300">({sp.formulaDano})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRollFromSheet({
                                      sheet,
                                      tipoAcao: 'magia',
                                      titulo: `Magia: ${sp.nome} (${lvl === 0 ? 'Truque' : `${lvl}º Círculo`})`,
                                      formula: `1d20${formatModifier(spellAtk)}`,
                                      danoFormula: sp.formulaDano,
                                      tipoDano: 'Mágico',
                                      privadoMestre: rollPrivateDefault,
                                      detalhesTexto: `CD do TR ${spellDC} (${ABILITY_LABELS[sheet.habilidadeChaveConjuracao].sigla})`,
                                    })
                                  }
                                  className="px-2 py-0.5 rounded bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white text-[11px] cursor-pointer"
                                >
                                  Conjurar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateField(
                                      'magias',
                                      sheet.magias.filter((m) => m.id !== sp.id)
                                    )
                                  }
                                  className="text-zinc-500 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
