import type {
  AbilityKey,
  AbilityScores,
  CharacterSheet,
  CombatLogEntry,
  DndConditionDefinition,
  DndConditionKey,
  ExploredFogCircle,
  InitiativeParticipant,
  MapToken,
  SkillDefinition,
  SkillKey,
} from '../types/vtt.ts';

export const ABILITY_LABELS: Record<AbilityKey, { nome: string; sigla: string }> = {
  forca: { nome: 'Força', sigla: 'FOR' },
  destreza: { nome: 'Destreza', sigla: 'DES' },
  constituicao: { nome: 'Constituição', sigla: 'CON' },
  inteligencia: { nome: 'Inteligência', sigla: 'INT' },
  sabedoria: { nome: 'Sabedoria', sigla: 'SAB' },
  carisma: { nome: 'Carisma', sigla: 'CAR' },
};

export const DND_SKILLS: SkillDefinition[] = [
  { key: 'acrobacia', label: 'Acrobacia', ability: 'destreza', abilityShort: 'Des' },
  { key: 'arcanismo', label: 'Arcanismo', ability: 'inteligencia', abilityShort: 'Int' },
  { key: 'atletismo', label: 'Atletismo', ability: 'forca', abilityShort: 'For' },
  { key: 'atuacao', label: 'Atuação', ability: 'carisma', abilityShort: 'Car' },
  { key: 'blefar', label: 'Blefar (Enganação)', ability: 'carisma', abilityShort: 'Car' },
  { key: 'furtividade', label: 'Furtividade', ability: 'destreza', abilityShort: 'Des' },
  { key: 'historia', label: 'História', ability: 'inteligencia', abilityShort: 'Int' },
  { key: 'intimidacao', label: 'Intimidação', ability: 'carisma', abilityShort: 'Car' },
  { key: 'intuicao', label: 'Intuição', ability: 'sabedoria', abilityShort: 'Sab' },
  { key: 'investigacao', label: 'Investigação', ability: 'inteligencia', abilityShort: 'Int' },
  { key: 'lidarComAnimais', label: 'Lidar com Animais', ability: 'sabedoria', abilityShort: 'Sab' },
  { key: 'medicina', label: 'Medicina', ability: 'sabedoria', abilityShort: 'Sab' },
  { key: 'natureza', label: 'Natureza', ability: 'inteligencia', abilityShort: 'Int' },
  { key: 'percepcao', label: 'Percepção', ability: 'sabedoria', abilityShort: 'Sab' },
  { key: 'persuasao', label: 'Persuasão', ability: 'carisma', abilityShort: 'Car' },
  { key: 'prestidigitacao', label: 'Prestidigitação', ability: 'destreza', abilityShort: 'Des' },
  { key: 'religiao', label: 'Religião', ability: 'inteligencia', abilityShort: 'Int' },
  { key: 'sobrevivencia', label: 'Sobrevivência', ability: 'sabedoria', abilityShort: 'Sab' },
];

/**
 * Official D&D 5e Status Conditions with visual icons, colors, and mechanical rule summaries.
 */
export const DND_CONDITIONS: DndConditionDefinition[] = [
  {
    key: 'envenenado',
    label: 'Envenenado',
    englishName: 'Poisoned',
    icon: '☠️',
    color: '#10b981',
    resumo: 'Desvantagem em jogadas de ataque e testes de atributo.',
  },
  {
    key: 'aterrorizado',
    label: 'Aterrorizado',
    englishName: 'Frightened',
    icon: '😱',
    color: '#a855f7',
    resumo: 'Desvantagem em testes e ataques enquanto vir a fonte do medo; não pode se aproximar.',
  },
  {
    key: 'imobilizado',
    label: 'Imobilizado',
    englishName: 'Restrained',
    icon: '⛓️',
    color: '#f59e0b',
    resumo: 'Deslocamento 0; ataques contra têm vantagem; seus ataques e Salv. DES têm desvantagem.',
  },
  {
    key: 'agarrado',
    label: 'Agarrado',
    englishName: 'Grappled',
    icon: '✊',
    color: '#f97316',
    resumo: 'Deslocamento se torna 0 e não pode se beneficiar de bônus no deslocamento.',
  },
  {
    key: 'atordoado',
    label: 'Atordoado',
    englishName: 'Stunned',
    icon: '💫',
    color: '#eab308',
    resumo: 'Incapacitado, não pode se mover, falha automática em FOR/DES; ataques contra têm vantagem.',
  },
  {
    key: 'caido',
    label: 'Caído',
    englishName: 'Prone',
    icon: '🔻',
    color: '#38bdf8',
    resumo: 'Só rasteja; desvantagem nos ataques; ataques a 1,5m contra têm vantagem.',
  },
  {
    key: 'cego',
    label: 'Cego',
    englishName: 'Blinded',
    icon: '🙈',
    color: '#94a3b8',
    resumo: 'Falha em testes de visão; ataques contra têm vantagem; seus ataques têm desvantagem.',
  },
  {
    key: 'enfeiticado',
    label: 'Enfeitiçado',
    englishName: 'Charmed',
    icon: '💖',
    color: '#ec4899',
    resumo: 'Não pode atacar quem o enfeitiçou; encantador tem vantagem em interações sociais.',
  },
  {
    key: 'incapacitado',
    label: 'Incapacitado',
    englishName: 'Incapacitated',
    icon: '🚫',
    color: '#ef4444',
    resumo: 'Não pode realizar ações ou reações.',
  },
  {
    key: 'inconsciente',
    label: 'Inconsciente',
    englishName: 'Unconscious',
    icon: '💤',
    color: '#6366f1',
    resumo: 'Incapacitado, caído, falha FOR/DES; ataques têm vantagem e crítico automático a 1,5m.',
  },
  {
    key: 'invisivel',
    label: 'Invisível',
    englishName: 'Invisible',
    icon: '👻',
    color: '#06b6d4',
    resumo: 'Impossível de ver sem magia; ataques contra têm desvantagem; seus ataques têm vantagem.',
  },
  {
    key: 'paralisado',
    label: 'Paralisado',
    englishName: 'Paralyzed',
    icon: '⚡',
    color: '#fbbf24',
    resumo: 'Incapacitado, não se move nem fala; ataques têm vantagem e crítico automático a 1,5m.',
  },
  {
    key: 'petrificado',
    label: 'Petrificado',
    englishName: 'Petrified',
    icon: '🗿',
    color: '#a8a29e',
    resumo: 'Transformado em pedra; incapacitado; resistência a todo dano; imune a veneno.',
  },
  {
    key: 'surdo',
    label: 'Surdo',
    englishName: 'Deafened',
    icon: '🔇',
    color: '#14b8a6',
    resumo: 'Não ouve e falha automaticamente em testes que exijam audição.',
  },
  {
    key: 'exaustao',
    label: 'Exaustão',
    englishName: 'Exhaustion',
    icon: '🥵',
    color: '#f43f5e',
    resumo: 'Penalidades cumulativas de fadiga física e mental (Níveis 1 a 6).',
  },
  {
    key: 'concentrando',
    label: 'Concentrando',
    englishName: 'Concentrating',
    icon: '🔮',
    color: '#8b5cf6',
    resumo: 'Mantendo magia de concentração ativa (teste de CON ao sofrer dano).',
  },
];

function normalizeConditionStr(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getConditionMeta(keyOrLabel: string): DndConditionDefinition {
  const norm = normalizeConditionStr(keyOrLabel);
  const found = DND_CONDITIONS.find(
    (c) =>
      c.key === norm ||
      normalizeConditionStr(c.label) === norm ||
      normalizeConditionStr(c.englishName) === norm
  );
  if (found) return found;
  return {
    key: (norm || 'concentrando') as DndConditionKey,
    label: keyOrLabel,
    englishName: keyOrLabel,
    icon: '✨',
    color: '#8b5cf6',
    resumo: `Condição ativa: ${keyOrLabel}`,
  };
}

export function hasConditionInList(
  list: string[] | undefined,
  conditionKeyOrLabel: string
): boolean {
  if (!list || list.length === 0) return false;
  const targetMeta = getConditionMeta(conditionKeyOrLabel);
  return list.some((item) => getConditionMeta(item).key === targetMeta.key);
}

export function toggleConditionInList(
  list: string[] | undefined,
  conditionKeyOrLabel: string
): string[] {
  const current = list || [];
  const targetMeta = getConditionMeta(conditionKeyOrLabel);
  const exists = current.some((item) => getConditionMeta(item).key === targetMeta.key);
  if (exists) {
    return current.filter((item) => getConditionMeta(item).key !== targetMeta.key);
  }
  return [...current, targetMeta.label];
}

/**
 * Calculates the D&D 5e ability modifier: floor((score - 10) / 2)
 */
export function calculateAbilityModifier(score: number): number {
  const safeScore = Number.isFinite(score) ? score : 10;
  return Math.floor((safeScore - 10) / 2);
}

/**
 * Formats a modifier with explicit sign (+5, +0, -1)
 */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculates proficiency bonus from character level: ceil(level / 4) + 1
 */
export function calculateProficiencyBonus(level: number): number {
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return Math.ceil(safeLevel / 4) + 1;
}

/**
 * Calculates saving throw modifier for a given ability
 */
export function calculateSavingThrowBonus(sheet: CharacterSheet, ability: AbilityKey): number {
  const baseMod = calculateAbilityModifier(sheet.atributos[ability]);
  const isProficient = Boolean(sheet.salvaguardasProficiencia?.[ability]);
  const profBonus = sheet.bonusProficiencia || calculateProficiencyBonus(sheet.nivel);
  return baseMod + (isProficient ? profBonus : 0);
}

/**
 * Calculates skill modifier for a given skill key
 */
export function calculateSkillBonus(sheet: CharacterSheet, skillKey: SkillKey): number {
  const skillDef = DND_SKILLS.find((s) => s.key === skillKey);
  if (!skillDef) return 0;
  const baseMod = calculateAbilityModifier(sheet.atributos[skillDef.ability]);
  const isProficient = Boolean(sheet.periciasProficiencia?.[skillKey]);
  const isExpert = Boolean(sheet.periciasEspecializacao?.[skillKey]);
  const profBonus = sheet.bonusProficiencia || calculateProficiencyBonus(sheet.nivel);
  if (isExpert) return baseMod + profBonus * 2;
  if (isProficient) return baseMod + profBonus;
  return baseMod;
}

/**
 * Calculates total initiative modifier ({iniciativa}) for a character sheet
 */
export function calculateInitiativeModifier(sheet: CharacterSheet): number {
  const dexMod = calculateAbilityModifier(sheet.atributos.destreza);
  const extra = Number(sheet.iniciativaBonusExtra) || 0;
  return dexMod + extra;
}

/**
 * Calculates Passive Wisdom (Perception)
 */
export function calculatePassivePerception(sheet: CharacterSheet): number {
  return 10 + calculateSkillBonus(sheet, 'percepcao');
}

/**
 * Calculates Spell Save DC: 8 + proficiency + spellcasting ability modifier
 */
export function calculateSpellSaveDC(sheet: CharacterSheet): number {
  const ability = sheet.habilidadeChaveConjuracao || 'inteligencia';
  const mod = calculateAbilityModifier(sheet.atributos[ability]);
  const prof = sheet.bonusProficiencia || calculateProficiencyBonus(sheet.nivel);
  return 8 + prof + mod;
}

/**
 * Calculates Spell Attack Bonus: proficiency + spellcasting ability modifier
 */
export function calculateSpellAttackBonus(sheet: CharacterSheet): number {
  const ability = sheet.habilidadeChaveConjuracao || 'inteligencia';
  const mod = calculateAbilityModifier(sheet.atributos[ability]);
  const prof = sheet.bonusProficiencia || calculateProficiencyBonus(sheet.nivel);
  return prof + mod;
}

/**
 * Substitutes dynamic sheet variables like {iniciativa}, {forca_mod}, {destreza_mod}, {proficiencia}, etc.
 */
export function interpolateSheetVariables(formula: string, sheet?: CharacterSheet): string {
  if (!sheet) {
    return formula.replace(/\{[^}]+\}/g, '0');
  }

  const prof = sheet.bonusProficiencia || calculateProficiencyBonus(sheet.nivel);
  const vars: Record<string, number> = {
    iniciativa: calculateInitiativeModifier(sheet),
    proficiencia: prof,
    nivel: sheet.nivel || 1,
    forca_mod: calculateAbilityModifier(sheet.atributos.forca),
    destreza_mod: calculateAbilityModifier(sheet.atributos.destreza),
    constituicao_mod: calculateAbilityModifier(sheet.atributos.constituicao),
    inteligencia_mod: calculateAbilityModifier(sheet.atributos.inteligencia),
    sabedoria_mod: calculateAbilityModifier(sheet.atributos.sabedoria),
    carisma_mod: calculateAbilityModifier(sheet.atributos.carisma),
    for: calculateAbilityModifier(sheet.atributos.forca),
    des: calculateAbilityModifier(sheet.atributos.destreza),
    con: calculateAbilityModifier(sheet.atributos.constituicao),
    int: calculateAbilityModifier(sheet.atributos.inteligencia),
    sab: calculateAbilityModifier(sheet.atributos.sabedoria),
    car: calculateAbilityModifier(sheet.atributos.carisma),
    cd_magia: calculateSpellSaveDC(sheet),
    ataque_magia: calculateSpellAttackBonus(sheet),
  };

  for (const skill of DND_SKILLS) {
    vars[skill.key] = calculateSkillBonus(sheet, skill.key);
  }

  return formula.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, rawName: string) => {
    const key = rawName.toLowerCase();
    const val = vars[key];
    if (val === undefined) return '0';
    return String(val);
  }).replace(/\+\s*-/g, '-').replace(/-\s*-/g, '+');
}

export interface ParsedDiceRollResult {
  formulaOriginal: string;
  formulaResolvida: string;
  rotulo?: string;
  dadosIndividuais: { faces: number; valor: number; descartado?: boolean }[];
  modificadorTotal: number;
  resultadoFinal: number;
  criticoSucesso: boolean;
  criticoFalha: boolean;
}

/**
 * Rollem-style dice parser and evaluator.
 * Supports:
 * - "1d20+5", "2d6+3 # Espada Curta"
 * - "2d20kh1+5" (Advantage / Keep highest 1)
 * - "2d20kl1+5" (Disadvantage / Keep lowest 1)
 * - "4d6kh3" (Stat generation)
 * - "r 1d20+{iniciativa}"
 * - Custom deterministic RNG function for unit testing
 */
export function evaluateDiceExpression(
  inputRaw: string,
  sheet?: CharacterSheet,
  rng: () => number = Math.random
): ParsedDiceRollResult {
  let cleanInput = inputRaw.trim();
  if (/^(\/r|\/roll|r|roll)\s+/i.test(cleanInput)) {
    cleanInput = cleanInput.replace(/^(\/r|\/roll|r|roll)\s+/i, '').trim();
  }

  // Extract inline label after '#'
  let rotulo: string | undefined;
  const hashIdx = cleanInput.indexOf('#');
  if (hashIdx !== -1) {
    rotulo = cleanInput.slice(hashIdx + 1).trim();
    cleanInput = cleanInput.slice(0, hashIdx).trim();
  }

  const formulaOriginal = cleanInput || '1d20';
  const formulaResolvida = interpolateSheetVariables(formulaOriginal, sheet).replace(/\s+/g, '');

  const dadosIndividuais: { faces: number; valor: number; descartado?: boolean }[] = [];
  let modificadorTotal = 0;
  let totalDados = 0;
  let criticoSucesso = false;
  let criticoFalha = false;

  // Tokenize into signed terms: e.g. +2d20kh1, +5, -2, +1d8
  const tokenRegex = /([+-]?)(\d*d\d+(?:k[hl]\d+)?|\d+)/gi;
  let match: RegExpExecArray | null;
  let matchedAny = false;

  while ((match = tokenRegex.exec(formulaResolvida)) !== null) {
    if (!match[2]) continue;
    matchedAny = true;
    const sign = match[1] === '-' ? -1 : 1;
    const term = match[2].toLowerCase();

    if (term.includes('d')) {
      const diceMatch = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/.exec(term);
      if (diceMatch) {
        const count = Math.min(100, Math.max(1, diceMatch[1] ? parseInt(diceMatch[1], 10) : 1));
        const faces = Math.min(1000, Math.max(2, parseInt(diceMatch[2], 10)));
        const keepMode = diceMatch[3] as 'kh' | 'kl' | undefined;
        const keepCount = diceMatch[4] ? parseInt(diceMatch[4], 10) : count;

        const batch: { faces: number; valor: number; descartado?: boolean; idx: number }[] = [];
        for (let i = 0; i < count; i++) {
          const rollVal = Math.floor(rng() * faces) + 1;
          batch.push({ faces, valor: rollVal, idx: i });
        }

        if (keepMode && keepCount < count) {
          const sortedIndices = [...batch]
            .sort((a, b) => (keepMode === 'kh' ? b.valor - a.valor : a.valor - b.valor))
            .slice(0, Math.max(1, keepCount))
            .map((item) => item.idx);
          const keptSet = new Set(sortedIndices);
          for (const item of batch) {
            if (!keptSet.has(item.idx)) {
              item.descartado = true;
            }
          }
        }

        for (const item of batch) {
          dadosIndividuais.push({
            faces: item.faces,
            valor: item.valor,
            descartado: item.descartado,
          });
          if (!item.descartado) {
            totalDados += sign * item.valor;
            if (item.faces === 20) {
              if (item.valor === 20) criticoSucesso = true;
              if (item.valor === 1) criticoFalha = true;
            }
          }
        }
      }
    } else {
      const numVal = parseInt(term, 10);
      if (!Number.isNaN(numVal)) {
        modificadorTotal += sign * numVal;
      }
    }
  }

  if (!matchedAny) {
    // Default fallback to 1d20 if non-formula text was passed
    const rollVal = Math.floor(rng() * 20) + 1;
    dadosIndividuais.push({ faces: 20, valor: rollVal });
    totalDados = rollVal;
    criticoSucesso = rollVal === 20;
    criticoFalha = rollVal === 1;
  }

  const resultadoFinal = totalDados + modificadorTotal;

  return {
    formulaOriginal,
    formulaResolvida,
    rotulo,
    dadosIndividuais,
    modificadorTotal,
    resultadoFinal,
    criticoSucesso,
    criticoFalha,
  };
}

/**
 * Extracts a 11-character YouTube video ID from any standard YouTube URL
 * (watch?v=, youtu.be/, embed/, shorts/) or raw ID.
 */
export function extractYouTubeId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match && match[1]) {
      return match[1];
    }
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed) && /[A-Z0-9]/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Batch-rolls initiative for all tokens currently on the active map scene,
 * automatically reading `{iniciativa}` from linked CharacterSheets and sorting descending.
 */
export function rollTableInitiativeForTokens(
  tokens: MapToken[],
  sheets: CharacterSheet[],
  rng: () => number = Math.random
): { participantes: InitiativeParticipant[]; logs: CombatLogEntry[] } {
  const sheetMap = new Map<string, CharacterSheet>(sheets.map((s) => [s.id, s]));
  const participantes: InitiativeParticipant[] = [];
  const logs: CombatLogEntry[] = [];
  const now = Date.now();

  // Filter tokens that represent characters or monsters/mounts in combat (excluding invisible light sources)
  const combatTokens = tokens.filter(
    (t) => !t.ehFonteDeLuz && (t.categoria === 'character' || t.categoria === 'mount')
  );

  combatTokens.forEach((token, idx) => {
    const linkedSheet = token.fichaId ? sheetMap.get(token.fichaId) : undefined;
    const rollResult = evaluateDiceExpression('1d20+{iniciativa}', linkedSheet, rng);
    const d20Val = rollResult.dadosIndividuais[0]?.valor ?? 10;
    const initMod = linkedSheet ? calculateInitiativeModifier(linkedSheet) : 0;
    const total = d20Val + initMod;

    participantes.push({
      id: `init-${token.id}`,
      tokenId: token.id,
      fichaId: linkedSheet?.id,
      nome: linkedSheet?.nomePersonagem || token.nome,
      avatarUrl: linkedSheet?.avatarUrl || token.imagemUrl,
      cor: linkedSheet?.corToken || token.cor,
      iniciativaTotal: total,
      dadoRolado: d20Val,
      modificadorIniciativa: initMod,
      pvAtual: linkedSheet?.pvAtual ?? token.pvAtual ?? 20,
      pvMaximo: linkedSheet?.pvMaximo ?? token.pvMaximo ?? 20,
      ca: linkedSheet?.classeArmadura ?? token.ca ?? 14,
      ehJogador: Boolean(linkedSheet && !linkedSheet.ehMestreOculto),
      oculto: token.ocultoParaJogadores,
      condicoes: [...(token.condicoes || [])],
    });

    logs.push({
      id: `log-init-${now}-${idx}`,
      timestamp: now + idx,
      autorNome: linkedSheet?.nomeJogador || 'Mesa',
      autorCor: linkedSheet?.corToken || token.cor,
      personagemId: linkedSheet?.id,
      personagemNome: linkedSheet?.nomePersonagem || token.nome,
      tipoAcao: 'iniciativa',
      titulo: `Iniciativa (${linkedSheet?.nomePersonagem || token.nome})`,
      formulaOriginal: '1d20+{iniciativa}',
      formulaResolvida: `1d20${formatModifier(initMod)}`,
      dadosIndividuais: [{ faces: 20, valor: d20Val }],
      modificadorTotal: initMod,
      resultadoFinal: total,
      criticoSucesso: d20Val === 20,
      criticoFalha: d20Val === 1,
      privadoMestre: token.ocultoParaJogadores,
      detalhesTexto: `Rolagem automática de iniciativa da mesa`,
    });
  });

  // Sort descending by iniciativaTotal, tie-break by higher modifier
  participantes.sort((a, b) => {
    if (b.iniciativaTotal !== a.iniciativaTotal) {
      return b.iniciativaTotal - a.iniciativaTotal;
    }
    return b.modificadorIniciativa - a.modificadorIniciativa;
  });

  return { participantes, logs };
}

/**
 * Calculates combined vision & light circles for dynamic Fog of War based on token coordinates.
 * - Torch / Light (`luzQuadrados`): Visible to EVERYONE on the tabletop (all players see torch light).
 * - Vision (`visaoQuadrados`): Exclusive to the player's OWN character token (`viewerSheetId` / `viewerTokenId`).
 *   Other players do NOT see another player's `visaoQuadrados`.
 * - GM (`viewerRole === 'mestre'`): Sees everything (all vision and light circles).
 */
export interface VisionLightCircle {
  tokenId: string;
  xPx: number;
  yPx: number;
  visionRadiusPx: number;
  lightRadiusPx: number;
  effectiveRadiusPx: number;
  lightColor: string;
}

export interface FogViewerOptions {
  viewerRole?: 'mestre' | 'jogador';
  viewerSheetId?: string | null;
  viewerTokenId?: string | null;
}

export function isTokenOwnedByViewer(token: MapToken, options?: FogViewerOptions): boolean {
  if (!options) return false;
  if (options.viewerSheetId && token.fichaId === options.viewerSheetId) {
    return true;
  }
  if (!options.viewerSheetId && options.viewerTokenId && token.id === options.viewerTokenId) {
    return true;
  }
  return false;
}

export function computeDynamicTokenVisionCircles(
  tokens: MapToken[],
  gridSizePx: number,
  options?: FogViewerOptions
): VisionLightCircle[] {
  const isStrictPlayerView =
    options?.viewerRole === 'jogador' &&
    Boolean(options.viewerSheetId || options.viewerTokenId);

  return tokens
    .filter((t) => {
      if (options?.viewerRole === 'mestre') {
        return (t.visaoQuadrados || 0) > 0 || (t.luzQuadrados || 0) > 0;
      }
      if (t.ocultoParaJogadores && !isTokenOwnedByViewer(t, options)) {
        return false;
      }
      if (isStrictPlayerView) {
        const isOwnToken = isTokenOwnedByViewer(t, options);
        const visibleVision = isOwnToken ? Math.max(0, t.visaoQuadrados || 0) : 0;
        const visibleLight = Math.max(0, t.luzQuadrados || 0); // Torch light is visible to everyone!
        return visibleVision > 0 || visibleLight > 0;
      }
      return (t.visaoQuadrados || 0) > 0 || (t.luzQuadrados || 0) > 0;
    })
    .map((t) => {
      const centerX = (t.x + t.larguraQuadrados / 2) * gridSizePx;
      const centerY = (t.y + t.alturaQuadrados / 2) * gridSizePx;
      const isOwnToken = isTokenOwnedByViewer(t, options);
      // When viewing as a player, ONLY their own token's vision (visaoQuadrados) applies;
      // however, torch light (luzQuadrados) is visible to everyone!
      const visionSquares =
        isStrictPlayerView && !isOwnToken ? 0 : Math.max(0, t.visaoQuadrados || 0);
      const lightSquares = Math.max(0, t.luzQuadrados || 0);

      const visionRadiusPx = visionSquares * gridSizePx;
      const lightRadiusPx = lightSquares * gridSizePx;
      const effectiveRadiusPx = Math.max(visionRadiusPx, lightRadiusPx);
      return {
        tokenId: t.id,
        xPx: centerX,
        yPx: centerY,
        visionRadiusPx,
        lightRadiusPx,
        effectiveRadiusPx,
        lightColor: t.luzCor || '#f59e0b',
      };
    });
}

/**
 * Determines if a token on the map is currently inside the Fog of War.
 * - When `options.viewerRole === 'jogador'` with `viewerSheetId`/`viewerTokenId`:
 *   1. The player always sees their own token.
 *   2. Any non-hidden token emitting Torch Light (`luzQuadrados > 0`) is visible to everyone, and its light radius reveals nearby tokens for everyone.
 *   3. Vision (`visaoQuadrados > 0`) is EXCLUSIVE to the player's own token: another player's `visaoQuadrados` does NOT reveal the fog for this player.
 * - When `options` is omitted or `viewerRole === 'mestre'`:
 *   Checks if the token is outside global player vision/light circles (used for the GM's "Na Névoa (Só GM)" badge).
 */
export function isTokenInsideFog(
  targetToken: MapToken,
  allTokens: MapToken[],
  sheets: CharacterSheet[],
  nevoaAtiva: boolean,
  gridSizePx: number,
  options?: FogViewerOptions
): boolean {
  if (!nevoaAtiva) return false;
  if (targetToken.ocultoParaJogadores) return true;

  const isStrictPlayerView =
    options?.viewerRole === 'jogador' &&
    Boolean(options.viewerSheetId || options.viewerTokenId);

  if (isStrictPlayerView) {
    // 1. The player always sees their own character token
    if (isTokenOwnedByViewer(targetToken, options)) {
      return false;
    }

    // 2. If the target token itself is emitting torch light (luzQuadrados > 0), everyone can see that light!
    if ((targetToken.luzQuadrados || 0) > 0) {
      return false;
    }

    const targetCenterX = (targetToken.x + targetToken.larguraQuadrados / 2) * gridSizePx;
    const targetCenterY = (targetToken.y + targetToken.alturaQuadrados / 2) * gridSizePx;

    // 3. Check all non-hidden tokens on the map:
    //    - Own token reveals via BOTH vision (visaoQuadrados) and light (luzQuadrados).
    //    - Other tokens reveal ONLY via torch light (luzQuadrados), NOT via their private vision (visaoQuadrados)!
    for (const source of allTokens) {
      if (source.ocultoParaJogadores && !isTokenOwnedByViewer(source, options)) continue;
      const isOwnSource = isTokenOwnedByViewer(source, options);
      const revealSquares = Math.max(
        source.luzQuadrados || 0,
        isOwnSource ? source.visaoQuadrados || 0 : 0
      );
      if (revealSquares <= 0) continue;

      const sourceCenterX = (source.x + source.larguraQuadrados / 2) * gridSizePx;
      const sourceCenterY = (source.y + source.alturaQuadrados / 2) * gridSizePx;
      const distPx = Math.hypot(targetCenterX - sourceCenterX, targetCenterY - sourceCenterY);

      if (distPx <= revealSquares * gridSizePx) {
        return false; // Illuminated by public torch light or by the player's own vision!
      }
    }

    // Outside public torch light and outside the player's own vision -> hidden in the fog!
    return true;
  }

  // Global / GM badge check:
  if (targetToken.luzQuadrados > 0) return false;

  const sheetMap = new Map<string, CharacterSheet>(sheets.map((s) => [s.id, s]));
  const targetSheet = targetToken.fichaId ? sheetMap.get(targetToken.fichaId) : undefined;
  const isPlayerHero = Boolean(targetSheet && !targetSheet.ehMestreOculto);

  if (isPlayerHero && targetToken.visaoQuadrados > 0) {
    return false;
  }

  const targetCenterX = (targetToken.x + targetToken.larguraQuadrados / 2) * gridSizePx;
  const targetCenterY = (targetToken.y + targetToken.alturaQuadrados / 2) * gridSizePx;

  for (const source of allTokens) {
    if (source.ocultoParaJogadores) continue;
    const sourceSheet = source.fichaId ? sheetMap.get(source.fichaId) : undefined;
    const sourceIsPlayerHero = Boolean(sourceSheet && !sourceSheet.ehMestreOculto);

    const revealSquares = Math.max(
      source.luzQuadrados || 0,
      sourceIsPlayerHero ? source.visaoQuadrados || 0 : 0
    );

    if (revealSquares <= 0) continue;

    const sourceCenterX = (source.x + source.larguraQuadrados / 2) * gridSizePx;
    const sourceCenterY = (source.y + source.alturaQuadrados / 2) * gridSizePx;
    const distPx = Math.hypot(targetCenterX - sourceCenterX, targetCenterY - sourceCenterY);

    if (distPx <= revealSquares * gridSizePx) {
      return false;
    }
  }

  return true;
}

/**
 * Ensures campaign roster names (`nomesCampanha`) always stay synced with all character sheets.
 */
export function syncCampaignCharacterNames(
  existingNames: string[],
  sheets: CharacterSheet[]
): string[] {
  const set = new Set<string>();
  for (const name of existingNames) {
    if (name && name.trim()) set.add(name.trim());
  }
  for (const sheet of sheets) {
    if (sheet.nomePersonagem && sheet.nomePersonagem.trim()) {
      set.add(sheet.nomePersonagem.trim());
    }
  }
  return Array.from(set);
}

/**
 * Records a single explored Fog of War memory circle for a character token if it has active Vision or Light.
 */
export function recordTokenFogMemoryStep(
  existingMemory: ExploredFogCircle[] | undefined,
  token: Pick<
    MapToken,
    | 'x'
    | 'y'
    | 'larguraQuadrados'
    | 'alturaQuadrados'
    | 'visaoQuadrados'
    | 'luzQuadrados'
    | 'ehFonteDeLuz'
  >
): ExploredFogCircle[] {
  const list = existingMemory ? [...existingMemory] : [];
  if (token.ehFonteDeLuz) return list;

  const activeRadius = Math.max(0, token.visaoQuadrados || 0, token.luzQuadrados || 0);
  if (activeRadius <= 0) return list;

  const w = token.larguraQuadrados || 1;
  const h = token.alturaQuadrados || 1;
  const cx = Math.round((token.x + w / 2) * 100) / 100;
  const cy = Math.round((token.y + h / 2) * 100) / 100;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const dist = Math.hypot(item.x - cx, item.y - cy);
    if (dist <= 0.35) {
      if (activeRadius > item.raioQuadrados) {
        list[i] = { x: cx, y: cy, raioQuadrados: activeRadius };
      }
      return list;
    }
  }

  list.push({ x: cx, y: cy, raioQuadrados: activeRadius });
  if (list.length > 600) {
    return list.slice(list.length - 600);
  }
  return list;
}

/**
 * Records explored Fog of War memory along a movement segment from `fromPos` to the token's new `(x, y)`
 * so dragging a token across the map leaves a continuous explored memory trail where it passed.
 */
export function recordTokenFogMemoryPath(
  existingMemory: ExploredFogCircle[] | undefined,
  tokenAtTarget: Pick<
    MapToken,
    | 'x'
    | 'y'
    | 'larguraQuadrados'
    | 'alturaQuadrados'
    | 'visaoQuadrados'
    | 'luzQuadrados'
    | 'ehFonteDeLuz'
  >,
  fromPos?: { x: number; y: number }
): ExploredFogCircle[] {
  let mem = existingMemory ? [...existingMemory] : [];
  if (tokenAtTarget.ehFonteDeLuz) return mem;

  const activeRadius = Math.max(
    0,
    tokenAtTarget.visaoQuadrados || 0,
    tokenAtTarget.luzQuadrados || 0
  );
  if (activeRadius <= 0) return mem;

  if (fromPos) {
    const dx = tokenAtTarget.x - fromPos.x;
    const dy = tokenAtTarget.y - fromPos.y;
    const totalDist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.min(40, Math.ceil(totalDist / 0.5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const interpX = fromPos.x + dx * t;
      const interpY = fromPos.y + dy * t;
      mem = recordTokenFogMemoryStep(mem, {
        ...tokenAtTarget,
        x: interpX,
        y: interpY,
      });
    }
    return mem;
  }

  return recordTokenFogMemoryStep(mem, tokenAtTarget);
}

export interface ExploredMemoryPixelCircle {
  xPx: number;
  yPx: number;
  radiusPx: number;
}

/**
 * Computes the explored Fog of War memory circles (in pixel coordinates) visible to the current viewer.
 * - For a Player (`viewerRole === 'jogador'`): ONLY returns the explored memory trail of their OWN token!
 * - For the GM (`viewerRole === 'mestre'`): Returns explored memory trails of all character tokens.
 */
export function computePlayerExploredMemoryCircles(
  tokens: MapToken[],
  gridSizePx: number,
  options?: FogViewerOptions
): ExploredMemoryPixelCircle[] {
  const isStrictPlayerView =
    options?.viewerRole === 'jogador' &&
    Boolean(options.viewerSheetId || options.viewerTokenId);

  const relevantTokens = tokens.filter((t) => {
    if (t.ehFonteDeLuz) return false;
    if (options?.viewerRole === 'mestre') return true;
    if (isStrictPlayerView) {
      return isTokenOwnedByViewer(t, options);
    }
    return !t.ocultoParaJogadores;
  });

  const result: ExploredMemoryPixelCircle[] = [];
  for (const t of relevantTokens) {
    // Include all previously recorded steps in memoriaExplorada
    const steps = recordTokenFogMemoryStep(t.memoriaExplorada, t);
    for (const step of steps) {
      if (step.raioQuadrados <= 0) continue;
      result.push({
        xPx: step.x * gridSizePx,
        yPx: step.y * gridSizePx,
        radiusPx: step.raioQuadrados * gridSizePx,
      });
    }
  }
  return result;
}

/**
 * Creates a 100% invisible Light Source token (`ehFonteDeLuz: true`) when the user clicks on the map
 * with the `[Luz]` tool active. Selecting this light on the map allows increasing/decreasing its radius.
 */
export function createInvisibleLightToken(
  gridX: number,
  gridY: number,
  radiusSquares: number = 4,
  color: string = '#f59e0b'
): MapToken {
  const snappedX = Math.max(0, Math.round(gridX * 2) / 2);
  const snappedY = Math.max(0, Math.round(gridY * 2) / 2);
  return {
    id: `light-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nome: 'Luz',
    categoria: 'effect',
    x: snappedX,
    y: snappedY,
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: color,
    imagemUrl: '',
    visaoQuadrados: 0,
    luzQuadrados: Math.max(1, radiusSquares),
    luzCor: color,
    ehFonteDeLuz: true,
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };
}

