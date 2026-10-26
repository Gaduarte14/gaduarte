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
  MapWallSegment,
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
  falloff: number;
}

export interface FogViewerOptions {
  viewerRole?: 'mestre' | 'jogador';
  viewerSheetId?: string | null;
  viewerTokenId?: string | null;
  paredes?: MapWallSegment[];
  colisaoParedesAtiva?: boolean;
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
      if (t.ocultoParaJogadores && !isTokenOwnedByViewer(t, options)) {
        return false;
      }
      if (options?.viewerRole === 'mestre') {
        const isViewerHero =
          isTokenOwnedByViewer(t, options) ||
          (t.fichaId && t.fichaId !== 'char-goblin-chefe');
        const visibleVision = isViewerHero ? Math.max(0, t.visaoQuadrados || 0) : 0;
        const visibleLight = Math.max(0, t.luzQuadrados || 0);
        return visibleVision > 0 || visibleLight > 0;
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
      const isViewerHeroInGm =
        options?.viewerRole === 'mestre' &&
        (isOwnToken || (t.fichaId && t.fichaId !== 'char-goblin-chefe'));
      // When viewing as a player, ONLY their own token's vision (visaoQuadrados) applies;
      // however, torch light (luzQuadrados) is visible to everyone!
      const visionSquares =
        isStrictPlayerView && !isOwnToken
          ? 0
          : options?.viewerRole === 'mestre' && !isViewerHeroInGm
            ? 0
            : Math.max(0, t.visaoQuadrados || 0);
      const lightSquares = Math.max(0, t.luzQuadrados || 0);

      const visionRadiusPx = visionSquares * gridSizePx;
      const lightRadiusPx = lightSquares * gridSizePx;
      const effectiveRadiusPx = Math.max(visionRadiusPx, lightRadiusPx);
      const rawFalloff = typeof t.luzFalloff === 'number' ? t.luzFalloff : 0.5;
      const clampedFalloff = Math.max(0, Math.min(1, rawFalloff));
      return {
        tokenId: t.id,
        xPx: centerX,
        yPx: centerY,
        visionRadiusPx,
        lightRadiusPx,
        effectiveRadiusPx,
        lightColor: t.luzCor || '#f59e0b',
        falloff: clampedFalloff,
      };
    });
}

/**
 * Returns only the wall segments that currently block token movement and light/vision rays:
 * - Solid walls (`tipo === 'parede'`) always block when `colisaoParedesAtiva` is enabled.
 * - Doors (`tipo === 'porta'`) block when closed (`!aberta`) and allow movement + light when open (`aberta === true`).
 */
export function getBlockingWallSegments(
  paredes: MapWallSegment[] | undefined,
  colisaoParedesAtiva: boolean = true
): MapWallSegment[] {
  if (!colisaoParedesAtiva || !paredes || paredes.length === 0) return [];
  return paredes.filter((w) => w.tipo === 'parede' || (w.tipo === 'porta' && !w.aberta));
}

/**
 * Converts blocking wall segments from grid coordinates to pixel coordinates.
 */
export function getBlockingWallsPx(
  paredes: MapWallSegment[] | undefined,
  gridSizePx: number,
  colisaoParedesAtiva: boolean = true
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const blocking = getBlockingWallSegments(paredes, colisaoParedesAtiva);
  return blocking.map((w) => ({
    x1: w.x1 * gridSizePx,
    y1: w.y1 * gridSizePx,
    x2: w.x2 * gridSizePx,
    y2: w.y2 * gridSizePx,
  }));
}

/**
 * 2D segment intersection between AB and CD.
 * Returns { intersects: true, t, u, x, y } if segments intersect strictly or at endpoints.
 */
export function intersectSegments2D(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): { intersects: boolean; t: number; u: number; x: number; y: number } {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-9) {
    return { intersects: false, t: 1, u: 1, x: bx, y: by };
  }
  const qpx = cx - ax;
  const qpy = cy - ay;
  const t = (qpx * sY - qpy * sX) / denom;
  const u = (qpx * rY - qpy * rX) / denom;
  if (t >= -1e-5 && t <= 1 + 1e-5 && u >= -1e-5 && u <= 1 + 1e-5) {
    return {
      intersects: true,
      t: Math.max(0, Math.min(1, t)),
      u: Math.max(0, Math.min(1, u)),
      x: ax + t * rX,
      y: ay + t * rY,
    };
  }
  return { intersects: false, t: 1, u: 1, x: bx, y: by };
}

/**
 * Shortest distance from point (px, py) to segment (x1, y1)-(x2, y2).
 */
export function distancePointToSegment2D(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Checks whether a straight line-of-sight between (originXPx, originYPx) and (targetXPx, targetYPx)
 * is unobstructed by any blocking wall or closed door within `maxRadiusPx`.
 */
export function isPointVisibleFromOrigin(
  originXPx: number,
  originYPx: number,
  targetXPx: number,
  targetYPx: number,
  maxRadiusPx: number,
  blockingWallsPx: Array<{ x1: number; y1: number; x2: number; y2: number }>
): boolean {
  const dist = Math.hypot(targetXPx - originXPx, targetYPx - originYPx);
  if (dist > maxRadiusPx + 0.5) return false;
  if (!blockingWallsPx || blockingWallsPx.length === 0 || dist < 1e-3) return true;

  for (let i = 0; i < blockingWallsPx.length; i++) {
    const w = blockingWallsPx[i];
    const hit = intersectSegments2D(
      originXPx,
      originYPx,
      targetXPx,
      targetYPx,
      w.x1,
      w.y1,
      w.x2,
      w.y2
    );
    // Block if intersection occurs before reaching the target center (t < 0.985)
    if (hit.intersects && hit.t > 0.015 && hit.t < 0.985) {
      return false;
    }
  }
  return true;
}

/**
 * Normalizes an angle in radians to the half-open interval `[-Math.PI, Math.PI]`.
 */
function normalizeAngleRad(angle: number): number {
  let a = angle;
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

/**
 * Computes a 2D Raycast Visibility Polygon from `(originXPx, originYPx)` up to `maxRadiusPx`,
 * clipped against all solid walls and closed doors (`blockingWallsPx`).
 * Designed for 60 FPS canvas rendering of dynamic light, player vision, and explored memory shadows.
 */
export function computeVisibilityPolygon(
  originXPx: number,
  originYPx: number,
  maxRadiusPx: number,
  blockingWallsPx: Array<{ x1: number; y1: number; x2: number; y2: number }>
): Array<{ x: number; y: number }> {
  if (maxRadiusPx <= 0) return [];

  // Filter to only wall segments near the light/vision radius for O(N_local) speed at 60 FPS
  const activeSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  if (blockingWallsPx && blockingWallsPx.length > 0) {
    const pad = maxRadiusPx + 8;
    for (let i = 0; i < blockingWallsPx.length; i++) {
      const s = blockingWallsPx[i];
      const minX = Math.min(s.x1, s.x2);
      const maxX = Math.max(s.x1, s.x2);
      const minY = Math.min(s.y1, s.y2);
      const maxY = Math.max(s.y1, s.y2);
      if (
        maxX < originXPx - pad ||
        minX > originXPx + pad ||
        maxY < originYPx - pad ||
        minY > originYPx + pad
      ) {
        continue;
      }
      if (distancePointToSegment2D(originXPx, originYPx, s.x1, s.y1, s.x2, s.y2) <= pad) {
        activeSegments.push(s);
      }
    }
  }

  // Fast path: if no walls are within the radius, return a smooth 64-vertex circle
  if (activeSegments.length === 0) {
    const pts: Array<{ x: number; y: number }> = [];
    const steps = 64;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 - Math.PI;
      pts.push({
        x: originXPx + Math.cos(a) * maxRadiusPx,
        y: originYPx + Math.sin(a) * maxRadiusPx,
      });
    }
    return pts;
  }

  // Collect ray angles: 120 circular perimeter steps + normalized grazing angles around every wall endpoint
  const angles: number[] = [-Math.PI, Math.PI];
  const baseSteps = 120;
  for (let i = 0; i < baseSteps; i++) {
    angles.push((i / baseSteps) * Math.PI * 2 - Math.PI);
  }

  const eps1 = 0.00018;
  const eps2 = 0.00075;
  for (let i = 0; i < activeSegments.length; i++) {
    const s = activeSegments[i];
    const a1 = Math.atan2(s.y1 - originYPx, s.x1 - originXPx);
    const a2 = Math.atan2(s.y2 - originYPx, s.x2 - originXPx);
    angles.push(
      normalizeAngleRad(a1 - eps2),
      normalizeAngleRad(a1 - eps1),
      normalizeAngleRad(a1),
      normalizeAngleRad(a1 + eps1),
      normalizeAngleRad(a1 + eps2),
      normalizeAngleRad(a2 - eps2),
      normalizeAngleRad(a2 - eps1),
      normalizeAngleRad(a2),
      normalizeAngleRad(a2 + eps1),
      normalizeAngleRad(a2 + eps2)
    );
  }

  angles.sort((a, b) => a - b);

  const polygon: Array<{ x: number; y: number }> = [];
  let prevAngle = -999;

  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i];
    if (Math.abs(angle - prevAngle) < 1e-6) continue;
    prevAngle = angle;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const rayEndX = originXPx + dx * maxRadiusPx;
    const rayEndY = originYPx + dy * maxRadiusPx;

    let closestT = 1;
    let closestX = rayEndX;
    let closestY = rayEndY;

    for (let j = 0; j < activeSegments.length; j++) {
      const seg = activeSegments[j];
      const hit = intersectSegments2D(
        originXPx,
        originYPx,
        rayEndX,
        rayEndY,
        seg.x1,
        seg.y1,
        seg.x2,
        seg.y2
      );
      if (hit.intersects && hit.t > 1e-6 && hit.t < closestT) {
        closestT = hit.t;
        closestX = hit.x;
        closestY = hit.y;
      }
    }

    polygon.push({ x: closestX, y: closestY });
  }

  return polygon;
}

/**
 * Resolves token movement from `(startX, startY)` to `(targetX, targetY)` in grid coordinates,
 * preventing tokens from crossing or overlapping solid walls (`parede`) or closed doors (`porta` with `!aberta`).
 * When a door is open (`aberta: true`), the token passes through freely!
 */
export function resolveTokenMovementWithWalls(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  tokenWidthSquares: number,
  tokenHeightSquares: number,
  paredes: MapWallSegment[] | undefined,
  colisaoParedesAtiva: boolean = true
): { x: number; y: number; collided: boolean } {
  const blocking = getBlockingWallSegments(paredes, colisaoParedesAtiva);
  if (blocking.length === 0) {
    return { x: targetX, y: targetY, collided: false };
  }

  const halfW = (tokenWidthSquares || 1) / 2;
  const halfH = (tokenHeightSquares || 1) / 2;
  const bodyRadius = Math.min(halfW, halfH) * 0.92; // Keep full token body & center on its own side of the wall/door

  const isStepBlocked = (fromTopX: number, fromTopY: number, toTopX: number, toTopY: number): boolean => {
    const c1x = fromTopX + halfW;
    const c1y = fromTopY + halfH;
    const c2x = toTopX + halfW;
    const c2y = toTopY + halfH;

    for (let i = 0; i < blocking.length; i++) {
      const w = blocking[i];
      // 1. Check if center-to-center movement crosses the wall segment
      const hit = intersectSegments2D(c1x, c1y, c2x, c2y, w.x1, w.y1, w.x2, w.y2);
      if (hit.intersects) return true;

      // 2. Check if target token body overlaps the wall segment
      const distToWall = distancePointToSegment2D(c2x, c2y, w.x1, w.y1, w.x2, w.y2);
      const startDistToWall = distancePointToSegment2D(c1x, c1y, w.x1, w.y1, w.x2, w.y2);
      if (distToWall < bodyRadius && (distToWall < startDistToWall || distToWall < 0.22)) {
        return true;
      }
    }
    return false;
  };

  // Direct movement check
  if (!isStepBlocked(startX, startY, targetX, targetY)) {
    return { x: targetX, y: targetY, collided: false };
  }

  // Sub-step along the movement path to stop right before the wall
  const dx = targetX - startX;
  const dy = targetY - startY;
  const totalDist = Math.hypot(dx, dy);
  const steps = Math.max(8, Math.min(48, Math.ceil(totalDist / 0.08)));

  let bestX = startX;
  let bestY = startY;
  for (let s = 1; s <= steps; s++) {
    const frac = s / steps;
    const candX = startX + dx * frac;
    const candY = startY + dy * frac;
    if (!isStepBlocked(bestX, bestY, candX, candY)) {
      bestX = candX;
      bestY = candY;
    } else {
      break;
    }
  }

  // Try sliding along X or Y axis from `bestX, bestY`
  if (Math.abs(targetX - bestX) > 0.01 && !isStepBlocked(bestX, bestY, targetX, bestY)) {
    bestX = targetX;
  } else if (Math.abs(targetY - bestY) > 0.01 && !isStepBlocked(bestX, bestY, bestX, targetY)) {
    bestY = targetY;
  }

  const quarterX = Math.round(bestX * 4) / 4;
  const quarterY = Math.round(bestY * 4) / 4;
  if (!isStepBlocked(startX, startY, quarterX, quarterY)) {
    return {
      x: quarterX,
      y: quarterY,
      collided: true,
    };
  }

  return {
    x: Math.round(bestX * 100) / 100,
    y: Math.round(bestY * 100) / 100,
    collided: true,
  };
}

/**
 * Snaps a grid point `(x, y)` to any existing wall or door endpoint within `snapRadiusSquares`
 * so manually drawn walls and doors connect seamlessly without corner gaps.
 */
export function snapPointToExistingWallEndpoints(
  x: number,
  y: number,
  paredes: MapWallSegment[] | undefined,
  snapRadiusSquares: number = 0.45
): { x: number; y: number } {
  if (!paredes || paredes.length === 0) return { x, y };
  let bestX = x;
  let bestY = y;
  let bestDist = snapRadiusSquares;
  for (const w of paredes) {
    const d1 = Math.hypot(w.x1 - x, w.y1 - y);
    if (d1 <= bestDist) {
      bestDist = d1;
      bestX = w.x1;
      bestY = w.y1;
    }
    const d2 = Math.hypot(w.x2 - x, w.y2 - y);
    if (d2 <= bestDist) {
      bestDist = d2;
      bestX = w.x2;
      bestY = w.y2;
    }
  }
  return { x: bestX, y: bestY };
}

/**
 * Inserts a manually drawn wall or door segment into `existingWalls`.
 * - Snaps endpoints to nearby existing wall/door vertices so corners are 100% airtight.
 * - When `newSegment.tipo === 'porta'` is drawn on top of an existing collinear `parede` segment,
 *   automatically splits/carves the underlying `parede` so opening the door allows light and tokens to pass!
 */
export function insertWallOrDoorSegment(
  existingWalls: MapWallSegment[] | undefined,
  newSegment: MapWallSegment
): MapWallSegment[] {
  const list = existingWalls ? [...existingWalls] : [];
  const p1 = snapPointToExistingWallEndpoints(newSegment.x1, newSegment.y1, list, 0.35);
  const p2 = snapPointToExistingWallEndpoints(newSegment.x2, newSegment.y2, list, 0.35);
  const seg: MapWallSegment = {
    ...newSegment,
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
  };

  if (seg.tipo !== 'porta') {
    return [...list, seg];
  }

  // If placing a door (`porta`) along an existing solid wall (`parede`), carve the doorway out of the wall
  const updated: MapWallSegment[] = [];
  const dxDoor = seg.x2 - seg.x1;
  const dyDoor = seg.y2 - seg.y1;
  const lenDoor = Math.hypot(dxDoor, dyDoor);

  for (const w of list) {
    if (w.tipo !== 'parede' || lenDoor < 0.2) {
      updated.push(w);
      continue;
    }
    const wDx = w.x2 - w.x1;
    const wDy = w.y2 - w.y1;
    const wLenSq = wDx * wDx + wDy * wDy;
    const wLen = Math.sqrt(wLenSq);
    if (wLen < 0.2) {
      updated.push(w);
      continue;
    }

    // Check if door endpoints lie on (or very close to) the infinite line of wall `w` and are parallel
    const dist1 = distancePointToSegment2D(seg.x1, seg.y1, w.x1, w.y1, w.x2, w.y2);
    const dist2 = distancePointToSegment2D(seg.x2, seg.y2, w.x1, w.y1, w.x2, w.y2);
    const cross = Math.abs(dxDoor * wDy - dyDoor * wDx) / (lenDoor * wLen);

    if (cross < 0.15 && (dist1 < 0.35 || dist2 < 0.35)) {
      const t1 = ((seg.x1 - w.x1) * wDx + (seg.y1 - w.y1) * wDy) / wLenSq;
      const t2 = ((seg.x2 - w.x1) * wDx + (seg.y2 - w.y1) * wDy) / wLenSq;
      const tMin = Math.max(0, Math.min(t1, t2));
      const tMax = Math.min(1, Math.max(t1, t2));

      if (tMax - tMin > 0.05) {
        if (tMin > 0.04) {
          updated.push({
            ...w,
            id: `${w.id}-a`,
            x1: w.x1,
            y1: w.y1,
            x2: Math.round((w.x1 + wDx * tMin) * 100) / 100,
            y2: Math.round((w.y1 + wDy * tMin) * 100) / 100,
          });
        }
        if (tMax < 0.96) {
          updated.push({
            ...w,
            id: `${w.id}-b`,
            x1: Math.round((w.x1 + wDx * tMax) * 100) / 100,
            y1: Math.round((w.y1 + wDy * tMax) * 100) / 100,
            x2: w.x2,
            y2: w.y2,
          });
        }
        continue;
      }
    }

    updated.push(w);
  }

  return [...updated, seg];
}

/**
 * Checks whether the player's token (or any player-controlled character token on the map)
 * is touching or adjacent to a door segment (`tipo === 'porta'`).
 * - In Player View (`userRole === 'jogador'`), walls and door lines are invisible,
 *   and the interactive Door icon (`Abrir Porta` / `Fechar Porta`) only appears when the player's
 *   character token touches / is right next to the door (`distance <= tokenRadius + 1.25` grid squares).
 * - In GM View (`userRole === 'mestre'`), all doors and walls are always visible.
 */
export function isPlayerTokenTouchingDoor(
  tokens: MapToken[],
  doorSegment: MapWallSegment,
  options?: FogViewerOptions
): boolean {
  if (doorSegment.tipo !== 'porta') return false;
  if (options?.viewerRole === 'mestre') return true;

  const ownedTokens = tokens.filter(
    (t) => !t.ehFonteDeLuz && isTokenOwnedByViewer(t, options)
  );
  const candidateTokens =
    ownedTokens.length > 0
      ? ownedTokens
      : tokens.filter(
          (t) => !t.ehFonteDeLuz && !t.ocultoParaJogadores && t.categoria === 'character'
        );

  for (const t of candidateTokens) {
    const halfW = (t.larguraQuadrados || 1) / 2;
    const halfH = (t.alturaQuadrados || 1) / 2;
    const cx = t.x + halfW;
    const cy = t.y + halfH;
    const tokenRadius = Math.max(halfW, halfH);
    const dist = distancePointToSegment2D(
      cx,
      cy,
      doorSegment.x1,
      doorSegment.y1,
      doorSegment.x2,
      doorSegment.y2
    );
    if (dist <= tokenRadius + 1.25) {
      return true;
    }
  }
  return false;
}

/**
 * Determines if a token on the map is currently inside the Fog of War.
 * - When `options.viewerRole === 'jogador'` with `viewerSheetId`/`viewerTokenId`:
 *   1. The player always sees their own token.
 *   2. Any non-hidden token emitting Torch Light (`luzQuadrados > 0`) is visible to everyone (unless occluded by a wall from the player), and its light radius reveals nearby tokens for everyone (if not occluded by a wall between the light source and target).
 *   3. Vision (`visaoQuadrados > 0`) is EXCLUSIVE to the player's own token: another player's `visaoQuadrados` does NOT reveal the fog for this player.
 *   4. When `options.colisaoParedesAtiva` is true, walls (`parede`) and closed doors (`porta` with `!aberta`) block line of sight!
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

  const blockingWallsPx = getBlockingWallsPx(
    options?.paredes,
    gridSizePx,
    Boolean(options?.colisaoParedesAtiva)
  );

  const isStrictPlayerView =
    options?.viewerRole === 'jogador' &&
    Boolean(options.viewerSheetId || options.viewerTokenId);

  if (isStrictPlayerView) {
    // 1. The player always sees their own character token
    if (isTokenOwnedByViewer(targetToken, options)) {
      return false;
    }

    const targetCenterX = (targetToken.x + targetToken.larguraQuadrados / 2) * gridSizePx;
    const targetCenterY = (targetToken.y + targetToken.alturaQuadrados / 2) * gridSizePx;

    // 2. If the target token itself is emitting torch light (luzQuadrados > 0) and no walls block it, everyone can see that light!
    if ((targetToken.luzQuadrados || 0) > 0 && blockingWallsPx.length === 0) {
      return false;
    }

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
      const maxRadiusPx = revealSquares * gridSizePx;

      if (
        isPointVisibleFromOrigin(
          sourceCenterX,
          sourceCenterY,
          targetCenterX,
          targetCenterY,
          maxRadiusPx,
          blockingWallsPx
        )
      ) {
        return false; // Illuminated by public torch light or by the player's own vision without wall occlusion!
      }
    }

    // Outside public torch light / player vision or occluded behind a wall/closed door -> hidden in the fog!
    return true;
  }

  // Global / GM badge check:
  if (targetToken.luzQuadrados > 0 && blockingWallsPx.length === 0) return false;

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
    const maxRadiusPx = revealSquares * gridSizePx;

    if (
      isPointVisibleFromOrigin(
        sourceCenterX,
        sourceCenterY,
        targetCenterX,
        targetCenterY,
        maxRadiusPx,
        blockingWallsPx
      )
    ) {
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
 * - For the GM (`viewerRole === 'mestre'`): Returns explored memory trails of player hero tokens.
 * - When `colisaoParedesAtiva` is enabled, any memory point occluded behind a closed door or solid wall
 *   from the token's current position is excluded so closed rooms stay 100% pitch-black when outside.
 */
export function computePlayerExploredMemoryCircles(
  tokens: MapToken[],
  gridSizePx: number,
  options?: FogViewerOptions
): ExploredMemoryPixelCircle[] {
  const isStrictPlayerView =
    options?.viewerRole === 'jogador' &&
    Boolean(options.viewerSheetId || options.viewerTokenId);

  const blockingWallsPx = getBlockingWallsPx(
    options?.paredes,
    gridSizePx,
    Boolean(options?.colisaoParedesAtiva)
  );

  const relevantTokens = tokens.filter((t) => {
    if (t.ehFonteDeLuz) return false;
    if (t.ocultoParaJogadores && !isTokenOwnedByViewer(t, options)) return false;
    if (options?.viewerRole === 'mestre') {
      return (
        isTokenOwnedByViewer(t, options) ||
        Boolean(t.fichaId && t.fichaId !== 'char-goblin-chefe')
      );
    }
    if (isStrictPlayerView) {
      return isTokenOwnedByViewer(t, options);
    }
    return !t.ocultoParaJogadores;
  });

  const result: ExploredMemoryPixelCircle[] = [];
  for (const t of relevantTokens) {
    const tokenCenterX = (t.x + (t.larguraQuadrados || 1) / 2) * gridSizePx;
    const tokenCenterY = (t.y + (t.alturaQuadrados || 1) / 2) * gridSizePx;
    // Include previously recorded steps in memoriaExplorada
    const steps = recordTokenFogMemoryStep(t.memoriaExplorada, t);
    for (const step of steps) {
      if (step.raioQuadrados <= 0) continue;
      const stepXPx = step.x * gridSizePx;
      const stepYPx = step.y * gridSizePx;

      // If walls/doors are active and a blocking wall/closed door separates the token from this memory step,
      // do not let it lighten a closed room!
      if (
        blockingWallsPx.length > 0 &&
        !isPointVisibleFromOrigin(
          tokenCenterX,
          tokenCenterY,
          stepXPx,
          stepYPx,
          1e9,
          blockingWallsPx
        )
      ) {
        continue;
      }

      result.push({
        xPx: stepXPx,
        yPx: stepYPx,
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
    luzFalloff: 0.5,
    ehFonteDeLuz: true,
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };
}

/**
 * Computes the smooth natural light/vision attenuation intensity for normalized distance `d = distancia / raio` (0..1).
 * - At `d = 0` (center): intensity = `1` (maximum brightness).
 * - For `0 < d < 1`: smooth continuous polynomial falloff `(1 - d^2)^exponent` where `exponent = 0.5 + falloff * 3`
 *   (so default `falloff = 0.5` yields exact `(1 - d^2)^2`, decaying organically with zero abrupt steps).
 * - At `d >= 1` (boundary): intensity = `0` (completely dark, no ring or hard edge).
 */
export function computeLightFalloffIntensity(d: number, falloff: number = 0.5): number {
  if (!Number.isFinite(d) || d <= 0) return 1;
  if (d >= 1) return 0;
  const clampedFalloff = Math.max(0, Math.min(1, Number.isFinite(falloff) ? falloff : 0.5));
  const exponent = 0.5 + clampedFalloff * 3;
  const base = Math.max(0, 1 - d * d);
  return Math.max(0, Math.min(1, Math.pow(base, exponent)));
}

/**
 * Generates multi-stop radial gradient stops `[offset, alpha]` from `d = 0` to `d = 1`
 * so Canvas 2D `createRadialGradient(x, y, 0, x, y, radiusPx)` renders a continuous, ring-free smooth falloff.
 */
export function buildSmoothFalloffGradientStops(
  falloff: number = 0.5
): Array<{ offset: number; intensity: number }> {
  const sampleOffsets = [0, 0.14, 0.28, 0.42, 0.56, 0.68, 0.79, 0.88, 0.95, 1];
  return sampleOffsets.map((offset) => ({
    offset,
    intensity: Number(computeLightFalloffIntensity(offset, falloff).toFixed(4)),
  }));
}


