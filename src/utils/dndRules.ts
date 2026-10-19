import type {
  AbilityKey,
  AbilityScores,
  CharacterSheet,
  CombatLogEntry,
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

  // Filter tokens that represent characters or monsters/mounts in combat
  const combatTokens = tokens.filter(
    (t) => t.categoria === 'character' || t.categoria === 'mount'
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

export function computeDynamicTokenVisionCircles(
  tokens: MapToken[],
  gridSizePx: number
): VisionLightCircle[] {
  return tokens
    .filter((t) => !t.ocultoParaJogadores && (t.visaoQuadrados > 0 || t.luzQuadrados > 0))
    .map((t) => {
      const centerX = (t.x + t.larguraQuadrados / 2) * gridSizePx;
      const centerY = (t.y + t.alturaQuadrados / 2) * gridSizePx;
      const visionRadiusPx = Math.max(0, t.visaoQuadrados) * gridSizePx;
      const lightRadiusPx = Math.max(0, t.luzQuadrados) * gridSizePx;
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
 * Determines if a token on the map is currently inside the Fog of War (outside any active player/prop vision or light circle).
 * If a token emits its own light (`luzQuadrados > 0`), or is a player-controlled hero with vision (`fichaId` not hidden by GM),
 * or stands inside any illuminated/vision circle, it is visible. Otherwise, when inside the fog, it becomes hidden from players' eyes (only the GM sees it).
 */
export function isTokenInsideFog(
  targetToken: MapToken,
  allTokens: MapToken[],
  sheets: CharacterSheet[],
  nevoaAtiva: boolean,
  gridSizePx: number
): boolean {
  if (!nevoaAtiva) return false;
  if (targetToken.ocultoParaJogadores) return true;
  // If the token itself has an active light source (torch/lamp), it reveals itself in the fog
  if (targetToken.luzQuadrados > 0) return false;

  const sheetMap = new Map<string, CharacterSheet>(sheets.map((s) => [s.id, s]));
  const targetSheet = targetToken.fichaId ? sheetMap.get(targetToken.fichaId) : undefined;
  const isPlayerHero = Boolean(targetSheet && !targetSheet.ehMestreOculto);

  // Player heroes with darkvision/sight see themselves
  if (isPlayerHero && targetToken.visaoQuadrados > 0) {
    return false;
  }

  const targetCenterX = (targetToken.x + targetToken.larguraQuadrados / 2) * gridSizePx;
  const targetCenterY = (targetToken.y + targetToken.alturaQuadrados / 2) * gridSizePx;

  // Check if targetToken is within the vision or light radius of any player hero or lit prop/token
  for (const source of allTokens) {
    if (source.ocultoParaJogadores) continue;
    const sourceSheet = source.fichaId ? sheetMap.get(source.fichaId) : undefined;
    const sourceIsPlayerHero = Boolean(sourceSheet && !sourceSheet.ehMestreOculto);

    // Sources that reveal the fog for players:
    // 1. Any token/prop emitting light (`luzQuadrados > 0`)
    // 2. Any player hero token with vision (`visaoQuadrados > 0`)
    const revealSquares = Math.max(
      source.luzQuadrados || 0,
      sourceIsPlayerHero ? source.visaoQuadrados || 0 : 0
    );

    if (revealSquares <= 0) continue;

    const sourceCenterX = (source.x + source.larguraQuadrados / 2) * gridSizePx;
    const sourceCenterY = (source.y + source.alturaQuadrados / 2) * gridSizePx;
    const distPx = Math.hypot(targetCenterX - sourceCenterX, targetCenterY - sourceCenterY);

    if (distPx <= revealSquares * gridSizePx) {
      return false; // Illuminated / within sight!
    }
  }

  // Otherwise, the token is deep inside the unrevealed Fog of War!
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
