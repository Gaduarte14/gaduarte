import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  User,
  Calendar,
  MapPin,
  Trophy,
  Swords,
  Dices,
  Shield,
  Box,
  UserPlus,
  MoreVertical,
  Hand,
  CloudFog,
  Pencil,
  Ruler,
  Type,
  Undo2,
  Redo2,
  ChevronDown,
  Music,
  Flame,
  LayoutGrid,
  Lock,
  BookOpen,
  BrickWall,
  DoorOpen,
  Copy,
  KeyRound,
  Check,
  ChevronUp,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
} from 'lucide-react';
import {
  auth,
  db,
  doc,
  onAuthStateChanged,
  onSnapshot,
  setDoc,
  signInWithGoogle,
  logoutFirebase,
  OperationType,
  handleFirestoreError,
  sanitizeForFirestore,
  type FirebaseUser,
} from './firebase.ts';
import { INITIAL_CAMPAIGN_STATE } from './data/initialCampaign.ts';
import type {
  AssetFolder,
  CampaignState,
  CharacterSheet,
  CombatLogEntry,
  DockCategory,
  MapDrawing,
  MapScene,
  MapToken,
  MapWallSegment,
  MediaAsset,
  MusicFolder,
  MusicTrack,
} from './types/vtt.ts';
import {
  createInvisibleLightToken,
  evaluateDiceExpression,
  insertWallOrDoorSegment,
  interpolateSheetVariables,
  recordTokenFogMemoryPath,
  recordTokenFogMemoryStep,
  rollTableInitiativeForTokens,
  syncCampaignCharacterNames,
} from './utils/dndRules.ts';
import { rollInput, type ParsedRollGroup } from './utils/engine.ts';
import {
  runLine,
  type DamageHistoryEntry,
  type SheetHpAdapter,
} from './utils/dano.ts';
import {
  canUserOpenCharacterSheet,
  claimCharacterSheetForPlayer,
  getVisibleSheetsForTabletopPlayer,
  releaseCharacterSheetLock,
  resolveRoomRoleForEntry,
} from './utils/roomAccessEngine.ts';
import { TacticalMapCanvas, type ActiveMapTool } from './components/TacticalMapCanvas.tsx';
import { BottomOwlbearDock } from './components/BottomOwlbearDock.tsx';
import { RightQuestPortalSidebar } from './components/RightQuestPortalSidebar.tsx';
import { CharacterSheetDrawer } from './components/CharacterSheetDrawer.tsx';
import { CampaignHubModal } from './components/CampaignHubModal.tsx';
import {
  OwlbearRoomsScreen,
  loadSavedOwlbearRooms,
  saveOwlbearRooms,
  type OwlbearRoomItem,
} from './components/OwlbearRoomsScreen.tsx';
import { PersistentAudioEngine } from './components/PersistentAudioEngine.tsx';

const USER_ROLE_STORAGE_KEY = 'owlbear_quest_user_role_v1';

const clientSessionIdSingleton = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [authError, setAuthError] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>(
    () => auth.currentUser?.uid || clientSessionIdSingleton
  );

  // Initial campaign state seeded and synchronized in real-time via Firestore onSnapshot
  const [campaign, setCampaign] = useState<CampaignState>(() => ({
    ...INITIAL_CAMPAIGN_STATE,
    mestreSessionId: null,
    mestreNome: 'Phap La (you)',
  }));

  // Owlbear Rodeo Rooms State (Tela Inicial de Salas) synchronized via Firestore onSnapshot
  const [owlbearRooms, setOwlbearRooms] = useState<OwlbearRoomItem[]>(() =>
    loadSavedOwlbearRooms(
      campaign.nomeCampanha,
      campaign.codigoSala,
      campaign.capaCampanhaUrl
    )
  );

  // Toggle to hide/show the top-left Players & Mestre/Jogador panel
  const [playersPanelOpen, setPlayersPanelOpen] = useState<boolean>(true);

  // UI Navigation States:
  // Normal flow: Tela Inicial de Salas (`showRoomsScreen`) -> Campaign Hub (`showCampaignHub`) -> Mesa Tática
  const [showRoomsScreen, setShowRoomsScreen] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('autostart') === '1' ||
      params.get('tabletop') === '1' ||
      params.get('hub') === '1'
    ) {
      return false;
    }
    return true;
  });

  const [showCampaignHub, setShowCampaignHub] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || params.get('tabletop') === '1') return false;
    if (params.get('hub') === '1') return true;
    return false;
  });

  const [activeSheetModalId, setActiveSheetModalId] = useState<string | null>(null);
  const [activePlayingSheetId, setActivePlayingSheetId] = useState<string>(
    INITIAL_CAMPAIGN_STATE.fichas[0]?.id || 'char-elara'
  );
  const [damageHistory, setDamageHistory] = useState<DamageHistoryEntry[]>([]);
  const [sheetClaimError, setSheetClaimError] = useState<string>('');
  const [copiedTabletopCode, setCopiedTabletopCode] = useState<boolean>(false);

  const [userRole, setUserRoleState] = useState<'mestre' | 'jogador'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'jogador') return 'jogador';
    if (params.get('role') === 'mestre') return 'mestre';
    try {
      const savedRole = sessionStorage.getItem(USER_ROLE_STORAGE_KEY);
      if (savedRole === 'jogador' || savedRole === 'mestre') {
        return savedRole;
      }
    } catch {
      // ignore
    }
    return 'mestre';
  });

  const [userName, setUserName] = useState<string>('Phap La (you)');

  // Tabletop Tool & Viewport States
  const [activeMapTool, setActiveMapTool] = useState<ActiveMapTool>('hand');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 40 });
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>('tok-elara');

  // Bottom Owlbear Dock States
  const [activeDockCategory, setActiveDockCategory] = useState<DockCategory | null>(null);
  const [dockSearchQuery, setDockSearchQuery] = useState<string>('');

  // Right Quest Portal Sidebar States
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<
    'chat' | 'iniciativa' | 'musica' | 'fichas' | 'notas'
  >('chat');

  // Undo/Redo Drawing Stack & Single-Step Wall Batch Undo Stack (Ctrl+Z)
  const [redoDrawings, setRedoDrawings] = useState<MapDrawing[]>([]);
  const [wallUndoStack, setWallUndoStack] = useState<
    Array<{ sceneId: string; previousWalls: MapWallSegment[] }>
  >([]);

  // WebSocket & BroadcastChannel Real-Time Sync Refs
  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);

  const activeScene: MapScene =
    campaign.cenas.find((c) => c.id === campaign.cenaAtivaId) || campaign.cenas[0];

  const openedSheetModal = activeSheetModalId
    ? campaign.fichas.find((f) => f.id === activeSheetModalId) || null
    : null;

  // Identify current turn participant & corresponding token on the active map
  const activeTurnParticipant =
    campaign.iniciativa.ativo && campaign.iniciativa.participantes.length > 0
      ? campaign.iniciativa.participantes[
          campaign.iniciativa.turnoIndice % campaign.iniciativa.participantes.length
        ] || null
      : null;

  const activeTurnToken = activeTurnParticipant
    ? activeScene.tokens.find(
        (t) =>
          (activeTurnParticipant.tokenId && t.id === activeTurnParticipant.tokenId) ||
          (activeTurnParticipant.fichaId && t.fichaId === activeTurnParticipant.fichaId) ||
          t.nome.toLowerCase() === activeTurnParticipant.nome.toLowerCase()
      ) || null
    : null;

  // Camera Focus Helper: smoothly centers viewport on a target token
  const focusCameraOnToken = useCallback(
    (token: MapToken | undefined | null) => {
      if (!token) return;
      const gridSize = activeScene.tamanhoGradePx || 64;
      const tokenCenterX = (token.x + token.larguraQuadrados / 2) * gridSize;
      const tokenCenterY = (token.y + token.alturaQuadrados / 2) * gridSize;
      const usableWidth = Math.max(360, window.innerWidth - (sidebarOpen ? 390 : 0));
      const usableHeight = Math.max(360, window.innerHeight);
      setPan({
        x: Math.round(usableWidth / 2 - tokenCenterX * zoom),
        y: Math.round(usableHeight / 2 - tokenCenterY * zoom),
      });
      setSelectedTokenId(token.id);
    },
    [activeScene.tamanhoGradePx, sidebarOpen, zoom]
  );

  // Automatically pan/focus everyone's screen when Initiative Turn changes!
  const lastFocusedTurnKeyRef = useRef<string>('');
  useEffect(() => {
    if (!campaign.iniciativa.ativo || !activeTurnParticipant || !activeTurnToken) {
      lastFocusedTurnKeyRef.current = '';
      return;
    }
    const turnKey = `${campaign.iniciativa.rodada}-${campaign.iniciativa.turnoIndice}-${activeTurnToken.id}`;
    if (lastFocusedTurnKeyRef.current !== turnKey) {
      lastFocusedTurnKeyRef.current = turnKey;
      focusCameraOnToken(activeTurnToken);
    }
  }, [
    campaign.iniciativa.ativo,
    campaign.iniciativa.rodada,
    campaign.iniciativa.turnoIndice,
    activeTurnParticipant,
    activeTurnToken,
    focusCameraOnToken,
  ]);

  // Role Change Handler: Freely switch between Mestre and Jogador without any blocking lock
  const handleChangeUserRole = (targetRole: 'mestre' | 'jogador') => {
    setUserRoleState(targetRole);
    try {
      sessionStorage.setItem(USER_ROLE_STORAGE_KEY, targetRole);
    } catch {
      // ignore
    }
    if (targetRole === 'mestre') {
      setCampaign((prev) => ({
        ...prev,
        mestreSessionId: sessionId,
        mestreNome: userName,
      }));
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'gm:claim', payload: { sessionId, userName } })
        );
      }
    } else {
      setActiveDockCategory(null);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'gm:release', payload: { sessionId } })
        );
      }
    }
  };

  // Firebase Auth listener + Google Login / Logout handlers
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (u) {
        setSessionId(u.uid);
        if (u.displayName) {
          setUserName(u.displayName);
        }
      } else {
        setSessionId(clientSessionIdSingleton);
      }
    });
    return () => unsubAuth();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(`Aviso ao autenticar com Google: ${msg}`);
    }
  };

  const handleGoogleLogout = async () => {
    setAuthError('');
    try {
      await logoutFirebase();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(`Erro ao sair: ${msg}`);
    }
  };

  // Real-time Firestore listener (onSnapshot) for User Rooms (/users/{uid})
  useEffect(() => {
    if (!firebaseUser) return;
    const userDocPath = `users/${firebaseUser.uid}`;
    const userDocRef = doc(db, 'users', firebaseUser.uid);

    const unsub = onSnapshot(
      userDocRef,
      (snap) => {
        if (!snap.exists()) {
          // Seed initial user profile & rooms in Firestore
          saveOwlbearRooms(owlbearRooms);
          return;
        }
        const data = snap.data();
        if (Array.isArray(data.rooms) && data.rooms.length > 0) {
          setOwlbearRooms(data.rooms as OwlbearRoomItem[]);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, userDocPath);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  // Real-time Firestore listener (onSnapshot) for active Campaign Room (/campaigns/{codigoSala})
  const isFirestoreCampaignSnapshotRef = useRef<boolean>(false);
  useEffect(() => {
    if (!firebaseUser || !campaign.codigoSala) return;
    const roomDocPath = `campaigns/${campaign.codigoSala}`;
    const roomDocRef = doc(db, 'campaigns', campaign.codigoSala);

    const unsub = onSnapshot(
      roomDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const remoteCampaign = data.campaign as CampaignState | undefined;
        if (
          remoteCampaign &&
          Array.isArray(remoteCampaign.cenas) &&
          Array.isArray(remoteCampaign.fichas)
        ) {
          isFirestoreCampaignSnapshotRef.current = true;
          isRemoteUpdateRef.current = true;
          setCampaign((prev) => ({
            ...remoteCampaign,
            logsCombate:
              Array.isArray(remoteCampaign.logsCombate) &&
              remoteCampaign.logsCombate.length > 0
                ? remoteCampaign.logsCombate
                : prev.logsCombate,
          }));
          window.setTimeout(() => {
            isRemoteUpdateRef.current = false;
            isFirestoreCampaignSnapshotRef.current = false;
          }, 25);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, roomDocPath);
      }
    );

    return () => unsub();
  }, [firebaseUser, campaign.codigoSala]);

  // 60 FPS Optimization: Debounced Firestore write (setDoc) so dragging/panning/doors never stall the main thread
  useEffect(() => {
    if (!firebaseUser || !campaign.codigoSala || isFirestoreCampaignSnapshotRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      const roomDocPath = `campaigns/${campaign.codigoSala}`;
      const roomDocRef = doc(db, 'campaigns', campaign.codigoSala);
      setDoc(
        roomDocRef,
        sanitizeForFirestore({
          ownerId: firebaseUser.uid,
          codigoSala: campaign.codigoSala,
          nomeCampanha: campaign.nomeCampanha,
          campaign,
          updatedAt: Date.now(),
        }),
        { merge: true }
      ).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, roomDocPath);
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [campaign, firebaseUser]);

  // Sync state to BroadcastChannel + WebSocket (Firestore is persisted asynchronously above for locked 60 FPS)
  const commitCampaignState = (updater: (prev: CampaignState) => CampaignState) => {
    setCampaign((prev) => {
      const next = updater(prev);
      next.nomesCampanha = syncCampaignCharacterNames(next.nomesCampanha || [], next.fichas || []);
      if (!isRemoteUpdateRef.current) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'campaign:update', payload: next }));
        }
        if (bcRef.current) {
          bcRef.current.postMessage({ type: 'campaign:state', payload: next });
        }
      }
      return next;
    });
  };

  // Single-step Undo for Wall Batches & Manual Wall edits (Ctrl+Z)
  const handleUndoWalls = useCallback(() => {
    if (userRole !== 'mestre') return;
    setWallUndoStack((prevStack) => {
      if (prevStack.length === 0) return prevStack;
      const lastEntry = prevStack[prevStack.length - 1];
      commitCampaignState((prev) => ({
        ...prev,
        cenas: prev.cenas.map((c) =>
          c.id === lastEntry.sceneId
            ? { ...c, paredes: lastEntry.previousWalls }
            : c
        ),
      }));
      return prevStack.slice(0, -1);
    });
  }, [userRole]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'z' &&
        !e.shiftKey &&
        userRole === 'mestre' &&
        wallUndoStack.length > 0
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleUndoWalls();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [userRole, wallUndoStack.length, handleUndoWalls]);

  /**
   * Section 7: Isolated pushRoll(entry) function.
   * Appends the roll entry to the table state and broadcasts it over the real-time sync channel.
   */
  const pushRoll = (entry: CombatLogEntry) => {
    setCampaign((prev) => {
      if (prev.logsCombate.some((l) => l.id === entry.id)) return prev;
      return {
        ...prev,
        logsCombate: [entry, ...prev.logsCombate].slice(0, 40),
      };
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'roll:push', payload: entry }));
    }
    if (bcRef.current) {
      bcRef.current.postMessage({ type: 'roll:pushed', payload: entry });
    }
  };

  // Connect to Real-Time WebSocket + BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('owlbear_quest_vtt_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'campaign:state' && ev.data.payload) {
          isRemoteUpdateRef.current = true;
          setCampaign(ev.data.payload);
          isRemoteUpdateRef.current = false;
        } else if (ev.data?.type === 'roll:pushed' && ev.data.payload) {
          const incoming: CombatLogEntry = ev.data.payload;
          setCampaign((prev) => {
            if (prev.logsCombate.some((l) => l.id === incoming.id)) return prev;
            return {
              ...prev,
              logsCombate: [incoming, ...prev.logsCombate].slice(0, 40),
            };
          });
        }
      };
      bcRef.current = bc;
    }

    const customWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
    const isStaticGithubPages =
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('.github.io') &&
      !customWsUrl;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = customWsUrl || `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;

    if (!isStaticGithubPages) {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: 'session:register',
              payload: {
                sessionId,
                userName,
                requestedRole: userRole,
              },
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'campaign:init' || msg.type === 'campaign:state') {
              if (msg.payload) {
                isRemoteUpdateRef.current = true;
                const defaultCrypt = INITIAL_CAMPAIGN_STATE.cenas[0];
                const incomingCenas = Array.isArray(msg.payload.cenas)
                  ? msg.payload.cenas.map((c: MapScene) =>
                      c.id === 'scene-crypt' && (!c.paredes || c.paredes.length === 0)
                        ? {
                            ...c,
                            colisaoParedesAtiva: c.colisaoParedesAtiva ?? true,
                            paredes: defaultCrypt.paredes,
                          }
                        : c
                    )
                  : [];
                setCampaign((prev) => ({
                  ...msg.payload,
                  cenas: incomingCenas.length > 0 ? incomingCenas : prev.cenas,
                  mestreSessionId: msg.payload.mestreSessionId ?? prev.mestreSessionId,
                  mestreNome: msg.payload.mestreNome ?? prev.mestreNome,
                }));
                isRemoteUpdateRef.current = false;
              }
            } else if (msg.type === 'token:moved' && msg.payload) {
              const { sceneId, tokenId, x, y } = msg.payload;
              isRemoteUpdateRef.current = true;
              setCampaign((prev) => ({
                ...prev,
                cenas: prev.cenas.map((c) =>
                  c.id === sceneId
                    ? {
                        ...c,
                        tokens: c.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)),
                      }
                    : c
                ),
              }));
              isRemoteUpdateRef.current = false;
            } else if ((msg.type === 'roll:pushed' || msg.type === 'log:added') && msg.payload) {
              isRemoteUpdateRef.current = true;
              setCampaign((prev) => {
                if (prev.logsCombate.some((l) => l.id === msg.payload.id)) return prev;
                return {
                  ...prev,
                  logsCombate: [msg.payload, ...prev.logsCombate].slice(0, 40),
                };
              });
              isRemoteUpdateRef.current = false;
            }
          } catch {
            // ignore malformed messages
          }
        };
      } catch {
        // fallback to localStorage/BroadcastChannel if running purely static
      }
    }

    return () => {
      ws?.close();
      bcRef.current?.close();
    };
  }, []);

  // Zero-lag Token Movement Handler: skips localStorage serialization during live 60fps drag!
  const handleMoveToken = (
    tokenId: string,
    newX: number,
    newY: number,
    isLiveDrag?: boolean
  ) => {
    if (isLiveDrag) {
      // Lightweight WebSocket broadcast only during active mouse drag
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'token:move',
            payload: { sceneId: activeScene.id, tokenId, x: newX, y: newY },
          })
        );
      }
      return;
    }

    setCampaign((prev) => {
      const next: CampaignState = {
        ...prev,
        cenas: prev.cenas.map((c) =>
          c.id === activeScene.id
            ? {
                ...c,
                tokens: c.tokens.map((t) =>
                  t.id === tokenId
                    ? {
                        ...t,
                        x: newX,
                        y: newY,
                        memoriaExplorada: recordTokenFogMemoryPath(
                          t.memoriaExplorada,
                          { ...t, x: newX, y: newY },
                          { x: t.x, y: t.y }
                        ),
                      }
                    : t
                ),
              }
            : c
        ),
      };
      if (bcRef.current) {
        bcRef.current.postMessage({ type: 'campaign:state', payload: next });
      }
      return next;
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'token:move',
          payload: { sceneId: activeScene.id, tokenId, x: newX, y: newY },
        })
      );
    }
  };

  const handleUpdateToken = (updatedToken: MapToken) => {
    const tokenWithMemory: MapToken = {
      ...updatedToken,
      memoriaExplorada: recordTokenFogMemoryStep(
        updatedToken.memoriaExplorada,
        updatedToken
      ),
    };
    commitCampaignState((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) =>
        c.id === activeScene.id
          ? {
              ...c,
              tokens: c.tokens.map((t) => (t.id === tokenWithMemory.id ? tokenWithMemory : t)),
            }
          : c
      ),
      fichas: prev.fichas.map((f) =>
        f.id === tokenWithMemory.fichaId
          ? {
              ...f,
              nomePersonagem: tokenWithMemory.nome || f.nomePersonagem,
              pvAtual: tokenWithMemory.pvAtual ?? f.pvAtual,
              visaoAlcanceQuadrados: tokenWithMemory.visaoQuadrados,
              luzAlcanceQuadrados: tokenWithMemory.luzQuadrados,
            }
          : f
      ),
    }));
  };

  const handleDeleteToken = (tokenId: string) => {
    const targetTok = activeScene.tokens.find((t) => t.id === tokenId);
    if (userRole !== 'mestre' && !targetTok?.ehFonteDeLuz) return;
    commitCampaignState((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) =>
        c.id === activeScene.id
          ? { ...c, tokens: c.tokens.filter((t) => t.id !== tokenId) }
          : c
      ),
      iniciativa: {
        ...prev.iniciativa,
        participantes: prev.iniciativa.participantes.filter((p) => p.tokenId !== tokenId),
      },
    }));
    if (selectedTokenId === tokenId) setSelectedTokenId(null);
  };

  const handleUpdateCharacterSheet = (updatedSheet: CharacterSheet) => {
    commitCampaignState((prev) => ({
      ...prev,
      fichas: prev.fichas.map((f) => (f.id === updatedSheet.id ? updatedSheet : f)),
      cenas: prev.cenas.map((scene) => ({
        ...scene,
        tokens: scene.tokens.map((tok) =>
          tok.fichaId === updatedSheet.id
            ? {
                ...tok,
                nome: updatedSheet.nomePersonagem,
                pvAtual: updatedSheet.pvAtual,
                pvMaximo: updatedSheet.pvMaximo,
                ca: updatedSheet.classeArmadura,
                visaoQuadrados: updatedSheet.visaoAlcanceQuadrados,
                luzQuadrados: updatedSheet.luzAlcanceQuadrados,
                imagemUrl: updatedSheet.avatarUrl || tok.imagemUrl,
              }
            : tok
        ),
      })),
      iniciativa: {
        ...prev.iniciativa,
        participantes: prev.iniciativa.participantes.map((p) =>
          p.fichaId === updatedSheet.id
            ? {
                ...p,
                nome: updatedSheet.nomePersonagem,
                pvAtual: updatedSheet.pvAtual,
                pvMaximo: updatedSheet.pvMaximo,
                ca: updatedSheet.classeArmadura,
              }
            : p
        ),
      },
    }));
  };

  const handleRenameCharacterSheet = (sheetId: string, newName: string) => {
    const target = campaign.fichas.find((f) => f.id === sheetId);
    if (!target || !newName.trim()) return;
    handleUpdateCharacterSheet({
      ...target,
      nomePersonagem: newName.trim(),
      atualizadoEm: Date.now(),
    });
  };

  const handleOpenSheetGuarded = (sheetId: string) => {
    const targetSheet = campaign.fichas.find((f) => f.id === sheetId);
    if (!canUserOpenCharacterSheet(targetSheet, userRole, activePlayingSheetId, sessionId)) {
      return;
    }
    setActiveSheetModalId(sheetId);
  };

  const handleSelectAndClaimSheet = (sheetId: string) => {
    const claimResult = claimCharacterSheetForPlayer(
      campaign.fichas,
      sheetId,
      sessionId,
      userName,
      userRole
    );
    if (!claimResult.claimed) {
      setSheetClaimError(claimResult.error || 'Esta ficha já está ocupada por outro jogador.');
      return;
    }
    setSheetClaimError('');
    setActivePlayingSheetId(sheetId);
    const ownTok = activeScene.tokens.find((t) => t.fichaId === sheetId);
    if (ownTok) {
      setSelectedTokenId(ownTok.id);
    }
    if (userRole === 'jogador') {
      commitCampaignState((prev) => {
        const res = claimCharacterSheetForPlayer(
          prev.fichas,
          sheetId,
          sessionId,
          userName,
          userRole
        );
        return res.claimed ? { ...prev, fichas: res.updatedSheets } : prev;
      });
    }
  };

  const handleReleaseSheetLock = (sheetId: string) => {
    setSheetClaimError('');
    commitCampaignState((prev) => ({
      ...prev,
      fichas: releaseCharacterSheetLock(prev.fichas, sheetId),
    }));
  };

  const handleCreateCharacterFromHub = (newSheet: CharacterSheet, spawnToken: boolean) => {
    const sheetWithClaim: CharacterSheet =
      userRole === 'jogador'
        ? {
            ...newSheet,
            ocupadoPorSessionId: sessionId,
            ocupadoPorNome: userName,
          }
        : newSheet;

    const newToken: MapToken | null =
      spawnToken && userRole === 'mestre'
        ? {
            id: `tok-${Date.now()}`,
            nome: sheetWithClaim.nomePersonagem,
            categoria: 'character',
            fichaId: newSheet.id,
            x: 8,
            y: 8,
            larguraQuadrados: 1,
            alturaQuadrados: 1,
            rotacao: 0,
            cor: newSheet.corToken || '#8b5cf6',
            imagemUrl: newSheet.avatarUrl,
            pvAtual: newSheet.pvAtual,
            pvMaximo: newSheet.pvMaximo,
            ca: newSheet.classeArmadura,
            visaoQuadrados: newSheet.visaoAlcanceQuadrados,
            luzQuadrados: newSheet.luzAlcanceQuadrados,
            luzCor: '#f59e0b',
            ocultoParaJogadores: false,
            bloqueado: false,
            condicoes: [],
          }
        : null;

    const newAsset: MediaAsset = {
      id: `asset-${newSheet.id}`,
      nome: `${newSheet.nomePersonagem} (${newSheet.classeNivel})`,
      categoria: 'character',
      pastaId: 'folder-char-1',
      dataUrl: newSheet.avatarUrl,
      larguraOriginal: 512,
      alturaOriginal: 512,
      mimeType: 'image/svg+xml',
      tamanhoBytes: 1200,
      padraoQuadrados: 1,
      fichaPersonagemId: newSheet.id,
    };

    commitCampaignState((prev) => {
      const baseFichas =
        userRole === 'jogador'
          ? prev.fichas.map((f) =>
              f.ocupadoPorSessionId === sessionId
                ? { ...f, ocupadoPorSessionId: null, ocupadoPorNome: null }
                : f
            )
          : prev.fichas;
      return {
        ...prev,
        fichas: [sheetWithClaim, ...baseFichas],
        assets: [newAsset, ...prev.assets],
        nomesCampanha: syncCampaignCharacterNames(
          [...prev.nomesCampanha, sheetWithClaim.nomePersonagem],
          [sheetWithClaim, ...baseFichas]
        ),
        cenas: newToken
          ? prev.cenas.map((c) =>
              c.id === prev.cenaAtivaId ? { ...c, tokens: [...c.tokens, newToken] } : c
            )
          : prev.cenas,
      };
    });

    setSheetClaimError('');
    setActivePlayingSheetId(sheetWithClaim.id);
    if (newToken) setSelectedTokenId(newToken.id);
  };

  const handleDeleteCharacter = (sheetId: string) => {
    if (userRole !== 'mestre') return;
    commitCampaignState((prev) => {
      const remaining = prev.fichas.filter((f) => f.id !== sheetId);
      const removedSheet = prev.fichas.find((f) => f.id === sheetId);
      return {
        ...prev,
        fichas: remaining,
        nomesCampanha: prev.nomesCampanha.filter(
          (n) => n.toLowerCase() !== removedSheet?.nomePersonagem.toLowerCase()
        ),
      };
    });
  };

  /**
   * Executes Damage / Healing (cu) / Temporary HP (vdt) / Resistance (R) via pure dano.ts runLine()
   * Atomically updates character sheets, map tokens, and initiative tracker, and logs full breakdown.
   */
  const handleExecuteDamageLine = (rawLine: string, privadoMestre: boolean) => {
    const adapters: Array<SheetHpAdapter & { id: string }> = campaign.fichas.map((f) => ({
      id: f.id,
      name: f.nomePersonagem,
      pv: f.pvAtual,
      pvMax: f.pvMaximo,
      pvTemp: f.pvTemporario || 0,
    }));

    // Throws error in Portuguese if any segment is invalid or sheet not found (atomic: nothing changes)
    const appliedList = runLine(rawLine, adapters);

    const updatedAdapterMap = new Map<string, SheetHpAdapter & { id: string }>();
    for (const a of adapters) {
      updatedAdapterMap.set(a.id, a);
    }

    commitCampaignState((prev) => {
      const nextFichas = prev.fichas.map((f) => {
        const mod = updatedAdapterMap.get(f.id);
        if (!mod) return f;
        if (mod.pv === f.pvAtual && mod.pvTemp === (f.pvTemporario || 0)) return f;
        return {
          ...f,
          pvAtual: mod.pv,
          pvTemporario: mod.pvTemp,
          atualizadoEm: Date.now(),
        };
      });

      const nextCenas = prev.cenas.map((scene) => ({
        ...scene,
        tokens: scene.tokens.map((tok) => {
          if (!tok.fichaId) return tok;
          const mod = updatedAdapterMap.get(tok.fichaId);
          return mod ? { ...tok, pvAtual: mod.pv } : tok;
        }),
      }));

      const nextParticipantes = prev.iniciativa.participantes.map((p) => {
        if (!p.fichaId) return p;
        const mod = updatedAdapterMap.get(p.fichaId);
        return mod ? { ...p, pvAtual: mod.pv } : p;
      });

      return {
        ...prev,
        fichas: nextFichas,
        cenas: nextCenas,
        iniciativa: {
          ...prev.iniciativa,
          participantes: nextParticipantes,
        },
      };
    });

    const now = Date.now();
    const historyEntry: DamageHistoryEntry = {
      id: `dmg-${now}-${Math.random().toString(36).slice(2, 6)}`,
      ts: now,
      items: appliedList.map((it) => ({
        effect: it.effect,
        report: it.report,
        targetDisplayName: it.target.name,
      })),
    };
    setDamageHistory((prev) => [historyEntry, ...prev].slice(0, 30));

    // Also push a detailed CombatLogEntry so everyone sees the exact damage/healing/tempHP report in the main log
    const rollsForLog: ParsedRollGroup[] = appliedList.map(({ effect, report, target }) => {
      const kindTitle =
        effect.kind === 'dano'
          ? `Dano em ${target.name}${effect.hasR ? ' [Resistência R]' : ''}`
          : effect.kind === 'cura'
            ? `Cura (cu) em ${target.name}`
            : `Vida Temporária (vdt) em ${target.name}`;

      let detailStr = '';
      if (effect.kind === 'dano') {
        const termsStr = effect.terms
          .map(
            (t, idx) =>
              `${idx > 0 ? ` ${t.sign} ` : t.sign === '-' ? '-' : ''}${t.d}${t.res ? ' [R]' : ''}`
          )
          .join('');
        const resInfo = effect.hasR
          ? ` (resistido ${effect.resSum} → ${effect.halved})`
          : '';
        const absInfo =
          report.absorvido > 0 ? ` · Temp absorveu ${report.absorvido}` : '';
        detailStr = `${termsStr}${resInfo} · PV ${report.antes.pv}→${report.depois.pv} (Temp ${report.antes.temp}→${report.depois.temp})${absInfo}`;
      } else if (effect.kind === 'cura') {
        const lostInfo = report.perdido > 0 ? ` (${report.perdido} excedente)` : '';
        detailStr = `${effect.d || effect.final} · PV ${report.antes.pv}→${report.depois.pv}${lostInfo}`;
      } else {
        detailStr = `${effect.d || effect.final} · PV Temp ${report.antes.temp}→${report.depois.temp}`;
      }

      return {
        label: kindTitle,
        formula: effect.formula,
        results: [
          {
            t: effect.final,
            d: detailStr,
          },
        ],
      };
    });

    const activeSheet = campaign.fichas.find((f) => f.id === activePlayingSheetId);
    const displayName = activeSheet?.nomePersonagem || userName;
    const displayColor = activeSheet?.corToken || '#f43f5e';

    const logEntry: CombatLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      ts: now,
      autorNome: userName,
      name: displayName,
      autorCor: displayColor,
      color: displayColor,
      personagemId: activeSheet?.id,
      personagemNome: displayName,
      tipoAcao: appliedList[0]?.effect.kind === 'cura' ? 'cura' : 'dano',
      titulo: rollsForLog[0]?.label || 'Efeito de Vida',
      formulaOriginal: rawLine,
      formulaResolvida: rollsForLog[0]?.formula || rawLine,
      dadosIndividuais: [],
      modificadorTotal: 0,
      resultadoFinal: rollsForLog[0]?.results[0]?.t ?? 0,
      criticoSucesso: false,
      criticoFalha: false,
      rolls: rollsForLog,
      privadoMestre,
    };

    pushRoll(logEntry);
  };

  // Handler for Rollem rolls from RightQuestPortalSidebar -> calls isolated pushRoll(entry)
  const handlePushRollemRoll = (
    rolls: ParsedRollGroup[],
    privadoMestre: boolean,
    rawInput: string
  ) => {
    const activeSheet = campaign.fichas.find((f) => f.id === activePlayingSheetId);
    const firstGroup = rolls[0];
    const firstRes = firstGroup?.results[0];
    const now = Date.now();
    const displayName = activeSheet?.nomePersonagem || userName;
    const displayColor = activeSheet?.corToken || '#8b5cf6';

    const entry: CombatLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      ts: now,
      autorNome: userName,
      name: displayName,
      autorCor: displayColor,
      color: displayColor,
      personagemId: activeSheet?.id,
      personagemNome: displayName,
      tipoAcao: 'rolagem_livre',
      titulo: firstGroup?.label || `Rolagem (${firstGroup?.formula || rawInput})`,
      formulaOriginal: rawInput,
      formulaResolvida: firstGroup?.formula || rawInput,
      dadosIndividuais: [],
      modificadorTotal: 0,
      resultadoFinal: firstRes?.t ?? 0,
      criticoSucesso: false,
      criticoFalha: false,
      rolls,
      privadoMestre,
    };

    pushRoll(entry);
  };

  // Handler for rolls triggered from the 3-page D&D 5e Character Sheet -> uses rollInput + pushRoll
  const handleRollFromSheet = (params: {
    sheet: CharacterSheet;
    tipoAcao: 'ataque' | 'salvaguarda' | 'pericia' | 'atributo' | 'iniciativa' | 'magia' | 'macro';
    titulo: string;
    formula: string;
    danoFormula?: string;
    tipoDano?: string;
    privadoMestre: boolean;
    detalhesTexto?: string;
  }) => {
    const resolvedFormula = interpolateSheetVariables(params.formula, params.sheet);
    const rollText = `${resolvedFormula} ${params.titulo}`.trim();

    let parsedGroups: ParsedRollGroup[];
    try {
      parsedGroups = rollInput(rollText, null);
    } catch {
      const fallback = evaluateDiceExpression(params.formula, params.sheet);
      parsedGroups = [
        {
          label: fallback.rotulo || params.titulo,
          formula: fallback.formulaResolvida,
          results: [{ t: fallback.resultadoFinal, d: String(fallback.resultadoFinal) }],
        },
      ];
    }

    const firstRes = parsedGroups[0]?.results[0];
    const isCrit20 = Boolean(firstRes && /\[20\]/.test(firstRes.d));

    let danoExtra: CombatLogEntry['danoExtra'] | undefined;
    if (params.danoFormula) {
      const resolvedDmg = interpolateSheetVariables(params.danoFormula, params.sheet);
      const dmgFormula = isCrit20
        ? resolvedDmg.replace(/^(\d+)d(\d+)/i, (_, c, f) => `${Number(c) * 2}d${f}`)
        : resolvedDmg;
      try {
        const dmgGroups = rollInput(dmgFormula, null);
        const dmgRes = dmgGroups[0]?.results[0];
        if (dmgRes) {
          danoExtra = {
            formula: dmgGroups[0].formula,
            total: dmgRes.t,
            tipo: params.tipoDano || 'Dano',
            dados: [],
            detalhe: dmgRes.d,
          };
        }
      } catch {
        // ignore damage parse error
      }
    }

    const now = Date.now();
    const newEntry: CombatLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      ts: now,
      autorNome: params.sheet.nomeJogador || userName,
      name: params.sheet.nomePersonagem,
      autorCor: params.sheet.corToken || '#8b5cf6',
      color: params.sheet.corToken || '#8b5cf6',
      personagemId: params.sheet.id,
      personagemNome: params.sheet.nomePersonagem,
      tipoAcao: params.tipoAcao,
      titulo: parsedGroups[0]?.label || params.titulo,
      formulaOriginal: params.formula,
      formulaResolvida: parsedGroups[0]?.formula || resolvedFormula,
      dadosIndividuais: [],
      modificadorTotal: 0,
      resultadoFinal: firstRes?.t ?? 0,
      criticoSucesso: isCrit20,
      criticoFalha: false,
      rolls: parsedGroups,
      danoExtra,
      privadoMestre: params.privadoMestre,
      detalhesTexto: params.detalhesTexto,
    };

    pushRoll(newEntry);
    setSidebarOpen(true);
    setSidebarTab('chat');
  };

  const handleRollTableInitiativeAllTokens = () => {
    const { participantes, logs } = rollTableInitiativeForTokens(
      activeScene.tokens,
      campaign.fichas
    );
    commitCampaignState((prev) => ({
      ...prev,
      iniciativa: {
        ativo: true,
        rodada: 1,
        turnoIndice: 0,
        participantes,
      },
      logsCombate: [...logs, ...prev.logsCombate].slice(0, 40),
    }));
    setSidebarOpen(true);
    setSidebarTab('iniciativa');
  };

  const handleNextInitiativeTurn = () => {
    commitCampaignState((prev) => {
      const count = prev.iniciativa.participantes.length;
      if (count === 0) return prev;
      const nextIdx = (prev.iniciativa.turnoIndice + 1) % count;
      const nextRound = nextIdx === 0 ? prev.iniciativa.rodada + 1 : prev.iniciativa.rodada;
      return {
        ...prev,
        iniciativa: {
          ...prev.iniciativa,
          turnoIndice: nextIdx,
          rodada: nextRound,
        },
      };
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#191a21] text-zinc-100 select-none">
      {/* PERSISTENT BACKGROUND AUDIO ENGINE (Plays audio invisibly even when tab or sidebar is closed) */}
      <PersistentAudioEngine tracks={campaign.faixasMusica} />

      {/* MAIN TACTICAL MAP CANVAS WITH DYNAMIC FOG, LIGHT & ACTIVE TURN LIGHTBULB 💡 */}
      <TacticalMapCanvas
        scene={activeScene}
        sheets={campaign.fichas}
        userRole={userRole}
        activePlayingSheetId={activePlayingSheetId}
        activeTool={activeMapTool}
        zoom={zoom}
        pan={pan}
        onChangePan={setPan}
        onChangeZoom={setZoom}
        selectedTokenId={selectedTokenId}
        activeTurnTokenId={activeTurnToken?.id || null}
        activeTurnFichaId={activeTurnParticipant?.fichaId || null}
        onSelectToken={setSelectedTokenId}
        onMoveToken={handleMoveToken}
        onUpdateToken={handleUpdateToken}
        onDeleteToken={handleDeleteToken}
        onPlaceLightToken={(gridX, gridY) => {
          const newLight = createInvisibleLightToken(gridX, gridY, 4);
          commitCampaignState((prev) => ({
            ...prev,
            cenas: prev.cenas.map((c) =>
              c.id === activeScene.id
                ? { ...c, tokens: [...c.tokens, newLight] }
                : c
            ),
          }));
          setSelectedTokenId(newLight.id);
          setActiveMapTool('hand');
        }}
        onAddWallSegment={(newSegment) => {
          if (userRole !== 'mestre') return;
          setWallUndoStack((prev) => [
            ...prev.slice(-19),
            { sceneId: activeScene.id, previousWalls: [...(activeScene.paredes || [])] },
          ]);
          commitCampaignState((prev) => ({
            ...prev,
            cenas: prev.cenas.map((c) =>
              c.id === activeScene.id
                ? {
                    ...c,
                    colisaoParedesAtiva: true,
                    paredes: insertWallOrDoorSegment(c.paredes, newSegment),
                  }
                : c
            ),
          }));
        }}
        onToggleDoorSegment={(segmentId) => {
          commitCampaignState((prev) => ({
            ...prev,
            cenas: prev.cenas.map((c) =>
              c.id === activeScene.id
                ? {
                    ...c,
                    paredes: (c.paredes || []).map((seg) =>
                      seg.id === segmentId && seg.tipo === 'porta'
                        ? { ...seg, aberta: !seg.aberta }
                        : seg
                    ),
                  }
                : c
            ),
          }));
        }}
        onDeleteWallSegment={(segmentId) => {
          if (userRole !== 'mestre') return;
          setWallUndoStack((prev) => [
            ...prev.slice(-19),
            { sceneId: activeScene.id, previousWalls: [...(activeScene.paredes || [])] },
          ]);
          commitCampaignState((prev) => ({
            ...prev,
            cenas: prev.cenas.map((c) =>
              c.id === activeScene.id
                ? {
                    ...c,
                    paredes: (c.paredes || []).filter((seg) => seg.id !== segmentId),
                  }
                : c
            ),
          }));
        }}
        onOpenSheet={(sheetId) => handleOpenSheetGuarded(sheetId)}
        onAddDrawing={(drawing) => {
          commitCampaignState((prev) => ({
            ...prev,
            cenas: prev.cenas.map((c) =>
              c.id === activeScene.id ? { ...c, desenhos: [...c.desenhos, drawing] } : c
            ),
          }));
          setRedoDrawings([]);
        }}
        onToggleSceneFog={() => {
          if (userRole !== 'mestre') return;
          commitCampaignState((prev) => ({
            ...prev,
            cenas: prev.cenas.map((c) =>
              c.id === activeScene.id ? { ...c, nevoaAtiva: !c.nevoaAtiva } : c
            ),
          }));
        }}
      />

      {/* TOP-LEFT OWLBEAR RODEO HUD BAR + PLAYERS PANEL */}
      <div className="fixed top-3 left-3 z-30 flex flex-col gap-2.5 pointer-events-none">
        <div className="flex items-center gap-1 bg-[#232530]/95 border border-zinc-700/80 rounded-2xl px-2.5 py-1.5 shadow-2xl pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowCampaignHub(true)}
            aria-label="Abrir Tela Inicial de Personagens e Campanha"
            title="Tela Inicial da Campanha (Nome, Foto de Capa & Fichas)"
            className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer mr-1"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          <div
            data-testid="hud-fixed-role-badge"
            title={
              userRole === 'mestre'
                ? 'Você é o Mestre (Criador da Sala)'
                : 'Você entrou na sala como Jogador'
            }
            className={`px-2 py-1 rounded-xl text-[11px] font-bold uppercase flex items-center gap-1 select-none ${
              userRole === 'mestre'
                ? 'bg-violet-600/30 text-violet-200 border border-violet-500/50'
                : 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{userRole === 'mestre' ? 'Mestre' : 'Jogador'}</span>
          </div>

          {userRole === 'mestre' && (
            <button
              type="button"
              onClick={() =>
                setActiveDockCategory(activeDockCategory === 'scene' ? null : 'scene')
              }
              title="Mapas & Cenas (Exclusivo do Mestre)"
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                activeDockCategory === 'scene'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab('iniciativa');
            }}
            aria-label="Acessar Ordem de Iniciativa"
            title="Ordem de Iniciativa da Mesa"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              sidebarOpen && sidebarTab === 'iniciativa'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab('chat');
            }}
            title="Chat de Dados Rollem & Dano Automático"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              sidebarOpen && sidebarTab === 'chat'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Dices className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenSheetGuarded(activePlayingSheetId)}
            aria-label="Abrir Ficha D&D 5e"
            title="Abrir Ficha D&D 5e Completa"
            className="p-1.5 rounded-xl text-zinc-300 hover:bg-zinc-700/60 hover:text-white transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="hud-open-notas-btn"
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab('notas');
            }}
            aria-label="Abrir Minhas Notas e Pastas Particulares"
            title="Minhas Notas & Pastas Particulares (Visível somente para você)"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              sidebarOpen && sidebarTab === 'notas'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab('musica');
            }}
            aria-label="Abrir Mixer de Música do YouTube"
            title="Mixer Multi-Música em Segundo Plano"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              sidebarOpen && sidebarTab === 'musica'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Music className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowCampaignHub(true)}
            title="Gerenciador de Fichas e Campanha"
            className="p-1.5 rounded-xl text-zinc-300 hover:bg-zinc-700/60 hover:text-white transition-colors cursor-pointer"
          >
            <Box className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="toggle-players-panel-btn"
            onClick={() => setPlayersPanelOpen((prev) => !prev)}
            aria-label={
              playersPanelOpen
                ? 'Ocultar aba de Players e Mestre'
                : 'Mostrar aba de Players e Mestre'
            }
            title={
              playersPanelOpen
                ? 'Ocultar aba de Players e Mestre'
                : 'Mostrar aba de Players e Mestre'
            }
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              playersPanelOpen
                ? 'bg-zinc-700/70 text-white'
                : 'text-zinc-400 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            {playersPanelOpen ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Collapsed Pill when Players & Mestre Card is hidden */}
        {!playersPanelOpen && (
          <button
            type="button"
            data-testid="show-players-panel-btn"
            onClick={() => setPlayersPanelOpen(true)}
            className="w-fit bg-[#232530]/95 hover:bg-[#2c2f3e] border border-zinc-700/80 rounded-xl px-3 py-1.5 shadow-xl pointer-events-auto flex items-center gap-2 text-xs font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer"
            title="Mostrar aba de Players e Mestre"
          >
            <Eye className="w-3.5 h-3.5 text-violet-400" />
            <span>Mostrar Players ({userRole === 'mestre' ? 'Mestre' : 'Jogador'})</span>
          </button>
        )}

        {/* Owlbear "Players" Card + Room Code + Fixed Role Badge + Character Access */}
        {playersPanelOpen && (
          <div
            data-testid="tabletop-players-panel"
            className="w-64 bg-[#232530]/95 border border-zinc-700/80 rounded-2xl p-3.5 shadow-2xl pointer-events-auto block"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-700/80">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">Players</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  {userRole === 'mestre' ? 'Modo Mestre' : 'Modo Jogador'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowCampaignHub(true)}
                  aria-label="Criar ou adicionar personagem à campanha"
                  title="Abrir Tela Inicial da Campanha"
                  className="p-1 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700/60 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  data-testid="hide-players-panel-btn"
                  onClick={() => setPlayersPanelOpen(false)}
                  aria-label="Ocultar aba de Players e Mestre"
                  title="Ocultar aba de Players e Mestre"
                  className="px-1.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Ocultar</span>
                </button>
              </div>
            </div>

            {/* Prominent Unique Room Code + Copy Button */}
            <div
              data-testid="tabletop-room-code-badge"
              className="mb-2 px-2.5 py-1.5 rounded-xl bg-[#181922] border border-violet-500/40 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <KeyRound className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[9px] uppercase tracking-wider text-zinc-400 font-semibold leading-none">
                    Código da Sala
                  </span>
                  <span className="text-xs font-mono font-extrabold text-violet-300 tracking-wider">
                    {campaign.codigoSala}
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="tabletop-copy-room-code-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(campaign.codigoSala).catch(() => {});
                  setCopiedTabletopCode(true);
                  window.setTimeout(() => setCopiedTabletopCode(false), 1800);
                }}
                className="px-2 py-1 rounded-lg bg-violet-600/25 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/40 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Copiar código único desta sala para convidar jogadores"
              >
                {copiedTabletopCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-300" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between py-1 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-3 h-3 rounded-full bg-[#4ade80] shrink-0" />
                <input
                  type="text"
                  aria-label="Meu Nome de Jogador"
                  data-testid="player-identity-input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  title="Seu nome de usuário (suas Notas e Pastas são particulares para este usuário)"
                  className="w-full bg-transparent hover:bg-[#181922] focus:bg-[#181922] border border-transparent focus:border-violet-500/60 rounded px-1.5 py-0.5 text-xs font-medium text-zinc-100 focus:outline-none truncate"
                />
              </div>

              <span
                data-testid="players-card-role-badge"
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 select-none ${
                  userRole === 'mestre'
                    ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                    : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                }`}
                title={
                  userRole === 'mestre'
                    ? 'Mestre (Criador da Sala)'
                    : 'Jogador conectado à sala'
                }
              >
                {userRole === 'mestre' ? '👑 Mestre' : '🛡️ Jogador'}
              </span>
            </div>

            {/* Compact Firebase Google Auth status inside Players Panel */}
            <div className="mt-1.5 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
              {firebaseUser ? (
                <>
                  <span className="text-[10px] text-emerald-300 truncate">
                    ☁️ {firebaseUser.email || firebaseUser.displayName}
                  </span>
                  <button
                    type="button"
                    data-testid="tabletop-google-logout-btn"
                    onClick={handleGoogleLogout}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-rose-900/50 text-[10px] font-semibold text-rose-300 flex items-center gap-1 cursor-pointer shrink-0"
                    title="Sair da conta Google"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sair</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  data-testid="tabletop-google-login-btn"
                  onClick={handleGoogleLogin}
                  className="w-full py-1 px-2 rounded-lg bg-zinc-800 hover:bg-violet-600/30 border border-zinc-700 hover:border-violet-500/50 text-[10px] font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Conectar com Google (Firebase Firestore)"
                >
                  <LogIn className="w-3 h-3 text-violet-400" />
                  <span>Conectar com Google</span>
                </button>
              )}
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-zinc-800 space-y-1.5">
              {userRole === 'mestre' ? (
                <>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    <span>Personagens na Campanha</span>
                    <span>{campaign.nomesCampanha.length}</span>
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {campaign.nomesCampanha.map((nome) => {
                      const ficha = campaign.fichas.find(
                        (f) => f.nomePersonagem.toLowerCase() === nome.toLowerCase()
                      );
                      return (
                        <div
                          key={nome}
                          onClick={() => {
                            if (ficha) handleOpenSheetGuarded(ficha.id);
                          }}
                          className="flex items-center justify-between px-2 py-1 rounded-lg bg-[#181922] hover:bg-zinc-800 text-xs cursor-pointer transition-colors"
                        >
                          <span className="truncate font-medium text-zinc-200">{nome}</span>
                          {ficha && (
                            <span className="text-[10px] font-mono text-violet-400 shrink-0 ml-1">
                              Ficha 5e
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    <span>Sua Ficha Selecionada</span>
                    <span>1/1</span>
                  </div>
                  <div className="space-y-1">
                    {getVisibleSheetsForTabletopPlayer(
                      campaign.fichas,
                      userRole,
                      activePlayingSheetId,
                      sessionId
                    ).map((ficha) => (
                      <div
                        key={ficha.id}
                        data-testid={`player-own-sheet-row-${ficha.id}`}
                        onClick={() => handleOpenSheetGuarded(ficha.id)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#181922] hover:bg-zinc-800 border border-emerald-500/30 text-xs cursor-pointer transition-colors"
                      >
                        <span className="truncate font-semibold text-zinc-100">
                          {ficha.nomePersonagem}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 shrink-0 ml-1">
                          Abrir Ficha 5e
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT VERTICAL OWLBEAR TOOL PALETTE */}
      <div className="fixed top-3 right-3 z-30 flex flex-col items-end gap-2 pointer-events-none">
        <button
          type="button"
          onClick={() => setSidebarOpen((p) => !p)}
          aria-label="Alternar painel lateral Quest Portal"
          title="Alternar Painel Lateral (Dados, Iniciativa, Música em 2º Plano)"
          className="w-9 h-9 rounded-full bg-[#232530]/95 border border-zinc-700/80 flex items-center justify-center text-zinc-200 hover:text-white shadow-xl pointer-events-auto cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
        </button>

        <div
          className={`flex flex-col items-center gap-1 bg-[#232530]/95 border border-zinc-700/80 rounded-2xl p-1.5 shadow-2xl pointer-events-auto transition-all ${
            sidebarOpen ? 'mr-[392px]' : ''
          }`}
          role="toolbar"
          aria-label="Ferramentas do Mapa Tático"
        >
          <button
            type="button"
            onClick={() => setActiveMapTool('hand')}
            aria-label="Ferramenta Mão (Mover Mapa e Tokens)"
            title="Mão — Mover Mapa e Arrastar Tokens"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              activeMapTool === 'hand'
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>

          {userRole === 'mestre' && (
            <button
              type="button"
              onClick={() => {
                commitCampaignState((prev) => ({
                  ...prev,
                  cenas: prev.cenas.map((c) =>
                    c.id === activeScene.id ? { ...c, nevoaAtiva: !c.nevoaAtiva } : c
                  ),
                }));
              }}
              aria-label="Alternar Névoa de Guerra Dinâmica"
              title={`Névoa de Guerra Dinâmica (${activeScene.nevoaAtiva ? 'Ativa' : 'Desativada'})`}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                activeScene.nevoaAtiva
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
              }`}
            >
              <CloudFog className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveMapTool('draw')}
            aria-label="Ferramenta Pincel Tático"
            title="Desenhar no Mapa"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              activeMapTool === 'draw'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveMapTool('measure')}
            aria-label="Ferramenta Régua de Distância (5ft)"
            title="Medir Distância e Alcance (5ft / 1,5m)"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              activeMapTool === 'measure'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="tool-add-light-btn"
            onClick={() =>
              setActiveMapTool(activeMapTool === 'light' ? 'hand' : 'light')
            }
            aria-label="Adicionar Luz no Mapa"
            title="Adicionar [Luz] no Mapa — Clique aqui e depois clique no mapa para colocar um ponto de iluminação invisível"
            className={`px-2 py-1.5 rounded-xl transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
              activeMapTool === 'light'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg ring-2 ring-amber-300'
                : 'text-amber-400 hover:bg-zinc-700/60'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span className="text-[9px] font-bold uppercase leading-none">Luz</span>
          </button>

          {userRole === 'mestre' && (
            <>
              <button
                type="button"
                data-testid="tool-toggle-wall-collision-btn"
                onClick={() => {
                  commitCampaignState((prev) => ({
                    ...prev,
                    cenas: prev.cenas.map((c) => {
                      if (c.id !== activeScene.id) return c;
                      const nextActive = !c.colisaoParedesAtiva;
                      return {
                        ...c,
                        colisaoParedesAtiva: nextActive,
                        paredes: c.paredes || [],
                      };
                    }),
                  }));
                }}
                aria-label="Ativar ou Desativar Colisão de Paredes e Luz Raycasting"
                title={`Colisão de Paredes & Sombra de Luz (${
                  activeScene.colisaoParedesAtiva ? 'Ativada' : 'Desativada'
                }) — Clique para alternar a qualquer momento`}
                className={`px-2 py-1.5 rounded-xl transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
                  activeScene.colisaoParedesAtiva
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/60 font-bold'
                    : 'text-zinc-400 hover:bg-zinc-700/60 hover:text-white'
                }`}
              >
                <BrickWall className="w-4 h-4" />
                <span className="text-[8px] font-bold uppercase leading-none">
                  {activeScene.colisaoParedesAtiva ? 'Colisão' : 'Sem Col.'}
                </span>
              </button>

              <button
                type="button"
                data-testid="tool-draw-wall-btn"
                onClick={() =>
                  setActiveMapTool(activeMapTool === 'wall' ? 'hand' : 'wall')
                }
                aria-label="Desenhar Parede no Mapa"
                title="Desenhar Parede (Bloqueia passagem de tokens e luz) — Arraste no mapa para criar parede"
                className={`px-2 py-1.5 rounded-xl transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
                  activeMapTool === 'wall'
                    ? 'bg-sky-500 text-zinc-950 font-bold shadow-lg ring-2 ring-sky-300'
                    : 'text-sky-400 hover:bg-zinc-700/60'
                }`}
              >
                <BrickWall className="w-4 h-4" />
                <span className="text-[8px] font-bold uppercase leading-none">Parede</span>
              </button>

              <button
                type="button"
                data-testid="tool-add-door-btn"
                onClick={() =>
                  setActiveMapTool(activeMapTool === 'door' ? 'hand' : 'door')
                }
                aria-label="Adicionar Porta no Mapa"
                title="Adicionar Porta (Abrir/Fechar no mapa: aberta passa luz e token, fechada bloqueia tudo) — Arraste no mapa para criar porta"
                className={`px-2 py-1.5 rounded-xl transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
                  activeMapTool === 'door'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-lg ring-2 ring-emerald-300'
                    : 'text-emerald-400 hover:bg-zinc-700/60'
                }`}
              >
                <DoorOpen className="w-4 h-4" />
                <span className="text-[8px] font-bold uppercase leading-none">Porta</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setActiveMapTool('text')}
            aria-label="Ferramenta Texto no Mapa"
            title="Inserir Rótulo de Texto no Mapa"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              activeMapTool === 'text'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Type className="w-4 h-4" />
          </button>

          <div className="w-6 h-px bg-zinc-700 my-0.5" />

          <button
            type="button"
            onClick={() => {
              if (activeScene.desenhos.length === 0) return;
              const last = activeScene.desenhos[activeScene.desenhos.length - 1];
              setRedoDrawings((r) => [...r, last]);
              commitCampaignState((prev) => ({
                ...prev,
                cenas: prev.cenas.map((c) =>
                  c.id === activeScene.id
                    ? { ...c, desenhos: c.desenhos.slice(0, -1) }
                    : c
                ),
              }));
            }}
            aria-label="Desfazer desenho"
            title="Desfazer"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (redoDrawings.length === 0) return;
              const nextDraw = redoDrawings[redoDrawings.length - 1];
              setRedoDrawings((r) => r.slice(0, -1));
              commitCampaignState((prev) => ({
                ...prev,
                cenas: prev.cenas.map((c) =>
                  c.id === activeScene.id
                    ? { ...c, desenhos: [...c.desenhos, nextDraw] }
                    : c
                ),
              }));
            }}
            aria-label="Refazer desenho"
            title="Refazer"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BOTTOM-LEFT OPTIONS BUTTON & BOTTOM-RIGHT "5ft" SCALE PILL */}
      <button
        type="button"
        onClick={() => setShowCampaignHub(true)}
        aria-label="Abrir Gerenciador Geral da Campanha"
        title="Abrir Tela Inicial & Gerenciador de Campanha"
        className="fixed bottom-4 left-4 z-30 w-10 h-10 rounded-full bg-[#232530] border border-zinc-700/80 flex items-center justify-center text-zinc-300 hover:text-white shadow-xl cursor-pointer"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => setZoom(1)}
        aria-label="Escala da grade 5ft"
        title="Escala Tática: 1 Quadrado = 5ft (1,5m) · Clique para resetar zoom"
        className="fixed bottom-4 right-4 z-30 px-3.5 py-2 rounded-full bg-[#232530] border border-zinc-700/80 text-xs font-mono font-semibold text-zinc-200 hover:text-white shadow-xl cursor-pointer tabular-nums"
      >
        {activeScene.escalaUnidade} · {Math.round(zoom * 100)}%
      </button>

      {/* BOTTOM-CENTER OWLBEAR RODEO DOCK — Exclusivo do Mestre */}
      {userRole === 'mestre' && (
        <BottomOwlbearDock
          userRole={userRole}
          activeCategory={activeDockCategory}
          onSelectCategory={setActiveDockCategory}
          searchQuery={dockSearchQuery}
          onChangeSearch={setDockSearchQuery}
          folders={campaign.pastasAssets}
          assets={campaign.assets}
          scenes={campaign.cenas}
          activeSceneId={activeScene.id}
          sheets={campaign.fichas}
          onSelectScene={(sceneId) => {
            commitCampaignState((prev) => ({ ...prev, cenaAtivaId: sceneId }));
          }}
          onCreateScene={(
            nome,
            pastaId,
            bgDataUrl,
            larguraQuadrados,
            alturaQuadrados,
            tamanhoGradePx,
            extraConfig
          ) => {
            if (userRole !== 'mestre') return;
            const novaCena: MapScene = {
              id: `scene-${Date.now()}`,
              nome,
              pastaId,
              fundoUrl: bgDataUrl || '',
              larguraQuadrados: larguraQuadrados || 24,
              alturaQuadrados: alturaQuadrados || 16,
              tamanhoGradePx: tamanhoGradePx || 64,
              escalaUnidade: extraConfig?.escalaUnidade || '5ft',
              proporcaoAspecto: extraConfig?.proporcaoAspecto,
              proporcaoTrancada: extraConfig?.proporcaoTrancada ?? true,
              corGrade: extraConfig?.corGrade || '#ffffff',
              opacidadeGrade: extraConfig?.opacidadeGrade ?? 0.22,
              espessuraLinhaPx: extraConfig?.espessuraLinhaPx ?? 2,
              tipoGrade: extraConfig?.tipoGrade || 'square',
              estiloLinha: extraConfig?.estiloLinha || 'solid',
              snappingAtivo: extraConfig?.snappingAtivo ?? true,
              nevoaAtiva: extraConfig?.nevoaAtiva ?? true,
              iluminacaoDinamicaAtiva: true,
              colisaoParedesAtiva: extraConfig?.colisaoParedesAtiva ?? true,
              paredes: extraConfig?.paredes || [],
              nevoaAreasManuais: [],
              tokens: [],
              desenhos: [],
            };
            commitCampaignState((prev) => ({
              ...prev,
              cenaAtivaId: novaCena.id,
              cenas: [...prev.cenas, novaCena],
            }));
          }}
          onUpdateSceneDimensions={(
            sceneId,
            larguraQuadrados,
            alturaQuadrados,
            tamanhoGradePx,
            extraConfig
          ) => {
            if (userRole !== 'mestre') return;
            commitCampaignState((prev) => ({
              ...prev,
              cenas: prev.cenas.map((c) =>
                c.id === sceneId
                  ? {
                      ...c,
                      ...extraConfig,
                      larguraQuadrados,
                      alturaQuadrados,
                      tamanhoGradePx,
                    }
                  : c
              ),
            }));
          }}
          onDeleteScene={(sceneId) => {
            if (userRole !== 'mestre') return;
            commitCampaignState((prev) => {
              const remaining = prev.cenas.filter((c) => c.id !== sceneId);
              if (remaining.length === 0) {
                const fallbackScene: MapScene = {
                  id: `scene-${Date.now()}`,
                  nome: 'Mapa Tático Principal',
                  pastaId: null,
                  fundoUrl: '',
                  larguraQuadrados: 24,
                  alturaQuadrados: 16,
                  tamanhoGradePx: 64,
                  escalaUnidade: '5ft',
                  nevoaAtiva: true,
                  iluminacaoDinamicaAtiva: true,
                  nevoaAreasManuais: [],
                  tokens: [],
                  desenhos: [],
                };
                return {
                  ...prev,
                  cenaAtivaId: fallbackScene.id,
                  cenas: [fallbackScene],
                };
              }
              const nextActiveId =
                prev.cenaAtivaId === sceneId ? remaining[0].id : prev.cenaAtivaId;
              return {
                ...prev,
                cenaAtivaId: nextActiveId,
                cenas: remaining,
              };
            });
          }}
          onCreateFolder={(nome, categoria) => {
            if (userRole !== 'mestre') return;
            const novaPasta: AssetFolder = {
              id: `folder-${Date.now()}`,
              nome,
              categoria,
              ordem: campaign.pastasAssets.length + 1,
            };
            commitCampaignState((prev) => ({
              ...prev,
              pastasAssets: [...prev.pastasAssets, novaPasta],
            }));
          }}
          onRenameFolder={(folderId, novoNome) => {
            if (userRole !== 'mestre') return;
            commitCampaignState((prev) => ({
              ...prev,
              pastasAssets: prev.pastasAssets.map((f) =>
                f.id === folderId ? { ...f, nome: novoNome } : f
              ),
            }));
          }}
          onDeleteFolder={(folderId) => {
            if (userRole !== 'mestre') return;
            commitCampaignState((prev) => ({
              ...prev,
              pastasAssets: prev.pastasAssets.filter((f) => f.id !== folderId),
              assets: prev.assets.map((a) =>
                a.pastaId === folderId ? { ...a, pastaId: null } : a
              ),
              cenas: prev.cenas.map((c) =>
                c.pastaId === folderId ? { ...c, pastaId: null } : c
              ),
            }));
          }}
          onUploadAssetLossless={(newAsset) => {
            if (userRole !== 'mestre') return;
            commitCampaignState((prev) => ({
              ...prev,
              assets: [newAsset, ...prev.assets],
            }));
          }}
          onUpdateAsset={(updatedAsset) => {
            if (userRole !== 'mestre') return;
            commitCampaignState((prev) => ({
              ...prev,
              assets: prev.assets.map((a) => (a.id === updatedAsset.id ? updatedAsset : a)),
            }));
          }}
          onDeleteAsset={(assetId) => {
            if (userRole !== 'mestre') return;
            commitCampaignState((prev) => ({
              ...prev,
              assets: prev.assets.filter((a) => a.id !== assetId),
            }));
          }}
          onSpawnAssetToMap={(asset) => {
            if (userRole !== 'mestre') return;
            const linkedSheet = asset.fichaPersonagemId
              ? campaign.fichas.find((f) => f.id === asset.fichaPersonagemId)
              : undefined;
            const newTok: MapToken = {
              id: `tok-${Date.now()}`,
              nome: linkedSheet?.nomePersonagem || asset.nome,
              categoria: asset.categoria,
              fichaId: linkedSheet?.id,
              x: 10,
              y: 7,
              larguraQuadrados: asset.padraoQuadrados || 1,
              alturaQuadrados: asset.padraoQuadrados || 1,
              rotacao: 0,
              cor: linkedSheet?.corToken || '#8b5cf6',
              imagemUrl: asset.dataUrl,
              pvAtual: linkedSheet?.pvAtual ?? (asset.categoria === 'character' ? 20 : undefined),
              pvMaximo: linkedSheet?.pvMaximo ?? (asset.categoria === 'character' ? 20 : undefined),
              ca: linkedSheet?.classeArmadura ?? (asset.categoria === 'character' ? 14 : undefined),
              visaoQuadrados:
                linkedSheet?.visaoAlcanceQuadrados ?? (asset.categoria === 'character' ? 6 : 0),
              luzQuadrados:
                linkedSheet?.luzAlcanceQuadrados ?? (asset.categoria === 'prop' ? 4 : 0),
              luzCor: '#f59e0b',
              ocultoParaJogadores: false,
              bloqueado: false,
              condicoes: [],
            };
            commitCampaignState((prev) => ({
              ...prev,
              cenas: prev.cenas.map((c) =>
                c.id === activeScene.id ? { ...c, tokens: [...c.tokens, newTok] } : c
              ),
            }));
            setSelectedTokenId(newTok.id);
          }}
          onOpenSheetById={(sheetId) => handleOpenSheetGuarded(sheetId)}
        />
      )}

      {/* RIGHT QUEST PORTAL SIDEBAR */}
      {sidebarOpen && (
        <RightQuestPortalSidebar
          activeTab={sidebarTab}
          onChangeTab={setSidebarTab}
          sessionId={sessionId}
          userName={userName}
          logs={campaign.logsCombate}
          damageHistory={damageHistory}
          sheets={campaign.fichas}
          activeSheetId={activePlayingSheetId}
          onSelectActiveSheet={handleSelectAndClaimSheet}
          onOpenFullSheet={(sheetId) => handleOpenSheetGuarded(sheetId)}
          onRenameSheet={handleRenameCharacterSheet}
          onDeleteSheet={handleDeleteCharacter}
          userRole={userRole}
          onPushRoll={handlePushRollemRoll}
          onExecuteDamageLine={handleExecuteDamageLine}
          iniciativa={campaign.iniciativa}
          tokensOnMap={activeScene.tokens}
          onRollTableInitiativeAllTokens={handleRollTableInitiativeAllTokens}
          onNextTurn={handleNextInitiativeTurn}
          onFocusTokenOnMap={(tokenId, fichaId) => {
            const targetTok = activeScene.tokens.find(
              (t) => (tokenId && t.id === tokenId) || (fichaId && t.fichaId === fichaId)
            );
            if (targetTok) focusCameraOnToken(targetTok);
          }}
          onResetInitiative={() => {
            commitCampaignState((prev) => ({
              ...prev,
              iniciativa: { ativo: false, rodada: 1, turnoIndice: 0, participantes: [] },
            }));
          }}
          onUpdateParticipantInitiative={(participantId, newTotal) => {
            commitCampaignState((prev) => {
              const updated = prev.iniciativa.participantes
                .map((p) => (p.id === participantId ? { ...p, iniciativaTotal: newTotal } : p))
                .sort((a, b) => b.iniciativaTotal - a.iniciativaTotal);
              return {
                ...prev,
                iniciativa: { ...prev.iniciativa, participantes: updated },
              };
            });
          }}
          musicFolders={campaign.pastasMusica}
          musicTracks={campaign.faixasMusica}
          onCreateMusicFolder={(nome) => {
            const nf: MusicFolder = {
              id: `mfolder-${Date.now()}`,
              nome,
              ordem: campaign.pastasMusica.length + 1,
            };
            commitCampaignState((prev) => ({
              ...prev,
              pastasMusica: [...prev.pastasMusica, nf],
            }));
          }}
          onAddMusicTrack={(trackData) => {
            const nt: MusicTrack = {
              ...trackData,
              id: `track-${Date.now()}`,
            };
            commitCampaignState((prev) => ({
              ...prev,
              faixasMusica: [nt, ...prev.faixasMusica],
            }));
          }}
          onToggleTrackPlay={(trackId) => {
            commitCampaignState((prev) => ({
              ...prev,
              faixasMusica: prev.faixasMusica.map((t) =>
                t.id === trackId ? { ...t, tocando: !t.tocando } : t
              ),
            }));
          }}
          onChangeTrackVolume={(trackId, volume) => {
            commitCampaignState((prev) => ({
              ...prev,
              faixasMusica: prev.faixasMusica.map((t) =>
                t.id === trackId ? { ...t, volume } : t
              ),
            }));
          }}
          onToggleTrackLoop={(trackId) => {
            commitCampaignState((prev) => ({
              ...prev,
              faixasMusica: prev.faixasMusica.map((t) =>
                t.id === trackId ? { ...t, loop: !t.loop } : t
              ),
            }));
          }}
          onDeleteTrack={(trackId) => {
            commitCampaignState((prev) => ({
              ...prev,
              faixasMusica: prev.faixasMusica.filter((t) => t.id !== trackId),
            }));
          }}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
      )}

      {/* FULL 3-PAGE D&D 5E CHARACTER SHEET DRAWER MODAL */}
      {openedSheetModal && (
        <CharacterSheetDrawer
          sheet={openedSheetModal}
          onUpdateSheet={handleUpdateCharacterSheet}
          onRollFromSheet={handleRollFromSheet}
          onClose={() => setActiveSheetModalId(null)}
        />
      )}

      {/* INITIAL CAMPAIGN HUB & QUICK CHARACTER CREATOR MODAL */}
      {showCampaignHub && !showRoomsScreen && (
        <CampaignHubModal
          campaign={campaign}
          activeSheetId={activePlayingSheetId}
          sessionId={sessionId}
          userRole={userRole}
          userName={userName}
          sheetClaimError={sheetClaimError}
          onChangeUserName={setUserName}
          onUpdateCampaignMeta={(nomeCampanha, capaCampanhaUrl) => {
            const nextCover = capaCampanhaUrl ?? campaign.capaCampanhaUrl;
            commitCampaignState((prev) => ({
              ...prev,
              nomeCampanha,
              capaCampanhaUrl: nextCover,
            }));
            setOwlbearRooms((prevRooms) => {
              const updated = prevRooms.map((r) =>
                r.codigo === campaign.codigoSala
                  ? {
                      ...r,
                      nome: nomeCampanha,
                      imagemMesaUrl: nextCover || r.imagemMesaUrl,
                    }
                  : r
              );
              saveOwlbearRooms(updated);
              return updated;
            });
          }}
          onSelectSheet={handleSelectAndClaimSheet}
          onReleaseSheetLock={handleReleaseSheetLock}
          onOpenFullSheet={(sheetId) => {
            const targetSheet = campaign.fichas.find((f) => f.id === sheetId);
            if (!canUserOpenCharacterSheet(targetSheet, userRole, activePlayingSheetId, sessionId)) {
              return;
            }
            setShowCampaignHub(false);
            setActiveSheetModalId(sheetId);
          }}
          onCreateCharacter={handleCreateCharacterFromHub}
          onDeleteCharacter={handleDeleteCharacter}
          onAddCampaignNameOnly={(name) => {
            commitCampaignState((prev) => ({
              ...prev,
              nomesCampanha: syncCampaignCharacterNames([...prev.nomesCampanha, name], prev.fichas),
            }));
          }}
          onRemoveCampaignName={(name) => {
            commitCampaignState((prev) => ({
              ...prev,
              nomesCampanha: prev.nomesCampanha.filter((n) => n !== name),
            }));
          }}
          onEnterTabletop={() => setShowCampaignHub(false)}
          onBackToRooms={() => {
            setShowCampaignHub(false);
            setShowRoomsScreen(true);
          }}
          onImportCampaignJson={(importedState) => {
            commitCampaignState(() => importedState);
          }}
        />
      )}

      {/* TELA INICIAL DE SALAS (ESTILO OWLBEAR RODEO) */}
      {showRoomsScreen && (
        <OwlbearRoomsScreen
          rooms={owlbearRooms}
          maxGmRooms={2}
          firebaseUser={firebaseUser}
          authError={authError}
          onGoogleLogin={handleGoogleLogin}
          onGoogleLogout={handleGoogleLogout}
          onUpdateRooms={(nextRooms) => {
            setOwlbearRooms(nextRooms);
            saveOwlbearRooms(nextRooms);
          }}
          onOpenRoomHub={(room) => {
            const enforcedRole = resolveRoomRoleForEntry(room);
            handleChangeUserRole(enforcedRole);
            setSheetClaimError('');
            commitCampaignState((prev) => {
              let nextFichas = prev.fichas;
              if (enforcedRole === 'jogador') {
                const alreadyOwned = prev.fichas.find(
                  (f) => f.ocupadoPorSessionId === sessionId
                );
                const targetSheet =
                  alreadyOwned ||
                  prev.fichas.find(
                    (f) =>
                      !f.ehMestreOculto &&
                      (!f.ocupadoPorSessionId || f.ocupadoPorSessionId === sessionId)
                  );
                if (targetSheet) {
                  setActivePlayingSheetId(targetSheet.id);
                  const claimRes = claimCharacterSheetForPlayer(
                    prev.fichas,
                    targetSheet.id,
                    sessionId,
                    userName,
                    'jogador'
                  );
                  if (claimRes.claimed) {
                    nextFichas = claimRes.updatedSheets;
                  }
                }
              }
              return {
                ...prev,
                fichas: nextFichas,
                nomeCampanha: room.nome,
                codigoSala: room.codigo,
                capaCampanhaUrl: room.imagemMesaUrl || prev.capaCampanhaUrl,
              };
            });
            setShowRoomsScreen(false);
            setShowCampaignHub(true);
          }}
        />
      )}
    </div>
  );
}
