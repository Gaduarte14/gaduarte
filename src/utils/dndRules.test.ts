import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAbilityModifier,
  calculateInitiativeModifier,
  calculatePassivePerception,
  calculateProficiencyBonus,
  calculateSavingThrowBonus,
  calculateSkillBonus,
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  computeDynamicTokenVisionCircles,
  evaluateDiceExpression,
  extractYouTubeId,
  formatModifier,
  interpolateSheetVariables,
  isTokenInsideFog,
  rollTableInitiativeForTokens,
  syncCampaignCharacterNames,
} from './dndRules.ts';
import type { CharacterSheet, MapToken } from '../types/vtt.ts';

const mockSheet: CharacterSheet = {
  id: 'char-elara',
  nomePersonagem: 'Elara Sombralua',
  classeNivel: 'Mago 8',
  nivel: 8,
  antecedente: 'Sábio',
  nomeJogador: 'Phap La',
  raca: 'Alto Elfo',
  tendencia: 'Neutro e Bom',
  experiencia: 34000,
  inspiracao: true,
  bonusProficiencia: 3,
  classeArmadura: 15,
  iniciativaBonusExtra: 0,
  deslocamento: '12m',
  pvMaximo: 26,
  pvAtual: 26,
  pvTemporario: 0,
  dadosVidaTotal: '8d6',
  dadosVidaRestantes: 8,
  sucessosMorte: 0,
  fracassosMorte: 0,
  atributos: {
    forca: 8,        // -1 (matches user PDF page 1!)
    destreza: 20,    // +5 (matches user PDF page 1!)
    constituicao: 8, // -1 (matches user PDF page 1!)
    inteligencia: 20,// +5 (matches user PDF page 1!)
    sabedoria: 12,   // +1 (matches user PDF page 1!)
    carisma: 10,     // +0 (matches user PDF page 1!)
  },
  salvaguardasProficiencia: {
    forca: false,
    destreza: false,
    constituicao: false,
    inteligencia: true, // +5 + 3 = +8 (matches user PDF page 1!)
    sabedoria: true,    // +1 + 3 = +4 (matches user PDF page 1!)
    carisma: false,
  },
  periciasProficiencia: {
    acrobacia: true,
    arcanismo: true,
    atletismo: false,
    atuacao: false,
    blefar: false,
    furtividade: true,
    historia: true,
    intimidacao: false,
    intuicao: false,
    investigacao: true,
    lidarComAnimais: false,
    medicina: false,
    natureza: false,
    percepcao: true,
    persuasao: false,
    prestidigitacao: false,
    religiao: false,
    sobrevivencia: false,
  },
  ataques: [],
  macros: [],
  moedas: { pc: 0, pp: 10, pe: 0, po: 120, pl: 2 },
  inventario: [],
  idiomasProficiencias: 'Comum, Élfico, Dracônico, Silvestre',
  caracteristicasHabilidades: 'Recuperação Arcana, Tradição Arcana',
  tracosPersonalidade: 'Curiosa com relíquias antigas.',
  ideais: 'Conhecimento é o caminho.',
  ligacoes: 'Proteger a biblioteca de Silverymoon.',
  defeitos: 'Não resiste a um grimório proibido.',
  idade: '112 anos',
  altura: '1,72m',
  pesoCorp: '58kg',
  olhos: 'Violeta',
  pele: 'Alva',
  cabelos: 'Prateados',
  aparenciaUrl: '',
  historiaPersonagem: '',
  aliadosOrganizacoes: 'Harpistas',
  simboloNome: 'Lua Crescente',
  tesouro: 'Anel de Proteção Arcana',
  classeConjurador: 'Mago',
  habilidadeChaveConjuracao: 'inteligencia',
  espacosMagia: { 1: { total: 4, usados: 1 } },
  magias: [],
  corToken: '#8b5cf6',
  avatarUrl: '',
  visaoAlcanceQuadrados: 6,
  luzAlcanceQuadrados: 4,
  atualizadoEm: 1700000000000,
};

test('D&D 5e ability modifiers and saving throws match PDF sheet values', () => {
  assert.equal(calculateAbilityModifier(8), -1);
  assert.equal(calculateAbilityModifier(20), 5);
  assert.equal(calculateAbilityModifier(12), 1);
  assert.equal(calculateAbilityModifier(10), 0);

  // Saving throws from PDF page 1: For -1, Des +5, Con -1, Int +8, Sab +4, Car +0
  assert.equal(calculateSavingThrowBonus(mockSheet, 'forca'), -1);
  assert.equal(calculateSavingThrowBonus(mockSheet, 'destreza'), 5);
  assert.equal(calculateSavingThrowBonus(mockSheet, 'constituicao'), -1);
  assert.equal(calculateSavingThrowBonus(mockSheet, 'inteligencia'), 8);
  assert.equal(calculateSavingThrowBonus(mockSheet, 'sabedoria'), 4);
  assert.equal(calculateSavingThrowBonus(mockSheet, 'carisma'), 0);

  // Spell Save DC & Attack Bonus from PDF page 3: Int, DC 16, Attack +8
  assert.equal(calculateSpellSaveDC(mockSheet), 16);
  assert.equal(calculateSpellAttackBonus(mockSheet), 8);
});

test('Skill bonus, passive perception, and proficiency calculations', () => {
  assert.equal(calculateProficiencyBonus(1), 2);
  assert.equal(calculateProficiencyBonus(5), 3);
  assert.equal(calculateProficiencyBonus(9), 4);
  assert.equal(calculateSkillBonus(mockSheet, 'arcanismo'), 8); // +5 Int + 3 Prof
  assert.equal(calculateSkillBonus(mockSheet, 'atletismo'), -1); // -1 For
  assert.equal(calculatePassivePerception(mockSheet), 14); // 10 + 1 Sab + 3 Prof
  assert.equal(formatModifier(5), '+5');
  assert.equal(formatModifier(-1), '-1');
});

test('Variable interpolation and Rollem dice expression evaluation', () => {
  const resolved = interpolateSheetVariables('1d20+{iniciativa}', mockSheet);
  assert.equal(resolved, '1d20+5');

  // Deterministic RNG returning 0.99 -> rolls max face (20 on d20)
  const rollMax = evaluateDiceExpression('1d20+{iniciativa} # Iniciativa', mockSheet, () => 0.99);
  assert.equal(rollMax.resultadoFinal, 25);
  assert.equal(rollMax.criticoSucesso, true);
  assert.equal(rollMax.rotulo, 'Iniciativa');

  // Keep highest (Advantage: 2d20kh1+5)
  let call = 0;
  const seqRng = () => {
    call++;
    return call === 1 ? 0.1 : 0.75; // 1st d20 = 3, 2nd d20 = 16
  };
  const advRoll = evaluateDiceExpression('2d20kh1+5', mockSheet, seqRng);
  assert.equal(advRoll.dadosIndividuais.length, 2);
  assert.equal(advRoll.dadosIndividuais[0].descartado, true);
  assert.equal(advRoll.dadosIndividuais[1].descartado, undefined);
  assert.equal(advRoll.resultadoFinal, 16 + 5);
});

test('Batch initiative roll adds all tokens and sorts descending by total', () => {
  const tokens: MapToken[] = [
    {
      id: 'tok-1',
      nome: 'Goblin Batedor',
      categoria: 'character',
      x: 2,
      y: 2,
      larguraQuadrados: 1,
      alturaQuadrados: 1,
      rotacao: 0,
      cor: '#ef4444',
      imagemUrl: '',
      visaoQuadrados: 4,
      luzQuadrados: 0,
      luzCor: '#f59e0b',
      ocultoParaJogadores: false,
      bloqueado: false,
      condicoes: [],
    },
    {
      id: 'tok-2',
      nome: 'Elara Sombralua',
      categoria: 'character',
      fichaId: 'char-elara',
      x: 5,
      y: 5,
      larguraQuadrados: 1,
      alturaQuadrados: 1,
      rotacao: 0,
      cor: '#8b5cf6',
      imagemUrl: '',
      visaoQuadrados: 6,
      luzQuadrados: 4,
      luzCor: '#f59e0b',
      ocultoParaJogadores: false,
      bloqueado: false,
      condicoes: [],
    },
  ];

  // Both roll 10 on d20 (rng = 0.49), Elara has +5 initiative = 15, Goblin has +0 = 10
  const { participantes, logs } = rollTableInitiativeForTokens(tokens, [mockSheet], () => 0.49);
  assert.equal(participantes.length, 2);
  assert.equal(logs.length, 2);
  assert.equal(participantes[0].nome, 'Elara Sombralua');
  assert.equal(participantes[0].iniciativaTotal, 15);
  assert.equal(participantes[1].nome, 'Goblin Batedor');
  assert.equal(participantes[1].iniciativaTotal, 10);
});

test('YouTube URL extraction and dynamic vision circle calculation', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=jfKfPfyJRdk'), 'jfKfPfyJRdk');
  assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=123'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('invalid-url'), null);

  const circles = computeDynamicTokenVisionCircles(
    [
      {
        id: 'tok-elara',
        nome: 'Elara',
        categoria: 'character',
        x: 4,
        y: 6,
        larguraQuadrados: 1,
        alturaQuadrados: 1,
        rotacao: 0,
        cor: '#8b5cf6',
        imagemUrl: '',
        visaoQuadrados: 6,
        luzQuadrados: 8,
        luzCor: '#f59e0b',
        ocultoParaJogadores: false,
        bloqueado: false,
        condicoes: [],
      },
    ],
    64
  );

  assert.equal(circles.length, 1);
  assert.equal(circles[0].xPx, 4.5 * 64);
  assert.equal(circles[0].yPx, 6.5 * 64);
  assert.equal(circles[0].effectiveRadiusPx, 8 * 64);
});

test('Campaign roster names sync automatically with character sheets', () => {
  const synced = syncCampaignCharacterNames(['Thorin Escudo de Ferro'], [mockSheet]);
  assert.deepEqual(synced, ['Thorin Escudo de Ferro', 'Elara Sombralua']);
});

test('Token inside Fog of War is hidden from players unless within vision or carrying light', () => {
  const heroToken: MapToken = {
    id: 'tok-elara',
    nome: 'Elara',
    categoria: 'character',
    fichaId: 'char-elara',
    x: 2,
    y: 2,
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: '#8b5cf6',
    imagemUrl: '',
    visaoQuadrados: 4, // sees 4 squares around (2,2)
    luzQuadrados: 0,
    luzCor: '#f59e0b',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };

  const distantGoblinInFog: MapToken = {
    id: 'tok-goblin',
    nome: 'Goblin na Névoa',
    categoria: 'character',
    x: 15,
    y: 15, // 18+ squares away -> deep in fog!
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: '#ef4444',
    imagemUrl: '',
    visaoQuadrados: 4,
    luzQuadrados: 0, // no light
    luzCor: '#ef4444',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };

  // Goblin is far in the fog without light -> hidden from players (true)
  assert.equal(
    isTokenInsideFog(distantGoblinInFog, [heroToken, distantGoblinInFog], [mockSheet], true, 64),
    true
  );

  // If the GM adds light (torch = 4 squares) to the Goblin, it reveals itself!
  const litGoblin: MapToken = { ...distantGoblinInFog, luzQuadrados: 4 };
  assert.equal(
    isTokenInsideFog(litGoblin, [heroToken, litGoblin], [mockSheet], true, 64),
    false
  );

  // If Goblin moves next to Elara (within her 4-square vision), it becomes visible to players!
  const closeGoblin: MapToken = { ...distantGoblinInFog, x: 4, y: 2 };
  assert.equal(
    isTokenInsideFog(closeGoblin, [heroToken, closeGoblin], [mockSheet], true, 64),
    false
  );
});

test('Official D&D 5e status conditions toggle, lookup, and metadata', async () => {
  const { DND_CONDITIONS, getConditionMeta, hasConditionInList, toggleConditionInList } =
    await import('./dndRules.ts');

  assert.ok(DND_CONDITIONS.length >= 15);
  const poisoned = getConditionMeta('envenenado');
  assert.equal(poisoned.label, 'Envenenado');
  assert.equal(poisoned.icon, '☠️');

  const frightened = getConditionMeta('Aterrorizado');
  assert.equal(frightened.key, 'aterrorizado');
  assert.equal(frightened.icon, '😱');

  const restrained = getConditionMeta('Imobilizado');
  assert.equal(restrained.key, 'imobilizado');
  assert.equal(restrained.icon, '⛓️');

  let list: string[] = [];
  list = toggleConditionInList(list, 'envenenado');
  assert.equal(hasConditionInList(list, 'Envenenado'), true);
  list = toggleConditionInList(list, 'aterrorizado');
  assert.deepEqual(list, ['Envenenado', 'Aterrorizado']);
  list = toggleConditionInList(list, 'envenenado');
  assert.deepEqual(list, ['Aterrorizado']);
});

test('Fog of War: Torch Light (luzQuadrados) is visible to everyone while Vision (visaoQuadrados) is exclusive to the player who owns the token', () => {
  const elaraToken: MapToken = {
    id: 'tok-elara',
    nome: 'Elara Sombralua',
    categoria: 'character',
    fichaId: 'char-elara',
    x: 2,
    y: 2,
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: '#8b5cf6',
    imagemUrl: '',
    visaoQuadrados: 6, // 6 squares personal darkvision
    luzQuadrados: 0, // No torch lit
    luzCor: '#a78bfa',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };

  const thorinWithoutTorch: MapToken = {
    id: 'tok-thorin',
    nome: 'Thorin Escudo de Ferro',
    categoria: 'character',
    fichaId: 'char-thorin',
    x: 18,
    y: 12,
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: '#f59e0b',
    imagemUrl: '',
    visaoQuadrados: 5, // 5 squares personal vision (exclusive to Thorin!)
    luzQuadrados: 0, // No torch lit
    luzCor: '#f59e0b',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };

  const goblinNearThorin: MapToken = {
    id: 'tok-goblin',
    nome: 'Goblin Batedor',
    categoria: 'character',
    x: 19,
    y: 12,
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: '#ef4444',
    imagemUrl: '',
    visaoQuadrados: 4,
    luzQuadrados: 0,
    luzCor: '#f59e0b',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };

  const tokensNoTorch = [elaraToken, thorinWithoutTorch, goblinNearThorin];

  // 1. When Thorin has NO torch (luzQuadrados = 0), only his vision (visaoQuadrados = 5) is active.
  //    Player Elara does NOT see Thorin's vision circle (only her own vision circle is generated):
  const elaraCirclesNoTorch = computeDynamicTokenVisionCircles(tokensNoTorch, 64, {
    viewerRole: 'jogador',
    viewerSheetId: 'char-elara',
  });
  assert.equal(elaraCirclesNoTorch.length, 1);
  assert.equal(elaraCirclesNoTorch[0].tokenId, 'tok-elara');
  assert.equal(elaraCirclesNoTorch[0].visionRadiusPx, 6 * 64);

  // 2. For Player Thorin, ONLY Thorin's vision circle is generated (not Elara's vision):
  const thorinCirclesNoTorch = computeDynamicTokenVisionCircles(tokensNoTorch, 64, {
    viewerRole: 'jogador',
    viewerSheetId: 'char-thorin',
  });
  assert.equal(thorinCirclesNoTorch.length, 1);
  assert.equal(thorinCirclesNoTorch[0].tokenId, 'tok-thorin');
  assert.equal(thorinCirclesNoTorch[0].visionRadiusPx, 5 * 64);

  // 3. Goblin near Thorin is visible to Thorin (via Thorin's personal vision),
  //    but HIDDEN in the fog for Elara (because Elara does not see Thorin's personal vision!):
  assert.equal(
    isTokenInsideFog(goblinNearThorin, tokensNoTorch, [mockSheet], true, 64, {
      viewerRole: 'jogador',
      viewerSheetId: 'char-thorin',
    }),
    false
  );
  assert.equal(
    isTokenInsideFog(goblinNearThorin, tokensNoTorch, [mockSheet], true, 64, {
      viewerRole: 'jogador',
      viewerSheetId: 'char-elara',
    }),
    true
  );

  // 4. Now Thorin lights a Torch (`luzQuadrados: 4`)!
  //    Because Torch Light (`[ luz ]`) is visible to EVERYONE, Elara now sees Thorin's 4-square light circle
  //    (still NOT Thorin's 5-square personal vision) AND sees the Goblin illuminated by Thorin's torch!
  const thorinWithTorch: MapToken = { ...thorinWithoutTorch, luzQuadrados: 4 };
  const tokensWithTorch = [elaraToken, thorinWithTorch, goblinNearThorin];

  const elaraCirclesWithTorch = computeDynamicTokenVisionCircles(tokensWithTorch, 64, {
    viewerRole: 'jogador',
    viewerSheetId: 'char-elara',
  });
  assert.equal(elaraCirclesWithTorch.length, 2);
  const thorinCircleForElara = elaraCirclesWithTorch.find((c) => c.tokenId === 'tok-thorin');
  assert.ok(thorinCircleForElara);
  assert.equal(thorinCircleForElara.visionRadiusPx, 0); // Thorin's personal vision is still hidden from Elara
  assert.equal(thorinCircleForElara.lightRadiusPx, 4 * 64); // But Thorin's 4-square torch light is visible to everyone!
  assert.equal(thorinCircleForElara.effectiveRadiusPx, 4 * 64);

  // Both Thorin (holding the torch) and the Goblin standing in Thorin's torch light are now visible to Elara!
  assert.equal(
    isTokenInsideFog(thorinWithTorch, tokensWithTorch, [mockSheet], true, 64, {
      viewerRole: 'jogador',
      viewerSheetId: 'char-elara',
    }),
    false
  );
  assert.equal(
    isTokenInsideFog(goblinNearThorin, tokensWithTorch, [mockSheet], true, 64, {
      viewerRole: 'jogador',
      viewerSheetId: 'char-elara',
    }),
    false
  );
});



