export type AbilityKey = 'forca' | 'destreza' | 'constituicao' | 'inteligencia' | 'sabedoria' | 'carisma';

export interface AbilityScores {
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  sabedoria: number;
  carisma: number;
}

export interface SavingThrowsProficiency {
  forca: boolean;
  destreza: boolean;
  constituicao: boolean;
  inteligencia: boolean;
  sabedoria: boolean;
  carisma: boolean;
}

export type SkillKey =
  | 'acrobacia'
  | 'arcanismo'
  | 'atletismo'
  | 'atuacao'
  | 'blefar'
  | 'furtividade'
  | 'historia'
  | 'intimidacao'
  | 'intuicao'
  | 'investigacao'
  | 'lidarComAnimais'
  | 'medicina'
  | 'natureza'
  | 'percepcao'
  | 'persuasao'
  | 'prestidigitacao'
  | 'religiao'
  | 'sobrevivencia';

export interface SkillDefinition {
  key: SkillKey;
  label: string;
  ability: AbilityKey;
  abilityShort: string;
}

export interface CharacterAttack {
  id: string;
  nome: string;
  bonusAtaque: string; // e.g., "+7"
  danoFormula: string; // e.g., "1d8+4"
  tipoDano: string; // e.g., "Cortante"
  alcance: string; // e.g., "1,5m"
}

export interface CharacterMacro {
  id: string;
  nome: string;
  formula: string; // e.g., "1d20+{destreza_mod}+{proficiencia}" or "2d6+4 # Ataque Furtivo"
  danoFormula?: string; // optional secondary damage formula
  descricao?: string;
  privadoPadrao?: boolean;
}

export interface CurrencyCoins {
  pc: number;
  pp: number;
  pe: number;
  po: number;
  pl: number;
}

export interface InventoryItem {
  id: string;
  nome: string;
  quantidade: number;
  peso: string;
  equipado: boolean;
  notas?: string;
}

export interface SpellEntry {
  id: string;
  nome: string;
  nivel: number; // 0 for Truques, 1-9 for spell levels
  preparada: boolean;
  formulaDano?: string;
  escola?: string;
  tempoConjuracao?: string;
  alcance?: string;
  descricao?: string;
}

export interface SpellSlotLevel {
  total: number;
  usados: number;
}

export interface CharacterSheet {
  id: string;
  nomePersonagem: string;
  classeNivel: string;
  nivel: number;
  antecedente: string;
  nomeJogador: string;
  raca: string;
  tendencia: string;
  experiencia: number;
  inspiracao: boolean;
  bonusProficiencia: number;
  classeArmadura: number;
  iniciativaBonusExtra: number; // Added on top of DEX mod if any
  deslocamento: string; // e.g. "9m (30ft)"
  pvMaximo: number;
  pvAtual: number;
  pvTemporario: number;
  dadosVidaTotal: string; // e.g. "5d8"
  dadosVidaRestantes: number;
  sucessosMorte: number; // 0-3
  fracassosMorte: number; // 0-3
  atributos: AbilityScores;
  salvaguardasProficiencia: SavingThrowsProficiency;
  periciasProficiencia: Record<SkillKey, boolean>;
  periciasEspecializacao?: Record<SkillKey, boolean>; // Expertise (2x proficiency)
  ataques: CharacterAttack[];
  macros: CharacterMacro[];
  moedas: CurrencyCoins;
  inventario: InventoryItem[];
  idiomasProficiencias: string;
  caracteristicasHabilidades: string;
  tracosPersonalidade: string;
  ideais: string;
  ligacoes: string;
  defeitos: string;
  // Page 2: Detalhes e História
  idade: string;
  altura: string;
  pesoCorp: string;
  olhos: string;
  pele: string;
  cabelos: string;
  aparenciaUrl: string;
  historiaPersonagem: string;
  aliadosOrganizacoes: string;
  simboloNome: string;
  tesouro: string;
  // Page 3: Conjurador e Magias
  classeConjurador: string;
  habilidadeChaveConjuracao: AbilityKey;
  espacosMagia: Record<number, SpellSlotLevel>; // 1..9
  magias: SpellEntry[];
  // Meta VTT integration
  corToken: string;
  avatarUrl: string;
  visaoAlcanceQuadrados: number; // e.g. 6 squares (30ft)
  luzAlcanceQuadrados: number; // e.g. 4 squares (20ft torch)
  ehMestreOculto?: boolean;
  atualizadoEm: number;
}

export type DockCategory =
  | 'scene'
  | 'map'
  | 'prop'
  | 'effect'
  | 'mount'
  | 'character'
  | 'attachment'
  | 'note';

export interface AssetFolder {
  id: string;
  nome: string;
  categoria: DockCategory;
  ordem: number;
}

export interface MediaAsset {
  id: string;
  nome: string;
  categoria: DockCategory;
  pastaId: string | null;
  dataUrl: string; // Lossless original image DataURL or SVG DataURL
  larguraOriginal: number;
  alturaOriginal: number;
  mimeType: string;
  tamanhoBytes: number;
  padraoQuadrados?: number; // Default size on grid (1 for character, 2 for mount, etc.)
  fichaPersonagemId?: string; // Optional link to CharacterSheet
  notasTexto?: string;
}

export interface MapToken {
  id: string;
  nome: string;
  categoria: DockCategory;
  x: number; // Grid column coordinate (can be fractional or integer)
  y: number; // Grid row coordinate
  larguraQuadrados: number; // 1 = 5ft, 2 = 10ft
  alturaQuadrados: number;
  rotacao: number;
  cor: string;
  imagemUrl: string;
  fichaId?: string; // Links token directly to a CharacterSheet for automatic HP, AC, Initiative, Vision
  pvAtual?: number;
  pvMaximo?: number;
  ca?: number;
  visaoQuadrados: number; // Token darkvision / sight radius in grid squares
  luzQuadrados: number; // Token light source radius (e.g., Torch = 4 squares / 20ft)
  luzCor: string;
  ocultoParaJogadores: boolean;
  bloqueado: boolean;
  condicoes: string[]; // e.g. ['Envenenado', 'Concentrando']
  notaTexto?: string;
}

export interface MapDrawing {
  id: string;
  tipo: 'freehand' | 'line' | 'rect' | 'circle' | 'text';
  pontos: { x: number; y: number }[];
  cor: string;
  espessura: number;
  texto?: string;
  autor: string;
}

export interface FogPolygon {
  id: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  revelado: boolean; // true = manually revealed area, false = manually hidden area
}

export interface MapScene {
  id: string;
  nome: string;
  pastaId: string | null;
  fundoUrl: string;
  larguraQuadrados: number;
  alturaQuadrados: number;
  tamanhoGradePx: number;
  escalaUnidade: string; // e.g., "5ft" or "1.5m"
  proporcaoAspecto?: number; // Natural aspect ratio (width / height) for Owlbear auto-height/width lock
  proporcaoTrancada?: boolean; // Lock icon between width and height
  corGrade?: string;
  opacidadeGrade?: number;
  espessuraLinhaPx?: number;
  tipoGrade?: 'square' | 'hex-v' | 'hex-h' | 'iso';
  estiloLinha?: 'solid' | 'dashed' | 'dotted';
  snappingAtivo?: boolean;
  nevoaAtiva: boolean;
  iluminacaoDinamicaAtiva: boolean;
  nevoaAreasManuais: FogPolygon[];
  tokens: MapToken[];
  desenhos: MapDrawing[];
}

export interface CombatLogEntry {
  id: string;
  timestamp: number;
  ts?: number;
  autorNome: string;
  name?: string;
  autorCor: string;
  color?: string;
  personagemId?: string;
  personagemNome?: string;
  tipoAcao: 'ataque' | 'salvaguarda' | 'pericia' | 'atributo' | 'iniciativa' | 'magia' | 'dano' | 'cura' | 'macro' | 'rolagem_livre' | 'sistema';
  titulo: string; // e.g., "Salvaguarda de Destreza", "Espada Longa", "Iniciativa"
  formulaOriginal: string; // e.g., "1d20+5"
  formulaResolvida: string; // e.g., "1d20+5"
  dadosIndividuais: { faces: number; valor: number; descartado?: boolean }[];
  modificadorTotal: number;
  resultadoFinal: number;
  criticoSucesso: boolean;
  criticoFalha: boolean;
  rolls?: Array<{
    label: string;
    formula: string;
    results: Array<{ t: number; d: string }>;
  }>;
  danoExtra?: {
    formula: string;
    total: number;
    tipo: string;
    dados: number[];
    detalhe?: string;
  };
  privadoMestre: boolean;
  detalhesTexto?: string;
}

export interface InitiativeParticipant {
  id: string;
  tokenId?: string;
  fichaId?: string;
  nome: string;
  avatarUrl: string;
  cor: string;
  iniciativaTotal: number;
  dadoRolado: number;
  modificadorIniciativa: number;
  pvAtual: number;
  pvMaximo: number;
  ca: number;
  ehJogador: boolean;
  oculto: boolean;
  condicoes: string[];
}

export interface InitiativeState {
  ativo: boolean;
  rodada: number;
  turnoIndice: number;
  participantes: InitiativeParticipant[];
}

export interface MusicFolder {
  id: string;
  nome: string;
  ordem: number;
}

export interface MusicTrack {
  id: string;
  titulo: string;
  pastaId: string | null;
  youtubeUrl: string;
  youtubeId: string;
  tipoSom: 'musica' | 'ambiente' | 'efeito'; // allows layering music + rain + tavern
  tocando: boolean;
  volume: number; // 0-100
  loop: boolean;
}

export interface ConnectedPlayer {
  id: string;
  nome: string;
  papel: 'mestre' | 'jogador';
  cor: string;
  fichaAtivaId?: string;
  cursorX?: number;
  cursorY?: number;
  online: boolean;
}

export interface CampaignState {
  id: string;
  nomeCampanha: string;
  capaCampanhaUrl?: string;
  codigoSala: string;
  calendarioFantasia: string; // e.g. "Tarsakh : 23" like in screenshot
  mestreSessionId?: string | null; // Single-GM room lock: only 1 session can hold GM in the room
  mestreNome?: string | null;
  cenaAtivaId: string;
  cenas: MapScene[];
  pastasAssets: AssetFolder[];
  assets: MediaAsset[];
  fichas: CharacterSheet[];
  nomesCampanha: string[]; // Active campaign roster names synced automatically
  iniciativa: InitiativeState;
  logsCombate: CombatLogEntry[];
  pastasMusica: MusicFolder[];
  faixasMusica: MusicTrack[];
  jogadoresConectados: ConnectedPlayer[];
}
