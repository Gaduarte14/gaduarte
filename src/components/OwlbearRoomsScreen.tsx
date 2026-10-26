import React, { useRef, useState } from 'react';
import {
  Pencil,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  Check,
  LogIn,
  Sparkles,
  AlertTriangle,
  Copy,
  KeyRound,
} from 'lucide-react';
import { SVG_CAMPAIGN_COVER } from '../data/initialCampaign.ts';
import {
  ensureUniqueGmRoomCodes,
  generateUniqueRoomCode,
} from '../utils/roomAccessEngine.ts';
import {
  auth,
  db,
  doc,
  setDoc,
  OperationType,
  handleFirestoreError,
  sanitizeForFirestore,
  type FirebaseUser,
} from '../firebase.ts';

export interface OwlbearRoomItem {
  id: string;
  nome: string;
  codigo: string;
  imagemMesaUrl: string; // Empty string '' if not yet defined
  papel: 'mestre' | 'jogador';
  criadoEm: number;
}

export const OWLBEAR_ROOMS_STORAGE_KEY = 'owlbear_quest_rooms_list_v1';

/**
 * Compresses/resizes an uploaded image File to a reasonable DataURL (max 880px dimension, JPEG 0.84)
 * so saving multiple room cover images never hits payload quota limits.
 */
export function compressRoomImageFile(file: File, maxDim: number = 880): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (file.type === 'image/svg+xml' || dataUrl.length < 140_000) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || 600;
          let h = img.naturalHeight || img.height || 600;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.84);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

let memorySavedRooms: OwlbearRoomItem[] | null = null;

export function loadSavedOwlbearRooms(
  defaultCampaignName: string,
  defaultCampaignCode: string,
  defaultCoverUrl?: string
): OwlbearRoomItem[] {
  const seedRoom: OwlbearRoomItem = {
    id: 'room-default-1',
    nome: defaultCampaignName || 'Crônicas de Tarsakh: O Santuário Crepuscular',
    codigo: defaultCampaignCode || 'OWL-5E26',
    imagemMesaUrl: defaultCoverUrl || SVG_CAMPAIGN_COVER,
    papel: 'mestre',
    criadoEm: 1710000000000,
  };

  if (memorySavedRooms && memorySavedRooms.length > 0) {
    return ensureUniqueGmRoomCodes(memorySavedRooms);
  }

  return [seedRoom];
}

export function saveOwlbearRooms(rooms: OwlbearRoomItem[]): void {
  const normalized = ensureUniqueGmRoomCodes(rooms);
  memorySavedRooms = normalized;
  const currentUser = auth.currentUser;
  if (currentUser) {
    const userDocPath = `users/${currentUser.uid}`;
    setDoc(
      doc(db, 'users', currentUser.uid),
      sanitizeForFirestore({
        ownerId: currentUser.uid,
        displayName: currentUser.displayName || 'Mestre',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || '',
        rooms: normalized,
        updatedAt: Date.now(),
      }),
      { merge: true }
    ).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, userDocPath);
    });
  }
}

interface OwlbearRoomsScreenProps {
  rooms: OwlbearRoomItem[];
  maxGmRooms?: number;
  firebaseUser?: FirebaseUser | null;
  authError?: string;
  onGoogleLogin?: () => void;
  onGoogleLogout?: () => void;
  onUpdateRooms: (nextRooms: OwlbearRoomItem[]) => void;
  onOpenRoomHub: (room: OwlbearRoomItem) => void;
}

export const OwlbearRoomsScreen: React.FC<OwlbearRoomsScreenProps> = ({
  rooms,
  maxGmRooms = 2,
  firebaseUser,
  authError,
  onGoogleLogin,
  onGoogleLogout,
  onUpdateRooms,
  onOpenRoomHub,
}) => {
  const [activeTab, setActiveTab] = useState<'mestre' | 'jogador'>('mestre');
  const [copiedCodeRoomId, setCopiedCodeRoomId] = useState<string | null>(null);

  // Create New Room Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomImage, setNewRoomImage] = useState<string>('');
  const [nextRoomCodePreview, setNextRoomCodePreview] = useState<string>('');
  const [createError, setCreateError] = useState('');

  // Edit Room Modal State (Pencil Icon)
  const [editingRoom, setEditingRoom] = useState<OwlbearRoomItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Direct Image Upload when clicking a card that has no image yet
  const [pendingImageRoomId, setPendingImageRoomId] = useState<string | null>(null);
  const cardImageInputRef = useRef<HTMLInputElement | null>(null);

  // Player Tab: Join Room by Code State
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinNameInput, setJoinNameInput] = useState('');
  const [joinError, setJoinError] = useState('');

  const gmRooms = rooms.filter((r) => r.papel === 'mestre');
  const playerRooms = rooms.filter((r) => r.papel === 'jogador');
  const isGmLimitReached = gmRooms.length >= maxGmRooms;

  const handleCopyRoomCode = (e: React.MouseEvent, code: string, roomId: string) => {
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(code);
    } catch {
      // ignore clipboard errors
    }
    setCopiedCodeRoomId(roomId);
    window.setTimeout(() => {
      setCopiedCodeRoomId((prev) => (prev === roomId ? null : prev));
    }, 1800);
  };

  // Handle creating a new room in MESTRE tab with a guaranteed unique code
  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newRoomName.trim();
    if (!trimmed) {
      setCreateError('Informe o nome da sala.');
      return;
    }
    if (isGmLimitReached) {
      setCreateError(`Limite de ${maxGmRooms} salas atingido.`);
      return;
    }
    const existingCodes = rooms.map((r) => r.codigo);
    const uniqueCode =
      nextRoomCodePreview &&
      !existingCodes.some((c) => c.toUpperCase() === nextRoomCodePreview.toUpperCase())
        ? nextRoomCodePreview
        : generateUniqueRoomCode(existingCodes);

    const created: OwlbearRoomItem = {
      id: `room-${Date.now()}`,
      nome: trimmed,
      codigo: uniqueCode,
      imagemMesaUrl: newRoomImage, // Can be empty '' so clicking card prompts image upload first!
      papel: 'mestre',
      criadoEm: Date.now(),
    };
    const next = [...rooms, created];
    onUpdateRooms(next);
    setNewRoomName('');
    setNewRoomImage('');
    setNextRoomCodePreview('');
    setCreateError('');
    setShowCreateModal(false);
  };

  // Handle clicking a Room Card (outside the edit or upload buttons): enter the room hub
  const handleCardClick = (room: OwlbearRoomItem) => {
    onOpenRoomHub(room);
  };

  const handleTriggerCardImageUpload = (
    e: React.MouseEvent,
    room: OwlbearRoomItem
  ) => {
    e.stopPropagation();
    setPendingImageRoomId(room.id);
    cardImageInputRef.current?.click();
  };

  const handleDirectCardImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingImageRoomId) return;
    const compressed = await compressRoomImageFile(file);
    const next = rooms.map((r) =>
      r.id === pendingImageRoomId ? { ...r, imagemMesaUrl: compressed } : r
    );
    onUpdateRooms(next);
    setPendingImageRoomId(null);
  };

  // Handle Edit Modal Save
  const handleSaveEditRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    const trimmed = editName.trim() || editingRoom.nome;
    const next = rooms.map((r) =>
      r.id === editingRoom.id
        ? { ...r, nome: trimmed, imagemMesaUrl: editImage }
        : r
    );
    onUpdateRooms(next);
    setEditingRoom(null);
    setConfirmDelete(false);
  };

  // Handle Delete Room inside Edit Modal
  const handleDeleteRoomConfirmed = () => {
    if (!editingRoom) return;
    const next = rooms.filter((r) => r.id !== editingRoom.id);
    onUpdateRooms(next);
    setEditingRoom(null);
    setConfirmDelete(false);
  };

  // Handle Player Joining by Code
  const handleJoinRoomByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = joinCodeInput.trim().toUpperCase();
    if (!rawCode) {
      setJoinError('Digite o código da sala (ex: OWL-5E26).');
      return;
    }
    setJoinError('');

    // Check if player already has this room or if a GM room matches this code
    const existingPlayerRoom = playerRooms.find(
      (r) => r.codigo.toUpperCase() === rawCode
    );
    if (existingPlayerRoom) {
      onOpenRoomHub(existingPlayerRoom);
      return;
    }

    const matchingGmRoom = gmRooms.find((r) => r.codigo.toUpperCase() === rawCode);
    const joinedRoom: OwlbearRoomItem = {
      id: `room-player-${Date.now()}`,
      nome:
        joinNameInput.trim() ||
        matchingGmRoom?.nome ||
        `Mesa ${rawCode}`,
      codigo: rawCode,
      imagemMesaUrl: matchingGmRoom?.imagemMesaUrl || SVG_CAMPAIGN_COVER,
      papel: 'jogador',
      criadoEm: Date.now(),
    };

    const next = [...rooms, joinedRoom];
    onUpdateRooms(next);
    setJoinCodeInput('');
    setJoinNameInput('');
    onOpenRoomHub(joinedRoom);
  };

  const displayedRooms = activeTab === 'mestre' ? gmRooms : playerRooms;

  return (
    <div
      data-testid="owlbear-rooms-screen"
      className="fixed inset-0 z-50 bg-[#13141f] overflow-y-auto flex items-center justify-center p-4 md:p-8 text-zinc-100 select-none"
    >
      {/* Hidden File Input for direct card image setting when room has no image yet */}
      <input
        ref={cardImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleDirectCardImageChange}
        className="hidden"
      />

      {/* Main Rounded Central Panel (Owlbear Rodeo Rooms Style) */}
      <div className="w-full max-w-4xl bg-[#1e2030] border border-[#2e3148] rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Top Header: Title + Subtitle on Left, Auth & Counter on Right */}
        <div className="px-6 pt-7 pb-5 md:px-9 md:pt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#c4b5fd] tracking-tight">
              Salas
            </h1>
            <p className="text-xs md:text-sm text-zinc-300 mt-1">
              Crie uma sala para conectar seus jogadores em tempo real no Firebase Firestore
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Firebase Google Authentication Bar */}
            <div className="flex items-center gap-2">
              {firebaseUser ? (
                <div
                  data-testid="firebase-user-badge"
                  className="flex items-center gap-2 bg-[#161824] border border-emerald-500/40 rounded-full pl-2 pr-3 py-1"
                >
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt={firebaseUser.displayName || 'Usuário'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  )}
                  <span className="text-xs font-semibold text-emerald-200 max-w-[140px] truncate">
                    {firebaseUser.displayName || firebaseUser.email || 'Conectado'}
                  </span>
                  <button
                    type="button"
                    data-testid="google-logout-btn"
                    onClick={() => onGoogleLogout?.()}
                    className="ml-1 text-[11px] font-bold text-rose-300 hover:text-rose-200 underline cursor-pointer"
                    title="Sair da conta Google (Logout)"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="google-login-btn"
                  onClick={() => onGoogleLogin?.()}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-bold flex items-center gap-2 shadow-md transition-colors cursor-pointer"
                  title="Fazer login com Google para sincronizar suas salas e campanha no Firestore"
                >
                  <LogIn className="w-3.5 h-3.5 text-violet-700" />
                  <span>Entrar com Google</span>
                </button>
              )}
            </div>

            {authError && (
              <span className="text-[11px] text-amber-300 max-w-xs text-right">
                {authError}
              </span>
            )}

            <div
              data-testid="rooms-used-counter"
              className="text-xs md:text-sm font-medium text-zinc-300 pt-0.5"
            >
              Salas usadas: {gmRooms.length} de {maxGmRooms}
            </div>
          </div>
        </div>

        {/* Full-Width 2 Tabs: MESTRE | JOGADOR */}
        <div className="grid grid-cols-2 w-full border-t border-[#2c2f45]">
          <button
            type="button"
            data-testid="rooms-tab-mestre"
            onClick={() => setActiveTab('mestre')}
            className={`py-3.5 text-xs md:text-sm font-bold uppercase tracking-widest transition-all cursor-pointer border-b-2 ${
              activeTab === 'mestre'
                ? 'bg-[#1e2030] text-white border-white'
                : 'bg-[#171825] text-zinc-400 hover:text-zinc-200 border-transparent'
            }`}
          >
            MESTRE
          </button>

          <button
            type="button"
            data-testid="rooms-tab-jogador"
            onClick={() => setActiveTab('jogador')}
            className={`py-3.5 text-xs md:text-sm font-bold uppercase tracking-widest transition-all cursor-pointer border-b-2 ${
              activeTab === 'jogador'
                ? 'bg-[#1e2030] text-white border-white'
                : 'bg-[#171825] text-zinc-400 hover:text-zinc-200 border-transparent'
            }`}
          >
            JOGADOR
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 md:p-9 space-y-7">
          {/* Player Tab Join Bar */}
          {activeTab === 'jogador' && (
            <form
              onSubmit={handleJoinRoomByCode}
              className="bg-[#161824] border border-[#2c2f45] rounded-2xl p-4 flex flex-wrap items-center gap-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-300">
                <LogIn className="w-4 h-4" />
                <span>Entrar com código:</span>
              </div>
              <input
                type="text"
                data-testid="player-join-code-input"
                placeholder="Código (ex: OWL-5E26)"
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value);
                  if (joinError) setJoinError('');
                }}
                className="px-3 py-2 rounded-xl bg-[#1e2030] border border-zinc-700 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400 w-44"
              />
              <input
                type="text"
                placeholder="Nome da sala (opcional)"
                value={joinNameInput}
                onChange={(e) => setJoinNameInput(e.target.value)}
                className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#1e2030] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400"
              />
              <button
                type="submit"
                data-testid="player-join-code-submit"
                className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
              >
                Entrar na Sala
              </button>
              {joinError && (
                <p className="w-full text-xs text-rose-400">{joinError}</p>
              )}
            </form>
          )}

          {/* Inner Rounded Container with Room Cards */}
          <div className="bg-[#161824] border border-[#292c40] rounded-3xl p-6 md:p-8 min-h-[260px] flex items-center justify-center">
            {displayedRooms.length === 0 ? (
              <div className="text-center py-10 space-y-2 max-w-sm">
                <Sparkles className="w-8 h-8 text-violet-400/70 mx-auto" />
                <p className="text-sm font-semibold text-zinc-200">
                  {activeTab === 'mestre'
                    ? 'Você ainda não criou nenhuma sala como Mestre.'
                    : 'Você ainda não entrou em nenhuma sala como Jogador.'}
                </p>
                <p className="text-xs text-zinc-400">
                  {activeTab === 'mestre'
                    ? 'Clique em "CRIAR UMA NOVA SALA" abaixo para começar sua mesa.'
                    : 'Digite o código da sala acima (ex: OWL-5E26) para se conectar à campanha.'}
                </p>
              </div>
            ) : (
              <div
                className={`w-full grid gap-6 ${
                  displayedRooms.length === 1
                    ? 'grid-cols-1 max-w-[240px] mr-auto'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                }`}
              >
                {displayedRooms.map((room) => (
                  <div
                    key={room.id}
                    data-testid={`owlbear-room-card-${room.id}`}
                    onClick={() => handleCardClick(room)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(room);
                      }
                    }}
                    title={
                      room.imagemMesaUrl
                        ? `Entrar na sala "${room.nome}" (${room.codigo})`
                        : `Clique para definir a imagem da mesa "${room.nome}"`
                    }
                    className="group relative aspect-square w-full max-w-[240px] rounded-2xl overflow-hidden border border-zinc-700/80 hover:border-violet-400 bg-[#222538] shadow-xl transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    {room.imagemMesaUrl ? (
                      <img
                        src={room.imagemMesaUrl}
                        alt={room.nome}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#25283d] to-[#1a1c2b]">
                        <button
                          type="button"
                          data-testid={`owlbear-room-add-image-${room.id}`}
                          onClick={(e) => handleTriggerCardImageUpload(e, room)}
                          className="flex flex-col items-center justify-center px-3 py-2.5 rounded-2xl bg-violet-500/15 hover:bg-violet-500/30 border border-violet-400/40 transition-colors cursor-pointer"
                        >
                          <ImageIcon className="w-6 h-6 text-violet-300 mb-1.5" />
                          <span className="text-xs font-semibold text-violet-200">
                            Adicionar imagem da mesa
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-0.5">
                            Clique para escolher foto
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Dark Bottom Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                    {/* Top-Left Prominent Unique Room Code Badge + 1-Click Copy Button */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 z-10"
                    >
                      <div
                        data-testid={`room-card-code-${room.id}`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/80 border border-violet-400/50 text-[11px] font-mono font-bold text-violet-200 shadow-lg"
                        title={`Código exclusivo da sala: ${room.codigo}`}
                      >
                        <KeyRound className="w-3 h-3 text-violet-400 shrink-0" />
                        <span>{room.codigo}</span>
                      </div>

                      <button
                        type="button"
                        data-testid={`room-card-copy-code-${room.id}`}
                        onClick={(e) => handleCopyRoomCode(e, room.codigo, room.id)}
                        title="Copiar código da sala para enviar aos jogadores"
                        className="px-2 py-1 rounded-lg bg-violet-600/90 hover:bg-violet-500 text-[10px] font-bold text-white flex items-center gap-1 shadow-lg transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>
                          {copiedCodeRoomId === room.id ? 'Copiado!' : 'Copiar'}
                        </span>
                      </button>
                    </div>

                    {/* Bottom-Left Room Name + Bottom-Right Pencil Edit Button */}
                    <div className="absolute bottom-0 inset-x-0 p-3.5 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
                          {room.papel === 'mestre' ? '👑 Mestre (Criador)' : '🛡️ Jogador'}
                        </span>
                        <span className="block text-sm md:text-base font-bold text-white leading-tight truncate drop-shadow">
                          {room.nome}
                        </span>
                      </div>

                      <button
                        type="button"
                        data-testid={`owlbear-room-edit-${room.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRoom(room);
                          setEditName(room.nome);
                          setEditImage(room.imagemMesaUrl);
                          setConfirmDelete(false);
                        }}
                        title={`Editar sala "${room.nome}"`}
                        aria-label={`Editar sala ${room.nome}`}
                        className="w-8 h-8 rounded-full bg-black/55 hover:bg-violet-600 text-zinc-200 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Wide Pill Button: CRIAR UMA NOVA SALA (in MESTRE tab) */}
          {activeTab === 'mestre' && (
            <div className="space-y-2">
              <button
                type="button"
                data-testid="create-new-room-pill-btn"
                disabled={isGmLimitReached}
                onClick={() => {
                  setNewRoomName('');
                  setNewRoomImage('');
                  setNextRoomCodePreview(
                    generateUniqueRoomCode(rooms.map((r) => r.codigo))
                  );
                  setCreateError('');
                  setShowCreateModal(true);
                }}
                className={`w-full py-3.5 px-6 rounded-full border text-xs md:text-sm font-bold uppercase tracking-widest transition-all ${
                  isGmLimitReached
                    ? 'border-zinc-700 bg-zinc-900/50 text-zinc-500 cursor-not-allowed'
                    : 'border-[#a78bfa]/75 hover:border-[#c4b5fd] bg-transparent hover:bg-[#a78bfa]/10 text-white cursor-pointer shadow-lg'
                }`}
              >
                CRIAR UMA NOVA SALA
              </button>

              {isGmLimitReached && (
                <p
                  data-testid="rooms-limit-reached-msg"
                  className="text-center text-xs text-amber-300/90"
                >
                  Limite de {maxGmRooms} salas atingido ({gmRooms.length} de {maxGmRooms}). Edite no ícone de lápis e exclua uma sala caso queira criar outra.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: CRIAR UMA NOVA SALA */}
      {showCreateModal && (
        <div
          data-testid="create-room-modal"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1e2030] border border-[#343854] rounded-2xl shadow-2xl p-6 space-y-4 text-zinc-100"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#c4b5fd]">
                Criar uma Nova Sala
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="space-y-4">
              {/* Unique Room Code Preview Box */}
              <div className="p-3 rounded-xl bg-[#141521] border border-violet-500/40 flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Código Exclusivo desta Sala
                  </span>
                  <span
                    data-testid="create-room-unique-code-preview"
                    className="text-sm font-mono font-bold text-violet-300"
                  >
                    {nextRoomCodePreview}
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-200 font-medium">
                  👑 Você será o Mestre
                </span>
              </div>

              <div>
                <label
                  htmlFor="new-room-name-input"
                  className="block text-xs font-semibold text-zinc-300 mb-1.5"
                >
                  Nome da Sala *
                </label>
                <input
                  id="new-room-name-input"
                  data-testid="new-room-name-input"
                  type="text"
                  placeholder="Ex: dnd"
                  value={newRoomName}
                  onChange={(e) => {
                    setNewRoomName(e.target.value);
                    if (createError) setCreateError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141521] border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400"
                  autoFocus
                />
                {createError && (
                  <p className="text-xs text-rose-400 mt-1">{createError}</p>
                )}
              </div>

              <div>
                <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Imagem da Mesa (Upload com preview)
                </span>
                <div className="flex items-center gap-3">
                  {newRoomImage ? (
                    <img
                      src={newRoomImage}
                      alt="Preview da sala"
                      className="w-20 h-20 rounded-xl object-cover border border-violet-400/60 shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-[#141521] border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="px-3.5 py-2 rounded-xl bg-violet-600/25 hover:bg-violet-600/40 border border-violet-400/50 text-xs font-semibold text-violet-200 cursor-pointer inline-flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Escolher Imagem da Mesa</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          const compressed = await compressRoomImageFile(file);
                          setNewRoomImage(compressed);
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewRoomImage(SVG_CAMPAIGN_COVER)}
                      className="text-[11px] text-zinc-400 hover:text-violet-300 text-left cursor-pointer"
                    >
                      Usar arte padrão da campanha
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-create-room-btn"
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold uppercase tracking-wider text-white shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Criar Sala</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: EDITAR SALA (Ícone de Lápis) */}
      {editingRoom && (
        <div
          data-testid="edit-room-modal"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => {
            setEditingRoom(null);
            setConfirmDelete(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1e2030] border border-[#343854] rounded-2xl shadow-2xl p-6 space-y-4 text-zinc-100"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#c4b5fd]">
                Editar Sala
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingRoom(null);
                  setConfirmDelete(false);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRoom} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#141521] border border-violet-500/40 flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Código da Sala
                  </span>
                  <span className="text-sm font-mono font-bold text-violet-300">
                    {editingRoom.codigo}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) =>
                    handleCopyRoomCode(e, editingRoom.codigo, editingRoom.id)
                  }
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {copiedCodeRoomId === editingRoom.id ? 'Copiado!' : 'Copiar Código'}
                  </span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="edit-room-name-input"
                  className="block text-xs font-semibold text-zinc-300 mb-1.5"
                >
                  Nome da Sala
                </label>
                <input
                  id="edit-room-name-input"
                  data-testid="edit-room-name-input"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141521] border border-zinc-700 text-sm text-white focus:outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Imagem da Mesa
                </span>
                <div className="flex items-center gap-3">
                  {editImage ? (
                    <img
                      src={editImage}
                      alt={editName}
                      className="w-20 h-20 rounded-xl object-cover border border-violet-400/60 shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-[#141521] border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <label className="px-3.5 py-2 rounded-xl bg-violet-600/25 hover:bg-violet-600/40 border border-violet-400/50 text-xs font-semibold text-violet-200 cursor-pointer inline-flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Trocar Imagem</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const compressed = await compressRoomImageFile(file);
                        setEditImage(compressed);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Delete Room Confirmation Section */}
              <div className="pt-3 border-t border-zinc-800">
                {!confirmDelete ? (
                  <button
                    type="button"
                    data-testid="edit-room-delete-btn"
                    onClick={() => setConfirmDelete(true)}
                    className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-xs font-semibold text-rose-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Sala</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/60 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Tem certeza que deseja excluir esta sala?</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="confirm-delete-room-btn"
                        onClick={handleDeleteRoomConfirmed}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
                      >
                        Sim, Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoom(null);
                    setConfirmDelete(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  data-testid="save-edit-room-btn"
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold uppercase tracking-wider text-white shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
