import React, { useState } from 'react';
import {
  Shield,
  Heart,
  Sparkles,
  UserPlus,
  Play,
  BookOpen,
  Users,
  Trash2,
  Edit3,
  Download,
  Upload,
  Eye,
  Flame,
  Swords,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import type { CampaignState, CharacterSheet } from '../types/vtt.ts';
import {
  calculateAbilityModifier,
  calculateInitiativeModifier,
  formatModifier,
  syncCampaignCharacterNames,
} from '../utils/dndRules.ts';
import {
  SVG_CAMPAIGN_COVER,
  SVG_TOKEN_ELARA,
  SVG_TOKEN_THORIN,
  SVG_TOKEN_GOBLIN,
} from '../data/initialCampaign.ts';

interface CampaignHubModalProps {
  campaign: CampaignState;
  activeSheetId: string;
  userRole: 'mestre' | 'jogador';
  userName: string;
  isGmSlotTakenByAnother: boolean;
  currentGmName?: string | null;
  onChangeRole: (role: 'mestre' | 'jogador') => void;
  onChangeUserName: (name: string) => void;
  onUpdateCampaignMeta: (nomeCampanha: string, capaCampanhaUrl?: string) => void;
  onSelectSheet: (sheetId: string) => void;
  onOpenFullSheet: (sheetId: string) => void;
  onCreateCharacter: (newSheet: CharacterSheet, addTokenToMap: boolean) => void;
  onDeleteCharacter: (sheetId: string) => void;
  onAddCampaignNameOnly: (name: string) => void;
  onRemoveCampaignName: (name: string) => void;
  onEnterTabletop: () => void;
  onImportCampaignJson: (state: CampaignState) => void;
}

const PRESET_AVATARS = [
  { label: 'Mago Arcano', url: SVG_TOKEN_ELARA, color: '#8b5cf6' },
  { label: 'Paladino / Guerreiro', url: SVG_TOKEN_THORIN, color: '#f59e0b' },
  { label: 'Criatura / Goblin', url: SVG_TOKEN_GOBLIN, color: '#ef4444' },
];

export const CampaignHubModal: React.FC<CampaignHubModalProps> = ({
  campaign,
  activeSheetId,
  userRole,
  userName,
  isGmSlotTakenByAnother,
  currentGmName,
  onChangeRole,
  onChangeUserName,
  onUpdateCampaignMeta,
  onSelectSheet,
  onOpenFullSheet,
  onCreateCharacter,
  onDeleteCharacter,
  onAddCampaignNameOnly,
  onRemoveCampaignName,
  onEnterTabletop,
  onImportCampaignJson,
}) => {
  const [nomePersonagem, setNomePersonagem] = useState('');
  const [classeNivel, setClasseNivel] = useState('Guerreiro 1');
  const [raca, setRaca] = useState('Humano');
  const [antecedente, setAntecedente] = useState('Aventureiro');
  const [pvMaximo, setPvMaximo] = useState(12);
  const [classeArmadura, setClasseArmadura] = useState(16);
  const [forca, setForca] = useState(15);
  const [destreza, setDestreza] = useState(14);
  const [constituicao, setConstituicao] = useState(14);
  const [inteligencia, setInteligencia] = useState(10);
  const [sabedoria, setSabedoria] = useState(12);
  const [carisma, setCarisma] = useState(10);
  const [presetIdx, setPresetIdx] = useState(0);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [addTokenToMap, setAddTokenToMap] = useState(true);
  const [formError, setFormError] = useState('');
  const [novoNomeCampanhaRapido, setNovoNomeCampanhaRapido] = useState('');

  // Lossless image upload for Campaign Cover Banner
  const handleCampaignCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateCampaignMeta(campaign.nomeCampanha, reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Lossless image upload for character avatar
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleQuickCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomePersonagem.trim()) {
      setFormError('Informe o nome do personagem para adicioná-lo à campanha.');
      return;
    }
    setFormError('');

    const chosenPreset = PRESET_AVATARS[presetIdx] || PRESET_AVATARS[0];
    const finalAvatar = customAvatarUrl || chosenPreset.url;
    const parsedLevel = parseInt(classeNivel.replace(/\D+/g, ''), 10) || 1;
    const profBonus = Math.ceil(Math.max(1, parsedLevel) / 4) + 1;

    const newSheet: CharacterSheet = {
      id: `char-${Date.now()}`,
      nomePersonagem: nomePersonagem.trim(),
      classeNivel: classeNivel.trim() || 'Aventureiro 1',
      nivel: parsedLevel,
      antecedente: antecedente.trim() || 'Forasteiro',
      nomeJogador: userName.replace(/\s*\(you\)\s*/i, '').trim() || 'Jogador',
      raca: raca.trim() || 'Humano',
      tendencia: 'Neutro',
      experiencia: 0,
      inspiracao: false,
      bonusProficiencia: profBonus,
      classeArmadura: Number(classeArmadura) || 14,
      iniciativaBonusExtra: 0,
      deslocamento: '9m',
      pvMaximo: Number(pvMaximo) || 10,
      pvAtual: Number(pvMaximo) || 10,
      pvTemporario: 0,
      dadosVidaTotal: `${parsedLevel}d10`,
      dadosVidaRestantes: parsedLevel,
      sucessosMorte: 0,
      fracassosMorte: 0,
      atributos: {
        forca: Number(forca) || 10,
        destreza: Number(destreza) || 10,
        constituicao: Number(constituicao) || 10,
        inteligencia: Number(inteligencia) || 10,
        sabedoria: Number(sabedoria) || 10,
        carisma: Number(carisma) || 10,
      },
      salvaguardasProficiencia: {
        forca: true,
        destreza: false,
        constituicao: true,
        inteligencia: false,
        sabedoria: false,
        carisma: false,
      },
      periciasProficiencia: {
        acrobacia: false,
        arcanismo: false,
        atletismo: true,
        atuacao: false,
        blefar: false,
        furtividade: false,
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
          id: `atk-${Date.now()}`,
          nome: 'Arma Principal',
          bonusAtaque: formatModifier(calculateAbilityModifier(Number(forca) || 10) + profBonus),
          danoFormula: `1d8${formatModifier(calculateAbilityModifier(Number(forca) || 10))}`,
          tipoDano: 'Cortante',
          alcance: '1,5m',
        },
      ],
      macros: [
        {
          id: `mac-${Date.now()}`,
          nome: 'Ataque Padrão',
          formula: `1d20+{forca_mod}+{proficiencia} # Ataque Principal`,
          danoFormula: `1d8+{forca_mod}`,
          descricao: 'Ataque corpo a corpo com arma equipada.',
          privadoPadrao: false,
        },
      ],
      moedas: { pc: 0, pp: 10, pe: 0, po: 50, pl: 0 },
      inventario: [
        { id: `inv-${Date.now()}`, nome: 'Pacote de Explorador', quantidade: 1, peso: '5 kg', equipado: true },
      ],
      idiomasProficiencias: 'Comum · Armas Simples e Marciais',
      caracteristicasHabilidades: 'Retomar o Fôlego (1d10 + Nível)',
      tracosPersonalidade: 'Sempre alerta nos corredores subterrâneos.',
      ideais: 'Coragem diante do desconhecido.',
      ligacoes: 'Companheiro jurado da expedição de Tarsakh.',
      defeitos: 'Impulsivo em combate.',
      idade: '25 anos',
      altura: '1,78 m',
      pesoCorp: '75 kg',
      olhos: 'Castanhos',
      pele: 'Clara',
      cabelos: 'Escuros',
      aparenciaUrl: finalAvatar,
      historiaPersonagem: 'Criado na tela inicial da campanha e pronto para a aventura.',
      aliadosOrganizacoes: 'Grupo da Campanha Ativa',
      simboloNome: 'Brasão do Aventureiro',
      tesouro: 'Relíquia de Família',
      classeConjurador: '',
      habilidadeChaveConjuracao: 'inteligencia',
      espacosMagia: {},
      magias: [],
      corToken: chosenPreset.color,
      avatarUrl: finalAvatar,
      visaoAlcanceQuadrados: 6,
      luzAlcanceQuadrados: 4,
      atualizadoEm: Date.now(),
    };

    onCreateCharacter(newSheet, userRole === 'mestre' ? addTokenToMap : false);
    setNomePersonagem('');
    setCustomAvatarUrl('');
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(campaign, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `owlbear-quest-campanha-${campaign.codigoSala}.json`;
    a.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && Array.isArray(parsed.fichas)) {
          onImportCampaignJson(parsed);
        }
      } catch (err) {
        console.error('Erro ao importar JSON da campanha:', err);
      }
    };
    reader.readAsText(file);
  };

  const allCampaignNames = syncCampaignCharacterNames(campaign.nomesCampanha || [], campaign.fichas);
  const coverImage = campaign.capaCampanhaUrl || SVG_CAMPAIGN_COVER;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0d0e13]/95 overflow-y-auto flex items-start justify-center p-4 md:p-6 text-zinc-100"
      role="dialog"
      aria-label="Central da Campanha e Criador Rápido de Fichas"
    >
      <div className="w-full max-w-7xl bg-[#181920] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Campaign Cover Photo Banner + Editable Campaign Name */}
        <div className="relative h-48 md:h-56 w-full overflow-hidden border-b border-zinc-800">
          <img
            src={coverImage}
            alt={campaign.nomeCampanha}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#14151c] via-[#14151c]/65 to-transparent" />

          {/* Top-Right Cover Photo Upload Button */}
          <div className="absolute top-4 right-5 flex items-center gap-2">
            {userRole === 'mestre' && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-violet-600 text-xs font-semibold text-white border border-zinc-700 transition-colors cursor-pointer shadow-lg">
                <ImageIcon className="w-3.5 h-3.5 text-violet-300" />
                Trocar Foto de Capa da Campanha
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCampaignCoverUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Bottom Overlay inside Cover: Editable Campaign Name + Controls */}
          <div className="absolute bottom-0 inset-x-0 px-6 py-4 flex flex-col gap-2.5">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-violet-300">
                SALA SINCRONIZADA · {campaign.codigoSala}
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Nome da Campanha"
                  value={campaign.nomeCampanha}
                  onChange={(e) => onUpdateCampaignMeta(e.target.value, campaign.capaCampanhaUrl)}
                  placeholder="Digite o nome da campanha..."
                  className="w-full text-xl md:text-2xl font-bold tracking-tight text-white bg-transparent border-b border-transparent hover:border-zinc-500 focus:border-violet-400 focus:outline-none"
                  style={{ fontFamily: 'Cinzel, serif' }}
                />
                <Edit3 className="w-4 h-4 text-zinc-400 shrink-0" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Player Name & Role Switch */}
              <div className="flex items-center gap-2 bg-[#14151b]/95 border border-zinc-700/80 rounded-xl px-3 py-1.5">
                <label htmlFor="hub-user-name" className="text-xs text-zinc-400">
                  Seu Nome:
                </label>
                <input
                  id="hub-user-name"
                  type="text"
                  value={userName}
                  onChange={(e) => onChangeUserName(e.target.value)}
                  className="bg-transparent text-xs font-medium text-white focus:outline-none w-28 border-b border-zinc-700 focus:border-violet-400"
                />
                <div className="flex items-center gap-1 ml-2 bg-[#20222b] p-0.5 rounded-lg">
                  <button
                    type="button"
                    disabled={isGmSlotTakenByAnother}
                    onClick={() => {
                      if (!isGmSlotTakenByAnother) onChangeRole('mestre');
                    }}
                    title={
                      isGmSlotTakenByAnother
                        ? `Vaga de Mestre ocupada por ${currentGmName || 'outro usuário'} (Máximo 1 Mestre por sala)`
                        : 'Assumir a única vaga de Mestre (GM) da sala'
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      userRole === 'mestre'
                        ? 'bg-violet-600 text-white cursor-pointer'
                        : isGmSlotTakenByAnother
                          ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed opacity-60'
                          : 'text-zinc-400 hover:text-white cursor-pointer'
                    }`}
                  >
                    {isGmSlotTakenByAnother
                      ? `🔒 Mestre Ocupado (1/1)`
                      : userRole === 'mestre'
                        ? 'Mestre (1/1 Ativo)'
                        : 'Assumir Mestre (0/1)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeRole('jogador')}
                    title={
                      userRole === 'mestre'
                        ? 'Liberar vaga de Mestre e entrar como Jogador'
                        : 'Modo Jogador'
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      userRole === 'jogador'
                        ? 'bg-violet-600 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {userRole === 'mestre' ? 'Virar Jogador (Liberar GM)' : 'Jogador'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-200 bg-[#14151b]/95 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                title="Exportar backup JSON para salvar ou hospedar no GitHub"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar JSON
              </button>

              <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-200 bg-[#14151b]/95 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Importar JSON
                <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              </label>

              <button
                type="button"
                data-start="true"
                onClick={onEnterTabletop}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Entrar na Mesa Tática
              </button>
            </div>
          </div>
        </div>

        {/* Main 3-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Left Column (4 cols): Quick Character Creator */}
          <div className="lg:col-span-4 bg-[#14151b] border border-zinc-800/90 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-violet-400" />
                  Criar Ficha Rápida (D&D 5e)
                </h2>
                <span className="text-xs text-zinc-400">Sincroniza na Mesa</span>
              </div>

              <form onSubmit={handleQuickCreateSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="quick-char-name" className="block text-xs font-medium text-zinc-300 mb-1">
                    Nome do Personagem *
                  </label>
                  <input
                    id="quick-char-name"
                    type="text"
                    placeholder="Ex: Lyra Vento Estelar"
                    value={nomePersonagem}
                    onChange={(e) => {
                      setNomePersonagem(e.target.value);
                      if (formError) setFormError('');
                    }}
                    className="w-full px-3 py-2 text-sm bg-[#20222b] border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                  {formError && <p className="text-xs text-rose-400 mt-1">{formError}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="quick-char-class" className="block text-xs font-medium text-zinc-400 mb-1">
                      Classe & Nível
                    </label>
                    <input
                      id="quick-char-class"
                      type="text"
                      value={classeNivel}
                      onChange={(e) => setClasseNivel(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-[#20222b] border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="quick-char-race" className="block text-xs font-medium text-zinc-400 mb-1">
                      Raça / Origem
                    </label>
                    <input
                      id="quick-char-race"
                      type="text"
                      value={raca}
                      onChange={(e) => setRaca(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-[#20222b] border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label htmlFor="quick-char-bg" className="block text-xs font-medium text-zinc-400 mb-1">
                      Antecedente
                    </label>
                    <input
                      id="quick-char-bg"
                      type="text"
                      value={antecedente}
                      onChange={(e) => setAntecedente(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#20222b] border border-zinc-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="quick-char-hp" className="block text-xs font-medium text-zinc-400 mb-1">
                      PV Totais
                    </label>
                    <input
                      id="quick-char-hp"
                      type="number"
                      value={pvMaximo}
                      onChange={(e) => setPvMaximo(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#20222b] border border-zinc-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="quick-char-ac" className="block text-xs font-medium text-zinc-400 mb-1">
                      CA (Armadura)
                    </label>
                    <input
                      id="quick-char-ac"
                      type="number"
                      value={classeArmadura}
                      onChange={(e) => setClasseArmadura(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#20222b] border border-zinc-700 rounded-lg text-white"
                    />
                  </div>
                </div>

                {/* 6 Core Attributes */}
                <div>
                  <span className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Atributos Base (Calcula Modificadores e {'{iniciativa}'} Automaticamente)
                  </span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[
                      { label: 'FOR', val: forca, set: setForca },
                      { label: 'DES', val: destreza, set: setDestreza },
                      { label: 'CON', val: constituicao, set: setConstituicao },
                      { label: 'INT', val: inteligencia, set: setInteligencia },
                      { label: 'SAB', val: sabedoria, set: setSabedoria },
                      { label: 'CAR', val: carisma, set: setCarisma },
                    ].map((attr) => {
                      const mod = calculateAbilityModifier(attr.val);
                      return (
                        <div key={attr.label} className="bg-[#20222b] border border-zinc-700/80 rounded-lg p-1.5 text-center">
                          <div className="text-[10px] font-bold text-zinc-400">{attr.label}</div>
                          <input
                            type="number"
                            aria-label={`Atributo ${attr.label}`}
                            value={attr.val}
                            onChange={(e) => attr.set(Number(e.target.value))}
                            className="w-full text-center text-xs font-mono font-bold text-white bg-transparent focus:outline-none my-0.5 tabular-nums"
                          />
                          <div className="text-[10px] font-mono text-violet-400 tabular-nums">
                            {formatModifier(mod)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Avatar & Lossless Upload */}
                <div>
                  <span className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Ícone do Token / Retrato (Sem perda de qualidade)
                  </span>
                  <div className="flex items-center gap-2">
                    {PRESET_AVATARS.map((preset, idx) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setPresetIdx(idx);
                          setCustomAvatarUrl('');
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                          presetIdx === idx && !customAvatarUrl
                            ? 'border-violet-500 bg-violet-950/40 text-white'
                            : 'border-zinc-700 bg-[#20222b] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-5 h-5 rounded-full" />
                        <span className="truncate max-w-[70px]">{preset.label.split(' ')[0]}</span>
                      </button>
                    ))}
                    <label className="px-2.5 py-1.5 rounded-lg border border-dashed border-zinc-600 hover:border-violet-400 text-xs text-zinc-300 cursor-pointer whitespace-nowrap">
                      Upload PNG/SVG
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {userRole === 'mestre' && (
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={addTokenToMap}
                      onChange={(e) => setAddTokenToMap(e.target.checked)}
                      className="rounded border-zinc-600 text-violet-600 focus:ring-violet-500"
                    />
                    Posicionar token automaticamente no mapa tático ativo
                  </label>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Criar Ficha e Adicionar à Campanha
                </button>
              </form>
            </div>
          </div>

          {/* Center Column (5 cols): Saved Character Sheets List */}
          <div className="lg:col-span-5 bg-[#14151b] border border-zinc-800/90 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-400" />
                Fichas de Personagens Salvas ({campaign.fichas.length})
              </h2>
              <span className="text-xs text-zinc-400">Acesso Mestre & Jogadores</span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
              {campaign.fichas.map((ficha) => {
                const isSelected = ficha.id === activeSheetId;
                const initMod = calculateInitiativeModifier(ficha);
                return (
                  <div
                    key={ficha.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#222430] border-violet-500/80'
                        : 'bg-[#1b1c24] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={ficha.avatarUrl || SVG_TOKEN_ELARA}
                          alt={ficha.nomePersonagem}
                          className="w-12 h-12 rounded-full object-cover border-2 shrink-0"
                          style={{ borderColor: ficha.corToken || '#8b5cf6' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white truncate">{ficha.nomePersonagem}</h3>
                            {isSelected && (
                              <span className="text-[11px] font-medium text-violet-300">· Ficha Ativa</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate">
                            {ficha.raca} · {ficha.classeNivel} · Jogador: {ficha.nomeJogador}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs font-mono tabular-nums text-zinc-300">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Heart className="w-3.5 h-3.5" />
                              PV {ficha.pvAtual}/{ficha.pvMaximo}
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1 text-sky-400">
                              <Shield className="w-3.5 h-3.5" />
                              CA {ficha.classeArmadura}
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1 text-amber-400">
                              <Sparkles className="w-3.5 h-3.5" />
                              Inic {formatModifier(initMod)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectSheet(ficha.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                          }`}
                        >
                          {isSelected ? 'Selecionada' : 'Usar Ficha'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenFullSheet(ficha.id)}
                          className="p-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 transition-colors"
                          title="Abrir Ficha D&D 5e Completa"
                          aria-label={`Abrir ficha completa de ${ficha.nomePersonagem}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {campaign.fichas.length > 1 && userRole === 'mestre' && (
                          <button
                            type="button"
                            onClick={() => onDeleteCharacter(ficha.id)}
                            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 transition-colors"
                            title="Remover ficha"
                            aria-label={`Remover ficha de ${ficha.nomePersonagem}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column (3 cols): Active Campaign Roster & Features Summary */}
          <div className="lg:col-span-3 bg-[#14151b] border border-zinc-800/90 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Lista da Campanha Ativa
                </h2>
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  {allCampaignNames.length} nomes
                </span>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Todo personagem criado é incluído automaticamente na lista da campanha ativa.
              </p>

              {/* Quick add name directly to campaign roster */}
              <div className="flex gap-1.5 mb-3">
                <input
                  type="text"
                  aria-label="Adicionar nome na lista da campanha"
                  placeholder="Adicionar nome à lista..."
                  value={novoNomeCampanhaRapido}
                  onChange={(e) => setNovoNomeCampanhaRapido(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && novoNomeCampanhaRapido.trim()) {
                      e.preventDefault();
                      onAddCampaignNameOnly(novoNomeCampanhaRapido.trim());
                      setNovoNomeCampanhaRapido('');
                    }
                  }}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-[#20222b] border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (novoNomeCampanhaRapido.trim()) {
                      onAddCampaignNameOnly(novoNomeCampanhaRapido.trim());
                      setNovoNomeCampanhaRapido('');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg whitespace-nowrap"
                >
                  Incluir
                </button>
              </div>

              <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {allCampaignNames.map((nome) => {
                  const linkedSheet = campaign.fichas.find(
                    (f) => f.nomePersonagem.toLowerCase() === nome.toLowerCase()
                  );
                  return (
                    <li
                      key={nome}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1d1f28] border border-zinc-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-medium text-zinc-100 truncate">{nome}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {linkedSheet ? (
                          <button
                            type="button"
                            onClick={() => onOpenFullSheet(linkedSheet.id)}
                            className="text-[11px] text-violet-400 hover:underline"
                          >
                            Ver Ficha
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRemoveCampaignName(nome)}
                            className="text-[11px] text-zinc-500 hover:text-rose-400"
                            aria-label={`Remover ${nome} da lista`}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800/80 space-y-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2 text-zinc-300">
                <Eye className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span>Tokens na Névoa ficam ocultos aos jogadores (só o Mestre vê)</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Adicione Luz (Tocha) para revelar o token na Névoa</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Apenas o Mestre anexa mapas e fotos no tabuleiro</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
