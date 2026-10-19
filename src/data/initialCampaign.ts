import type { CampaignState, CharacterSheet } from '../types/vtt.ts';

// High-resolution vector SVG DataURLs for crisp tokens and tactical maps without any compression artifacts
export const SVG_TOKEN_ELARA = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="g1" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#g1)" stroke="#c4b5fd" stroke-width="5"/>
  <circle cx="60" cy="46" r="18" fill="#f5d0fe"/>
  <path d="M28 98 C32 72, 88 72, 92 98" fill="#6d28d9" stroke="#e9d5ff" stroke-width="3"/>
  <path d="M60 16 L65 28 L78 28 L67 36 L71 48 L60 40 L49 48 L53 36 L42 28 L55 28 Z" fill="#fde047" opacity="0.85"/>
</svg>
`)}`;

export const SVG_TOKEN_THORIN = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="g2" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#78350f"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#g2)" stroke="#fde68a" stroke-width="5"/>
  <path d="M35 42 L60 22 L85 42 L78 85 L60 98 L42 85 Z" fill="#b45309" stroke="#fef3c7" stroke-width="4"/>
  <path d="M60 30 L60 88 M42 54 L78 54" stroke="#fef08a" stroke-width="6" stroke-linecap="round"/>
</svg>
`)}`;

export const SVG_TOKEN_GOBLIN = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="g3" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="100%" stop-color="#7f1d1d"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#g3)" stroke="#fca5a5" stroke-width="5"/>
  <polygon points="18,45 42,50 35,68" fill="#84cc16"/>
  <polygon points="102,45 78,50 85,68" fill="#84cc16"/>
  <circle cx="60" cy="60" r="24" fill="#65a30d" stroke="#ecfccb" stroke-width="3"/>
  <circle cx="51" cy="56" r="4" fill="#fef08a"/>
  <circle cx="69" cy="56" r="4" fill="#fef08a"/>
  <path d="M48 70 Q60 78 72 70" stroke="#1a2e05" stroke-width="4" fill="none"/>
</svg>
`)}`;

export const SVG_TOKEN_DRAKE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="g4" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#431407"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#g4)" stroke="#fdba74" stroke-width="5"/>
  <path d="M24 75 L42 32 L60 52 L78 32 L96 75 L60 94 Z" fill="#c2410c" stroke="#ffedd5" stroke-width="3"/>
  <circle cx="48" cy="58" r="4" fill="#fde047"/>
  <circle cx="72" cy="58" r="4" fill="#fde047"/>
</svg>
`)}`;

export const SVG_PROP_TORCH = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="52" fill="#27272a" stroke="#f59e0b" stroke-width="4"/>
  <rect x="53" y="56" width="14" height="38" rx="4" fill="#78350f"/>
  <path d="M60 20 C42 40, 44 58, 60 62 C76 58, 78 40, 60 20 Z" fill="#f97316"/>
  <path d="M60 30 C50 44, 52 54, 60 58 C68 54, 70 44, 60 30 Z" fill="#fde047"/>
</svg>
`)}`;

export const SVG_PROP_CHEST = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect x="16" y="28" width="88" height="64" rx="10" fill="#78350f" stroke="#fbbf24" stroke-width="5"/>
  <line x1="16" y1="56" x2="104" y2="56" stroke="#fbbf24" stroke-width="5"/>
  <rect x="52" y="48" width="16" height="18" rx="3" fill="#fde047"/>
</svg>
`)}`;

export const DEFAULT_SHEETS: CharacterSheet[] = [
  {
    id: 'char-elara',
    nomePersonagem: 'Elara Sombralua',
    classeNivel: 'Mago 8',
    nivel: 8,
    antecedente: 'Sábia de Silverymoon',
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
    pvTemporario: 8,
    dadosVidaTotal: '8d6',
    dadosVidaRestantes: 8,
    sucessosMorte: 0,
    fracassosMorte: 0,
    // Matches the exact numbers from the user's attached D&D 5e PDF sheet!
    atributos: {
      forca: 8,         // -1
      destreza: 20,     // +5
      constituicao: 8,  // -1
      inteligencia: 20, // +5
      sabedoria: 12,    // +1
      carisma: 10,      // +0
    },
    salvaguardasProficiencia: {
      forca: false,
      destreza: false,
      constituicao: false,
      inteligencia: true, // +8 total
      sabedoria: true,    // +4 total
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
    ataques: [
      {
        id: 'atk-1',
        nome: 'Raio de Fogo (Truque)',
        bonusAtaque: '+8',
        danoFormula: '2d10',
        tipoDano: 'Ígneo',
        alcance: '36m',
      },
      {
        id: 'atk-2',
        nome: 'Adaga Élfica',
        bonusAtaque: '+8',
        danoFormula: '1d4+5',
        tipoDano: 'Perfurante',
        alcance: '1,5m / 6m',
      },
      {
        id: 'atk-3',
        nome: 'Onda do Trovão (Nível 1)',
        bonusAtaque: 'CD 16 CON',
        danoFormula: '2d8',
        tipoDano: 'Trovejante',
        alcance: 'Cubo 4,5m',
      },
    ],
    macros: [
      {
        id: 'mac-1',
        nome: 'Bola de Fogo (3º Círculo)',
        formula: '8d6 # Bola de Fogo (CD 16 DES)',
        descricao: 'Explosão flamejante em esfera de 6m de raio.',
        privadoPadrao: false,
      },
      {
        id: 'mac-2',
        nome: 'Chicote Mental de Tasha',
        formula: '3d6 # Chicote Mental (CD 16 INT)',
        descricao: 'Alvo perde reação e só pode mover ou agir.',
        privadoPadrao: false,
      },
      {
        id: 'mac-3',
        nome: 'Teste de Concentração Arcana',
        formula: '1d20+{constituicao_mod}+3 # Concentração',
        descricao: 'Salvaguarda para manter magia ativa sob dano.',
        privadoPadrao: false,
      },
    ],
    moedas: { pc: 15, pp: 40, pe: 0, po: 340, pl: 4 },
    inventario: [
      { id: 'inv-1', nome: 'Grimório Encadernado em Mithral', quantidade: 1, peso: '1,5 kg', equipado: true },
      { id: 'inv-2', nome: 'Cajado de Foco Arcano (Luz Contínua)', quantidade: 1, peso: '2,0 kg', equipado: true },
      { id: 'inv-3', nome: 'Poção de Cura Maior (4d4+4)', quantidade: 2, peso: '0,5 kg', equipado: false },
      { id: 'inv-4', nome: 'Pérola do Poder', quantidade: 1, peso: '0,1 kg', equipado: true },
    ],
    idiomasProficiencias: 'Comum, Élfico, Dracônico, Silvestre, Primordial · Armas: Adagas, Dardos, Bordões, Bestas Leves',
    caracteristicasHabilidades: 'Visão no Escuro (18m) · Ancestral Feérico · Recuperação Arcana (4 níveis/dia) · Esculpir Magias (Evocação)',
    tracosPersonalidade: 'Falo pausadamente e anoto cada inscrição rúnica que encontro nas masmorras.',
    ideais: 'Conhecimento. O saber ancestral deve ser preservado e compartilhado com sabedoria.',
    ligacoes: 'O Santuário Crepuscular de Tarsakh guarda o segredo do meu mentor desaparecido.',
    defeitos: 'Subestimo perigos físicos quando estou diante de um artefato arcano raro.',
    idade: '118 anos',
    altura: '1,72 m',
    pesoCorp: '56 kg',
    olhos: 'Violeta Cintilante',
    pele: 'Alva Lunar',
    cabelos: 'Prateados',
    aparenciaUrl: SVG_TOKEN_ELARA,
    historiaPersonagem: 'Nascida sob o eclipse de Tarsakh, Elara estudou as linhas de ley da Costa da Espada antes de unir-se à expedição.',
    aliadosOrganizacoes: 'Ordem dos Magos Estelares · Harpistas de Silverymoon',
    simboloNome: 'Selo da Lua Crescente',
    tesouro: 'Fragmento de Cristal Astral e Pergaminho de Teleporte',
    // Page 3 exact spells from user's attached PDF!
    classeConjurador: 'Mago',
    habilidadeChaveConjuracao: 'inteligencia',
    espacosMagia: {
      1: { total: 4, usados: 1 },
      2: { total: 3, usados: 1 },
      3: { total: 3, usados: 0 },
      4: { total: 2, usados: 0 },
      5: { total: 0, usados: 0 },
      6: { total: 0, usados: 0 },
      7: { total: 0, usados: 0 },
      8: { total: 0, usados: 0 },
      9: { total: 0, usados: 0 },
    },
    magias: [
      { id: 'sp-0-1', nome: 'Raio de Fogo', nivel: 0, preparada: true, formulaDano: '2d10', alcance: '36m', escola: 'Evocação' },
      { id: 'sp-0-2', nome: 'Mãos Mágicas', nivel: 0, preparada: true, alcance: '9m', escola: 'Conjuração' },
      { id: 'sp-1-1', nome: 'Onda do Trovão', nivel: 1, preparada: true, formulaDano: '2d8', alcance: '4,5m', escola: 'Evocação' },
      { id: 'sp-1-2', nome: 'Fantoche', nivel: 1, preparada: true, alcance: '9m', escola: 'Encantamento' },
      { id: 'sp-1-3', nome: 'Shield (Égide)', nivel: 1, preparada: true, alcance: 'Pessoal', escola: 'Abjuração' },
      { id: 'sp-2-1', nome: 'Força Fantasmagórica', nivel: 2, preparada: true, formulaDano: '1d6', alcance: '18m', escola: 'Ilusão' },
      { id: 'sp-2-2', nome: 'Reflexos (Mirror Image)', nivel: 2, preparada: true, alcance: 'Pessoal', escola: 'Ilusão' },
      { id: 'sp-2-3', nome: 'Chicote Mental de Tasha', nivel: 2, preparada: true, formulaDano: '3d6', alcance: '27m', escola: 'Encantamento' },
      { id: 'sp-3-1', nome: 'Velocidade (Haste)', nivel: 3, preparada: true, alcance: '9m', escola: 'Transmutação' },
      { id: 'sp-3-2', nome: 'Voo (Fly)', nivel: 3, preparada: true, alcance: 'Toque', escola: 'Transmutação' },
      { id: 'sp-3-3', nome: 'Lentidão (Slow)', nivel: 3, preparada: true, alcance: '36m', escola: 'Transmutação' },
      { id: 'sp-4-1', nome: 'Invisibilidade Maior', nivel: 4, preparada: true, alcance: 'Toque', escola: 'Ilusão' },
      { id: 'sp-4-2', nome: 'Tentáculos Negros de Evard', nivel: 4, preparada: true, formulaDano: '3d6', alcance: '27m', escola: 'Conjuração' },
      { id: 'sp-4-3', nome: 'Destruição Estonteante', nivel: 4, preparada: true, formulaDano: '4d6', alcance: 'Pessoal', escola: 'Evocação' },
    ],
    corToken: '#8b5cf6',
    avatarUrl: SVG_TOKEN_ELARA,
    visaoAlcanceQuadrados: 6,
    luzAlcanceQuadrados: 4,
    atualizadoEm: Date.now() - 3600000,
  },
  {
    id: 'char-thorin',
    nomePersonagem: 'Thorin Escudo de Ferro',
    classeNivel: 'Paladino 8',
    nivel: 8,
    antecedente: 'Soldado Veterano',
    nomeJogador: 'Kaelen',
    raca: 'Anão da Montanha',
    tendencia: 'Leal e Bom',
    experiencia: 34000,
    inspiracao: false,
    bonusProficiencia: 3,
    classeArmadura: 19,
    iniciativaBonusExtra: 1,
    deslocamento: '7,5m',
    pvMaximo: 68,
    pvAtual: 62,
    pvTemporario: 0,
    dadosVidaTotal: '8d10',
    dadosVidaRestantes: 7,
    sucessosMorte: 0,
    fracassosMorte: 0,
    atributos: {
      forca: 18,        // +4
      destreza: 10,     // +0
      constituicao: 16, // +3
      inteligencia: 10, // +0
      sabedoria: 13,    // +1
      carisma: 16,      // +3
    },
    salvaguardasProficiencia: {
      forca: false,
      destreza: false,
      constituicao: false,
      inteligencia: false,
      sabedoria: true,
      carisma: true,
    },
    periciasProficiencia: {
      acrobacia: false,
      arcanismo: false,
      atletismo: true,
      atuacao: false,
      blefar: false,
      furtividade: false,
      historia: false,
      intimidacao: true,
      intuicao: true,
      investigacao: false,
      lidarComAnimais: false,
      medicina: true,
      natureza: false,
      percepcao: false,
      persuasao: true,
      prestidigitacao: false,
      religiao: true,
      sobrevivencia: false,
    },
    ataques: [
      {
        id: 'atk-th-1',
        nome: 'Martelo de Guerra Runado +1',
        bonusAtaque: '+8',
        danoFormula: '1d8+5',
        tipoDano: 'Contundente',
        alcance: '1,5m',
      },
      {
        id: 'atk-th-2',
        nome: 'Destruição Divina (Divine Smite)',
        bonusAtaque: 'Automático no Acerto',
        danoFormula: '3d8',
        tipoDano: 'Radiante',
        alcance: 'Corpo a Corpo',
      },
    ],
    macros: [
      {
        id: 'mac-th-1',
        nome: 'Ataque + Smite Divino',
        formula: '1d20+8 # Martelo Runado',
        danoFormula: '1d8+5+2d8',
        descricao: 'Golpe consagrado com canalização radiante.',
        privadoPadrao: false,
      },
      {
        id: 'mac-th-2',
        nome: 'Aura de Proteção (+3 Salvaguardas)',
        formula: '1d20+{carisma_mod}+3 # Salvaguarda com Aura',
        descricao: 'Aliados a até 3m recebem +3 nas salvaguardas.',
        privadoPadrao: false,
      },
    ],
    moedas: { pc: 0, pp: 25, pe: 0, po: 210, pl: 1 },
    inventario: [
      { id: 'inv-th-1', nome: 'Armadura Completa Anã (CA 18)', quantidade: 1, peso: '29 kg', equipado: true },
      { id: 'inv-th-2', nome: 'Escudo com Brasão de Moradin (+2 CA)', quantidade: 1, peso: '3 kg', equipado: true },
      { id: 'inv-th-3', nome: 'Símbolo Sagrado Reluzente', quantidade: 1, peso: '0,5 kg', equipado: true },
    ],
    idiomasProficiencias: 'Comum, Anão, Gigante · Todas as Armaduras, Escudos, Armas Simples e Marciais',
    caracteristicasHabilidades: 'Visão no Escuro (18m) · Resistência Anã · Cura pelas Mãos (40 PV) · Ataque Extra · Aura de Proteção (+3)',
    tracosPersonalidade: 'Minha palavra é tão inquebrável quanto o granito das montanhas.',
    ideais: 'Honra e Dever. Nenhum companheiro fica para trás na escuridão.',
    ligacoes: 'Jurei recuperar a Bigorna Solar perdida nas profundezas.',
    defeitos: 'Recuso-me a recuar mesmo quando as chances estão contra nós.',
    idade: '145 anos',
    altura: '1,42 m',
    pesoCorp: '84 kg',
    olhos: 'Âmbar',
    pele: 'Bronzeada',
    cabelos: 'Ruivos Trançados',
    aparenciaUrl: SVG_TOKEN_THORIN,
    historiaPersonagem: 'Guardião das Portas de Ferro, Thorin lidera a linha de frente contra as incursões das sombras.',
    aliadosOrganizacoes: 'Clã Escudo de Ferro · Ordem da Manopla',
    simboloNome: 'Martelo e Bigorna em Chamas',
    tesouro: 'Cálice Real de Mithral',
    classeConjurador: 'Paladino',
    habilidadeChaveConjuracao: 'carisma',
    espacosMagia: {
      1: { total: 4, usados: 1 },
      2: { total: 3, usados: 0 },
      3: { total: 0, usados: 0 },
      4: { total: 0, usados: 0 },
      5: { total: 0, usados: 0 },
      6: { total: 0, usados: 0 },
      7: { total: 0, usados: 0 },
      8: { total: 0, usados: 0 },
      9: { total: 0, usados: 0 },
    },
    magias: [
      { id: 'sp-th-1', nome: 'Bênção (Bless)', nivel: 1, preparada: true, formulaDano: '1d4', alcance: '9m', escola: 'Encantamento' },
      { id: 'sp-th-2', nome: 'Escudo da Fé', nivel: 1, preparada: true, alcance: '18m', escola: 'Abjuração' },
      { id: 'sp-th-3', nome: 'Auxílio (Aid)', nivel: 2, preparada: true, alcance: '9m', escola: 'Abjuração' },
    ],
    corToken: '#f59e0b',
    avatarUrl: SVG_TOKEN_THORIN,
    visaoAlcanceQuadrados: 5,
    luzAlcanceQuadrados: 3,
    atualizadoEm: Date.now() - 1800000,
  },
  {
    id: 'char-goblin-chefe',
    nomePersonagem: 'Krag, Chefe Goblin',
    classeNivel: 'Monstro ND 3',
    nivel: 4,
    antecedente: 'Saqueador das Cavernas',
    nomeJogador: 'Mestre',
    raca: 'Goblinóide',
    tendencia: 'Caótico e Mau',
    experiencia: 700,
    inspiracao: false,
    bonusProficiencia: 2,
    classeArmadura: 16,
    iniciativaBonusExtra: 0,
    deslocamento: '9m',
    pvMaximo: 32,
    pvAtual: 32,
    pvTemporario: 0,
    dadosVidaTotal: '6d6+6',
    dadosVidaRestantes: 6,
    sucessosMorte: 0,
    fracassosMorte: 0,
    atributos: {
      forca: 12,
      destreza: 16, // +3 iniciativa
      constituicao: 13,
      inteligencia: 10,
      sabedoria: 11,
      carisma: 10,
    },
    salvaguardasProficiencia: {
      forca: false,
      destreza: true,
      constituicao: false,
      inteligencia: false,
      sabedoria: false,
      carisma: false,
    },
    periciasProficiencia: {
      acrobacia: false,
      arcanismo: false,
      atletismo: false,
      atuacao: false,
      blefar: false,
      furtividade: true,
      historia: false,
      intimidacao: false,
      intuicao: false,
      investigacao: false,
      lidarComAnimais: false,
      medicina: false,
      natureza: false,
      percepcao: true,
      persuasao: false,
      prestidigitacao: false,
      religiao: false,
      sobrevivencia: true,
    },
    ataques: [
      {
        id: 'atk-gob-1',
        nome: 'Cimitarra Serrilhada',
        bonusAtaque: '+5',
        danoFormula: '1d6+3',
        tipoDano: 'Cortante',
        alcance: '1,5m',
      },
      {
        id: 'atk-gob-2',
        nome: 'Arco Curto Envenenado',
        bonusAtaque: '+5',
        danoFormula: '1d6+3+1d4',
        tipoDano: 'Perfurante/Veneno',
        alcance: '24m',
      },
    ],
    macros: [
      {
        id: 'mac-gob-1',
        nome: 'Emboscada Furtiva (Privado Mestre)',
        formula: '1d20+{furtividade} # Furtividade do Chefe Goblin',
        descricao: 'Teste oculto de emboscada nas sombras.',
        privadoPadrao: true,
      },
    ],
    moedas: { pc: 45, pp: 18, pe: 0, po: 12, pl: 0 },
    inventario: [
      { id: 'inv-gob-1', nome: 'Chave Enferrujada da Cripta', quantidade: 1, peso: '0,2 kg', equipado: true },
    ],
    idiomasProficiencias: 'Comum, Goblin · Visão no Escuro 18m',
    caracteristicasHabilidades: 'Escapada Ágil (Esconder ou Desengajar como Ação Bônus)',
    tracosPersonalidade: 'Astuto e oportunista.',
    ideais: 'Sobrevivência e saque.',
    ligacoes: 'Tributo ao Dragão de Cinzas.',
    defeitos: 'Covarde quando cercado.',
    idade: '24 anos',
    altura: '1,10 m',
    pesoCorp: '22 kg',
    olhos: 'Amarelos',
    pele: 'Verde Musgo',
    cabelos: 'Nenhum',
    aparenciaUrl: SVG_TOKEN_GOBLIN,
    historiaPersonagem: 'Chefe dos batedores que vigiam a entrada do Santuário de Tarsakh.',
    aliadosOrganizacoes: 'Tribo Presa Negra',
    simboloNome: 'Crânio Marcado',
    tesouro: 'Bolsa de moedas roubadas',
    classeConjurador: '',
    habilidadeChaveConjuracao: 'inteligencia',
    espacosMagia: {},
    magias: [],
    corToken: '#ef4444',
    avatarUrl: SVG_TOKEN_GOBLIN,
    visaoAlcanceQuadrados: 4,
    luzAlcanceQuadrados: 0,
    ehMestreOculto: true,
    atualizadoEm: Date.now() - 900000,
  },
];

export const SVG_CAMPAIGN_COVER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0720"/>
      <stop offset="50%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#090a10"/>
    </linearGradient>
    <radialGradient id="moon" cx="78%" cy="32%" r="28%">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.7"/>
      <stop offset="55%" stop-color="#7c3aed" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#090a10" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="360" fill="url(#bg)"/>
  <rect width="1200" height="360" fill="url(#moon)"/>
  <circle cx="936" cy="115" r="56" fill="#ede9fe" opacity="0.85"/>
  <polygon points="0,360 0,220 180,145 340,250 540,120 760,260 940,165 1120,240 1200,190 1200,360" fill="#131420"/>
  <polygon points="0,360 120,255 290,310 480,195 690,305 880,210 1060,295 1200,235 1200,360" fill="#0d0e14"/>
  <circle cx="540" cy="120" r="18" fill="none" stroke="#a78bfa" stroke-width="2" stroke-dasharray="4 4"/>
</svg>
`)}`;

export const INITIAL_CAMPAIGN_STATE: CampaignState = {
  id: 'camp-owlbear-quest',
  nomeCampanha: 'Crônicas de Tarsakh: O Santuário Crepuscular',
  capaCampanhaUrl: SVG_CAMPAIGN_COVER,
  codigoSala: 'OWL-5E26',
  calendarioFantasia: 'Tarsakh : 23',
  cenaAtivaId: 'scene-crypt',
  cenas: [
    {
      id: 'scene-crypt',
      nome: 'Santuário Crepuscular (Subsolo)',
      pastaId: 'folder-map-1',
      fundoUrl: '',
      larguraQuadrados: 26,
      alturaQuadrados: 16,
      tamanhoGradePx: 64,
      escalaUnidade: '5ft',
      nevoaAtiva: true,
      iluminacaoDinamicaAtiva: true,
      nevoaAreasManuais: [],
      tokens: [
        {
          id: 'tok-elara',
          nome: 'Elara Sombralua',
          categoria: 'character',
          fichaId: 'char-elara',
          x: 7,
          y: 6,
          larguraQuadrados: 1,
          alturaQuadrados: 1,
          rotacao: 0,
          cor: '#8b5cf6',
          imagemUrl: SVG_TOKEN_ELARA,
          pvAtual: 26,
          pvMaximo: 26,
          ca: 15,
          visaoQuadrados: 6, // 30ft vision
          luzQuadrados: 4,   // 20ft Arcane Staff light
          luzCor: '#a78bfa',
          ocultoParaJogadores: false,
          bloqueado: false,
          condicoes: ['Concentrando'],
        },
        {
          id: 'tok-thorin',
          nome: 'Thorin Escudo de Ferro',
          categoria: 'character',
          fichaId: 'char-thorin',
          x: 9,
          y: 7,
          larguraQuadrados: 1,
          alturaQuadrados: 1,
          rotacao: 0,
          cor: '#f59e0b',
          imagemUrl: SVG_TOKEN_THORIN,
          pvAtual: 62,
          pvMaximo: 68,
          ca: 19,
          visaoQuadrados: 5, // 25ft vision
          luzQuadrados: 4,   // 20ft Torch light
          luzCor: '#f59e0b',
          ocultoParaJogadores: false,
          bloqueado: false,
          condicoes: [],
        },
        {
          id: 'tok-goblin-1',
          nome: 'Krag, Chefe Goblin',
          categoria: 'character',
          fichaId: 'char-goblin-chefe',
          x: 13,
          y: 6,
          larguraQuadrados: 1,
          alturaQuadrados: 1,
          rotacao: 0,
          cor: '#ef4444',
          imagemUrl: SVG_TOKEN_GOBLIN,
          pvAtual: 32,
          pvMaximo: 32,
          ca: 16,
          visaoQuadrados: 4,
          luzQuadrados: 0,
          luzCor: '#ef4444',
          ocultoParaJogadores: false,
          bloqueado: false,
          condicoes: [],
        },
        {
          id: 'tok-prop-torch',
          nome: 'Braseiro Ancestral',
          categoria: 'prop',
          x: 11,
          y: 5,
          larguraQuadrados: 1,
          alturaQuadrados: 1,
          rotacao: 0,
          cor: '#f97316',
          imagemUrl: SVG_PROP_TORCH,
          visaoQuadrados: 0,
          luzQuadrados: 3.5,
          luzCor: '#fb923c',
          ocultoParaJogadores: false,
          bloqueado: false,
          condicoes: [],
        },
      ],
      desenhos: [],
    },
    {
      id: 'scene-tavern',
      nome: 'Estalagem do Cervo Dourado',
      pastaId: 'folder-map-2',
      fundoUrl: '',
      larguraQuadrados: 24,
      alturaQuadrados: 14,
      tamanhoGradePx: 64,
      escalaUnidade: '5ft',
      nevoaAtiva: false,
      iluminacaoDinamicaAtiva: false,
      nevoaAreasManuais: [],
      tokens: [],
      desenhos: [],
    },
  ],
  pastasAssets: [
    { id: 'folder-map-1', nome: 'Masmorras de Tarsakh', categoria: 'map', ordem: 1 },
    { id: 'folder-map-2', nome: 'Cidades & Estalagens', categoria: 'map', ordem: 2 },
    { id: 'folder-char-1', nome: 'Heróis da Campanha', categoria: 'character', ordem: 1 },
    { id: 'folder-char-2', nome: 'Monstros & Chefes', categoria: 'character', ordem: 2 },
    { id: 'folder-prop-1', nome: 'Iluminação & Mobília', categoria: 'prop', ordem: 1 },
    { id: 'folder-mount-1', nome: 'Montarias & Criaturas Grandes', categoria: 'mount', ordem: 1 },
    { id: 'folder-note-1', nome: 'Pistas & Pergaminhos', categoria: 'note', ordem: 1 },
  ],
  assets: [
    {
      id: 'asset-char-elara',
      nome: 'Elara Sombralua (Mago 8)',
      categoria: 'character',
      pastaId: 'folder-char-1',
      dataUrl: SVG_TOKEN_ELARA,
      larguraOriginal: 512,
      alturaOriginal: 512,
      mimeType: 'image/svg+xml',
      tamanhoBytes: 1240,
      padraoQuadrados: 1,
      fichaPersonagemId: 'char-elara',
    },
    {
      id: 'asset-char-thorin',
      nome: 'Thorin Escudo de Ferro (Paladino 8)',
      categoria: 'character',
      pastaId: 'folder-char-1',
      dataUrl: SVG_TOKEN_THORIN,
      larguraOriginal: 512,
      alturaOriginal: 512,
      mimeType: 'image/svg+xml',
      tamanhoBytes: 1180,
      padraoQuadrados: 1,
      fichaPersonagemId: 'char-thorin',
    },
    {
      id: 'asset-char-goblin',
      nome: 'Krag, Chefe Goblin',
      categoria: 'character',
      pastaId: 'folder-char-2',
      dataUrl: SVG_TOKEN_GOBLIN,
      larguraOriginal: 512,
      alturaOriginal: 512,
      mimeType: 'image/svg+xml',
      tamanhoBytes: 1320,
      padraoQuadrados: 1,
      fichaPersonagemId: 'char-goblin-chefe',
    },
    {
      id: 'asset-mount-drake',
      nome: 'Draco Guardião de Cinzas',
      categoria: 'mount',
      pastaId: 'folder-mount-1',
      dataUrl: SVG_TOKEN_DRAKE,
      larguraOriginal: 1024,
      alturaOriginal: 1024,
      mimeType: 'image/svg+xml',
      tamanhoBytes: 1410,
      padraoQuadrados: 2,
    },
    {
      id: 'asset-prop-torch',
      nome: 'Braseiro Arcano (Luz 20ft)',
      categoria: 'prop',
      pastaId: 'folder-prop-1',
      dataUrl: SVG_PROP_TORCH,
      larguraOriginal: 512,
      alturaOriginal: 512,
      mimeType: 'image/svg+xml',
      tamanhoBytes: 980,
      padraoQuadrados: 1,
    },
    {
      id: 'asset-prop-chest',
      nome: 'Baú Runado de Mithral',
      categoria: 'prop',
      pastaId: 'folder-prop-1',
      dataUrl: SVG_PROP_CHEST,
      larguraOriginal: 512,
      alturaOriginal: 512,
      mimeType: 'image/svg+xml',
      tamanhoBytes: 920,
      padraoQuadrados: 1,
    },
  ],
  fichas: DEFAULT_SHEETS,
  nomesCampanha: ['Elara Sombralua', 'Thorin Escudo de Ferro', 'Krag, Chefe Goblin'],
  iniciativa: {
    ativo: true,
    rodada: 1,
    turnoIndice: 0,
    participantes: [
      {
        id: 'init-tok-elara',
        tokenId: 'tok-elara',
        fichaId: 'char-elara',
        nome: 'Elara Sombralua',
        avatarUrl: SVG_TOKEN_ELARA,
        cor: '#8b5cf6',
        iniciativaTotal: 22,
        dadoRolado: 17,
        modificadorIniciativa: 5,
        pvAtual: 26,
        pvMaximo: 26,
        ca: 15,
        ehJogador: true,
        oculto: false,
        condicoes: ['Concentrando'],
      },
      {
        id: 'init-tok-goblin-1',
        tokenId: 'tok-goblin-1',
        fichaId: 'char-goblin-chefe',
        nome: 'Krag, Chefe Goblin',
        avatarUrl: SVG_TOKEN_GOBLIN,
        cor: '#ef4444',
        iniciativaTotal: 16,
        dadoRolado: 13,
        modificadorIniciativa: 3,
        pvAtual: 32,
        pvMaximo: 32,
        ca: 16,
        ehJogador: false,
        oculto: false,
        condicoes: [],
      },
      {
        id: 'init-tok-thorin',
        tokenId: 'tok-thorin',
        fichaId: 'char-thorin',
        nome: 'Thorin Escudo de Ferro',
        avatarUrl: SVG_TOKEN_THORIN,
        cor: '#f59e0b',
        iniciativaTotal: 14,
        dadoRolado: 13,
        modificadorIniciativa: 1,
        pvAtual: 62,
        pvMaximo: 68,
        ca: 19,
        ehJogador: true,
        oculto: false,
        condicoes: [],
      },
    ],
  },
  logsCombate: [
    {
      id: 'log-seed-1',
      timestamp: Date.now() - 240000,
      ts: Date.now() - 240000,
      autorNome: 'Phap La',
      name: 'Elara Sombralua',
      autorCor: '#8b5cf6',
      color: '#8b5cf6',
      personagemId: 'char-elara',
      personagemNome: 'Elara Sombralua',
      tipoAcao: 'salvaguarda',
      titulo: 'Salvaguarda de Inteligência',
      formulaOriginal: '1d20+8',
      formulaResolvida: '1d20+8',
      dadosIndividuais: [{ faces: 20, valor: 19 }],
      modificadorTotal: 8,
      resultadoFinal: 27,
      criticoSucesso: false,
      criticoFalha: false,
      rolls: [
        {
          label: 'Salvaguarda de Inteligência',
          formula: '1d20+8',
          results: [{ t: 27, d: '[19] + 8' }],
        },
      ],
      privadoMestre: false,
      detalhesTexto: 'Resistiu ao Sussurro Psíquico do Santuário',
    },
    {
      id: 'log-seed-2',
      timestamp: Date.now() - 120000,
      ts: Date.now() - 120000,
      autorNome: 'Kaelen',
      name: 'Thorin Escudo de Ferro',
      autorCor: '#f59e0b',
      color: '#f59e0b',
      personagemId: 'char-thorin',
      personagemNome: 'Thorin Escudo de Ferro',
      tipoAcao: 'ataque',
      titulo: 'Martelo de Guerra Runado +1',
      formulaOriginal: '1d20+8',
      formulaResolvida: '1d20+8 (vantagem)',
      dadosIndividuais: [
        { faces: 20, valor: 6, descartado: true },
        { faces: 20, valor: 20 },
      ],
      modificadorTotal: 8,
      resultadoFinal: 28,
      criticoSucesso: true,
      criticoFalha: false,
      rolls: [
        {
          label: 'Martelo de Guerra Runado +1',
          formula: '1d20+8 (vantagem)',
          results: [{ t: 28, d: '[~6~, 20] + 8' }],
        },
      ],
      danoExtra: {
        formula: '2d8+5',
        total: 16,
        tipo: 'Contundente',
        dados: [6, 5],
        detalhe: '[6, 5] + 5',
      },
      privadoMestre: false,
      detalhesTexto: 'Acerto Crítico contra a guarda da cripta!',
    },
    {
      id: 'log-seed-3',
      timestamp: Date.now() - 60000,
      ts: Date.now() - 60000,
      autorNome: 'Mestre (GM)',
      name: 'Krag, Chefe Goblin',
      autorCor: '#ef4444',
      color: '#ef4444',
      personagemId: 'char-goblin-chefe',
      personagemNome: 'Krag, Chefe Goblin',
      tipoAcao: 'pericia',
      titulo: 'Furtividade (Rolagem Privada do Mestre)',
      formulaOriginal: '1d20+5',
      formulaResolvida: '1d20+5',
      dadosIndividuais: [{ faces: 20, valor: 15 }],
      modificadorTotal: 5,
      resultadoFinal: 20,
      criticoSucesso: false,
      criticoFalha: false,
      rolls: [
        {
          label: 'Furtividade (Rolagem Privada do Mestre)',
          formula: '1d20+5',
          results: [{ t: 20, d: '[15] + 5' }],
        },
      ],
      privadoMestre: true,
      detalhesTexto: 'Visível apenas para o Mestre da Mesa',
    },
  ],
  pastasMusica: [
    { id: 'mfolder-1', nome: 'Combate & Chefes', ordem: 1 },
    { id: 'mfolder-2', nome: 'Exploração & Masmorras', ordem: 2 },
    { id: 'mfolder-3', nome: 'Taverna & Ambientes (Chuva/Fogueira)', ordem: 3 },
  ],
  faixasMusica: [
    {
      id: 'track-1',
      titulo: 'Tambores das Profundezas (Combate Épico)',
      pastaId: 'mfolder-1',
      youtubeUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      youtubeId: 'jfKfPfyJRdk',
      tipoSom: 'musica',
      tocando: false,
      volume: 70,
      loop: true,
    },
    {
      id: 'track-2',
      titulo: 'Ecos do Santuário Subterrâneo (Ambiente Masmorra)',
      pastaId: 'mfolder-2',
      youtubeUrl: 'https://www.youtube.com/watch?v=DWcJFNfaw9c',
      youtubeId: 'DWcJFNfaw9c',
      tipoSom: 'ambiente',
      tocando: false,
      volume: 55,
      loop: true,
    },
    {
      id: 'track-3',
      titulo: 'Chuva Noturna & Tochas Crepitando (Camada Extra)',
      pastaId: 'mfolder-3',
      youtubeUrl: 'https://www.youtube.com/watch?v=mPZkdNFkNps',
      youtubeId: 'mPZkdNFkNps',
      tipoSom: 'efeito',
      tocando: false,
      volume: 45,
      loop: true,
    },
    {
      id: 'track-4',
      titulo: 'Alaúde da Estalagem do Cervo Dourado',
      pastaId: 'mfolder-3',
      youtubeUrl: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
      youtubeId: '5qap5aO4i9A',
      tipoSom: 'musica',
      tocando: false,
      volume: 65,
      loop: true,
    },
  ],
  jogadoresConectados: [
    {
      id: 'player-local',
      nome: 'Phap La (you)',
      papel: 'mestre',
      cor: '#4ade80',
      fichaAtivaId: 'char-elara',
      online: true,
    },
  ],
};
