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

test('Token Fog Memory (memoriaExplorada) records path where player token walked with [Luz] or [Visão] and keeps it in player memory even after light is turned off', async () => {
  const {
    recordTokenFogMemoryPath,
    computePlayerExploredMemoryCircles,
    createInvisibleLightToken,
  } = await import('./dndRules.ts');

  let elara: MapToken = {
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
    visaoQuadrados: 0,
    luzQuadrados: 4, // Walking with a 4-square torch
    luzCor: '#f59e0b',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };

  // Elara walks from (2,2) to (8,2) while carrying her 4-square torch:
  const memTrail = recordTokenFogMemoryPath(
    elara.memoriaExplorada,
    { ...elara, x: 8, y: 2 },
    { x: 2, y: 2 }
  );
  assert.ok(memTrail.length > 3, 'Should interpolate multiple memory circles along the walked path');

  // Even after Elara moves to (8,2) AND extinguishes her torch (luzQuadrados = 0, visaoQuadrados = 0),
  // the places where she already walked remain in her explored memory!
  elara = {
    ...elara,
    x: 8,
    y: 2,
    luzQuadrados: 0,
    visaoQuadrados: 0,
    memoriaExplorada: memTrail,
  };

  const exploredForElara = computePlayerExploredMemoryCircles([elara], 64, {
    viewerRole: 'jogador',
    viewerSheetId: 'char-elara',
  });
  assert.equal(exploredForElara.length, memTrail.length);
  // Start position (2.5 * 64, 2.5 * 64) and end position (8.5 * 64, 2.5 * 64) are both remembered
  assert.ok(exploredForElara.some((c) => c.xPx === 2.5 * 64 && c.yPx === 2.5 * 64));
  assert.ok(exploredForElara.some((c) => c.xPx === 8.5 * 64 && c.yPx === 2.5 * 64));

  // Another player (Thorin) does NOT see Elara's personal explored memory trail:
  const exploredForThorin = computePlayerExploredMemoryCircles([elara], 64, {
    viewerRole: 'jogador',
    viewerSheetId: 'char-thorin',
  });
  assert.equal(exploredForThorin.length, 0);

  // Placed 100% invisible [Luz] token emits public light for everyone and can be resized
  const placedLight = createInvisibleLightToken(10, 10, 5);
  assert.equal(placedLight.ehFonteDeLuz, true);
  assert.equal(placedLight.luzQuadrados, 5);
  assert.equal(placedLight.visaoQuadrados, 0);

  const circlesWithPlacedLight = computeDynamicTokenVisionCircles([elara, placedLight], 64, {
    viewerRole: 'jogador',
    viewerSheetId: 'char-thorin',
  });
  assert.equal(circlesWithPlacedLight.length, 1);
  assert.equal(circlesWithPlacedLight[0].tokenId, placedLight.id);
  assert.equal(circlesWithPlacedLight[0].lightRadiusPx, 5 * 64);
});

test('Wall collision & Door open/close system: solid walls and closed doors block both token movement and light/vision rays; open doors allow passage', async () => {
  const {
    resolveTokenMovementWithWalls,
    computeVisibilityPolygon,
    computePlayerExploredMemoryCircles,
    isPointVisibleFromOrigin,
    getBlockingWallsPx,
    isTokenInsideFog,
    insertWallOrDoorSegment,
  } = await import('./dndRules.ts');
  type WallSeg = import('../types/vtt.ts').MapWallSegment;

  // Vertical wall at x = 10 from y = 0 to y = 4, and a door from y = 4 to y = 6
  const wallsWithClosedDoor: WallSeg[] = [
    { id: 'w-1', x1: 10, y1: 0, x2: 10, y2: 4, tipo: 'parede' },
    { id: 'd-1', x1: 10, y1: 4, x2: 10, y2: 6, tipo: 'porta', aberta: false },
  ];

  // 1. Token at (8, 2) trying to walk East across the solid wall at x=10 to (12, 2) -> BLOCKED!
  const moveAgainstWall = resolveTokenMovementWithWalls(8, 2, 12, 2, 1, 1, wallsWithClosedDoor, true);
  assert.equal(moveAgainstWall.collided, true);
  assert.ok(moveAgainstWall.x <= 9, `Token should stop cleanly before wall at x=10, got x=${moveAgainstWall.x}`);

  // 2. Token at (8, 4.5) trying to walk East through the CLOSED door at x=10 (y=4..6) to (12, 4.5) -> BLOCKED!
  const moveAgainstClosedDoor = resolveTokenMovementWithWalls(
    8,
    4.5,
    12,
    4.5,
    1,
    1,
    wallsWithClosedDoor,
    true
  );
  assert.equal(moveAgainstClosedDoor.collided, true);
  assert.ok(moveAgainstClosedDoor.x <= 9, 'Token should not pass through a closed door');

  // 3. Light/vision ray from (8.5*64, 4.5*64) to (11.5*64, 4.5*64) across the CLOSED door -> BLOCKED!
  const closedWallsPx = getBlockingWallsPx(wallsWithClosedDoor, 64, true);
  assert.equal(
    isPointVisibleFromOrigin(8.5 * 64, 4.5 * 64, 11.5 * 64, 4.5 * 64, 6 * 64, closedWallsPx),
    false
  );

  // Visibility polygon with closed door does not extend past x = 10 * 64 along y = 4.5 * 64
  const polyClosed = computeVisibilityPolygon(8.5 * 64, 4.5 * 64, 5 * 64, closedWallsPx);
  const maxXNearDoorClosed = Math.max(
    ...polyClosed
      .filter((p) => Math.abs(p.y - 4.5 * 64) < 20)
      .map((p) => p.x)
  );
  assert.ok(maxXNearDoorClosed <= 10 * 64 + 1, `Ray should stop at closed door x=${10 * 64}`);

  // 4. Now OPEN the door (`aberta: true`)!
  const wallsWithOpenDoor: WallSeg[] = [
    { id: 'w-1', x1: 10, y1: 0, x2: 10, y2: 4, tipo: 'parede' },
    { id: 'd-1', x1: 10, y1: 4, x2: 10, y2: 6, tipo: 'porta', aberta: true },
  ];

  // Token at (8, 4.5) walking through the OPEN door to (12, 4.5) -> PASSES FREELY!
  const moveThroughOpenDoor = resolveTokenMovementWithWalls(
    8,
    4.5,
    12,
    4.5,
    1,
    1,
    wallsWithOpenDoor,
    true
  );
  assert.equal(moveThroughOpenDoor.collided, false);
  assert.equal(moveThroughOpenDoor.x, 12);

  // Light/vision ray across the OPEN door -> PASSES FREELY!
  const openWallsPx = getBlockingWallsPx(wallsWithOpenDoor, 64, true);
  assert.equal(
    isPointVisibleFromOrigin(8.5 * 64, 4.5 * 64, 11.5 * 64, 4.5 * 64, 6 * 64, openWallsPx),
    true
  );

  // 5. Token inside Fog of War behind a closed door is hidden, and becomes visible as soon as the door opens!
  const hero: MapToken = {
    id: 'tok-elara',
    nome: 'Elara',
    categoria: 'character',
    fichaId: 'char-elara',
    x: 8,
    y: 4,
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: '#8b5cf6',
    imagemUrl: '',
    visaoQuadrados: 6,
    luzQuadrados: 5,
    luzCor: '#f59e0b',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };
  const goblinBehindDoor: MapToken = {
    id: 'tok-gob',
    nome: 'Goblin',
    categoria: 'character',
    x: 11,
    y: 4,
    larguraQuadrados: 1,
    alturaQuadrados: 1,
    rotacao: 0,
    cor: '#ef4444',
    imagemUrl: '',
    visaoQuadrados: 0,
    luzQuadrados: 0,
    luzCor: '#ef4444',
    ocultoParaJogadores: false,
    bloqueado: false,
    condicoes: [],
  };

  assert.equal(
    isTokenInsideFog(goblinBehindDoor, [hero, goblinBehindDoor], [mockSheet], true, 64, {
      viewerRole: 'jogador',
      viewerSheetId: 'char-elara',
      paredes: wallsWithClosedDoor,
      colisaoParedesAtiva: true,
    }),
    true,
    'Goblin behind closed door should be hidden in fog'
  );

  assert.equal(
    isTokenInsideFog(goblinBehindDoor, [hero, goblinBehindDoor], [mockSheet], true, 64, {
      viewerRole: 'jogador',
      viewerSheetId: 'char-elara',
      paredes: wallsWithOpenDoor,
      colisaoParedesAtiva: true,
    }),
    false,
    'Goblin behind open door should be revealed by light/vision'
  );

  // 6. Closed Room Shadow & Memory Test:
  // A 4-walled room [10..15] x [2..6] with a closed door on its West wall (x=10, y=3..5).
  // When a hero approaches right next to the closed door (at x=9, y=3.5) with active Light and Vision,
  // neither the active visibility polygon NOR the explored memory polygon ever enters the room (x > 10*64)!
  const closedRoomWalls: WallSeg[] = [
    { id: 'rm-top', x1: 10, y1: 2, x2: 15, y2: 2, tipo: 'parede' },
    { id: 'rm-right', x1: 15, y1: 2, x2: 15, y2: 6, tipo: 'parede' },
    { id: 'rm-bot', x1: 10, y1: 6, x2: 15, y2: 6, tipo: 'parede' },
    { id: 'rm-w1', x1: 10, y1: 2, x2: 10, y2: 3, tipo: 'parede' },
    { id: 'rm-door', x1: 10, y1: 3, x2: 10, y2: 5, tipo: 'porta', aberta: false },
    { id: 'rm-w2', x1: 10, y1: 5, x2: 10, y2: 6, tipo: 'parede' },
  ];
  const closedRoomPx = getBlockingWallsPx(closedRoomWalls, 64, true);

  const heroAtClosedDoor: MapToken = {
    ...hero,
    x: 9,
    y: 3.5,
    memoriaExplorada: [
      { x: 9.5, y: 4.0, raioQuadrados: 6 },
      // Even if a stale memory point existed inside the room (12.5, 4.0), it is filtered out while the door is closed!
      { x: 12.5, y: 4.0, raioQuadrados: 6 },
    ],
  };

  const memCirclesNearClosedRoom = computePlayerExploredMemoryCircles([heroAtClosedDoor], 64, {
    viewerRole: 'jogador',
    viewerSheetId: 'char-elara',
    paredes: closedRoomWalls,
    colisaoParedesAtiva: true,
  });
  assert.equal(
    memCirclesNearClosedRoom.length,
    1,
    'Occluded memory points inside a closed room must not be returned while outside with the door closed'
  );

  // Verify the memory polygon clipped by closedRoomPx has ZERO vertices inside the closed room (x > 10*64 + 0.5, y in 2*64..6*64)
  const memPoly = computeVisibilityPolygon(
    memCirclesNearClosedRoom[0].xPx,
    memCirclesNearClosedRoom[0].yPx,
    memCirclesNearClosedRoom[0].radiusPx,
    closedRoomPx
  );
  const leakedPoints = memPoly.filter(
    (pt) => pt.x > 10 * 64 + 0.5 && pt.x < 15 * 64 && pt.y > 2 * 64 + 0.5 && pt.y < 6 * 64 - 0.5
  );
  assert.equal(
    leakedPoints.length,
    0,
    'Zero vertices of the clipped memory or light polygon may enter the closed room'
  );

  // Also test approaching from the East (so the wall is to the West of the token, crossing the +-PI angle seam)
  const heroEastOfRoom: MapToken = {
    ...hero,
    x: 15,
    y: 3.5,
  };
  const eastPoly = computeVisibilityPolygon(
    (heroEastOfRoom.x + 0.5) * 64,
    (heroEastOfRoom.y + 0.5) * 64,
    6 * 64,
    closedRoomPx
  );
  const leakedFromEast = eastPoly.filter(
    (pt) => pt.x > 10 * 64 && pt.x < 15 * 64 - 0.5 && pt.y > 2 * 64 + 0.5 && pt.y < 6 * 64 - 0.5
  );
  assert.equal(
    leakedFromEast.length,
    0,
    'Zero vertices may leak across the West wall (+-PI angle branch cut) into the closed room'
  );

  // 7. Manual Door Drawn Over Existing Wall (`insertWallOrDoorSegment`):
  // Drawing a door from (10, 3) to (10, 5) over a solid wall (10, 2)->(10, 6) carves the wall so opening the door lets light pass
  const solidWallOnly: WallSeg[] = [
    { id: 'wall-full', x1: 10, y1: 2, x2: 10, y2: 6, tipo: 'parede' },
  ];
  const carvedWalls = insertWallOrDoorSegment(solidWallOnly, {
    id: 'door-carved',
    x1: 10,
    y1: 3,
    x2: 10,
    y2: 5,
    tipo: 'porta',
    aberta: true,
  });
  const carvedBlockingPx = getBlockingWallsPx(carvedWalls, 64, true);
  assert.equal(
    isPointVisibleFromOrigin(8.5 * 64, 4.0 * 64, 11.5 * 64, 4.0 * 64, 6 * 64, carvedBlockingPx),
    true,
    'Opening a door drawn on top of an existing wall should allow light and vision to pass through the carved doorway'
  );
});

test('Smooth Light Falloff: computeLightFalloffIntensity and buildSmoothFalloffGradientStops decay monotonically from 1 at center to 0 at boundary', async () => {
  const { computeLightFalloffIntensity, buildSmoothFalloffGradientStops } = await import(
    './dndRules.ts'
  );

  // Center (d = 0) has maximum intensity 1.0
  assert.equal(computeLightFalloffIntensity(0, 0.5), 1);

  // Boundary (d = 1) has zero intensity 0.0
  assert.equal(computeLightFalloffIntensity(1, 0.5), 0);
  assert.equal(computeLightFalloffIntensity(1.2, 0.5), 0);

  // At default falloff = 0.5, exponent = 2 -> (1 - d^2)^2
  // For d = 0.5 -> (1 - 0.25)^2 = 0.75^2 = 0.5625
  assert.equal(computeLightFalloffIntensity(0.5, 0.5), 0.5625);

  // Higher falloff (1.0) decays faster than lower falloff (0.0) at intermediate distance d = 0.6
  const gentle = computeLightFalloffIntensity(0.6, 0.0);
  const natural = computeLightFalloffIntensity(0.6, 0.5);
  const fast = computeLightFalloffIntensity(0.6, 1.0);
  assert.ok(gentle > natural && natural > fast);

  // Gradient stops are strictly decreasing from 1.0 to 0.0
  const stops = buildSmoothFalloffGradientStops(0.5);
  assert.equal(stops[0].offset, 0);
  assert.equal(stops[0].intensity, 1);
  assert.equal(stops[stops.length - 1].offset, 1);
  assert.equal(stops[stops.length - 1].intensity, 0);
  for (let i = 1; i < stops.length; i++) {
    assert.ok(stops[i].intensity < stops[i - 1].intensity);
  }
});


