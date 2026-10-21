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
} from 'lucide-react';
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
  MediaAsset,
  MusicFolder,
  MusicTrack,
} from './types/vtt.ts';
import {
  evaluateDiceExpression,
  interpolateSheetVariables,
  rollTableInitiativeForTokens,
  syncCampaignCharacterNames,
} from './utils/dndRules.ts';
import { rollInput, type ParsedRollGroup } from './utils/engine.ts';
import {
  runLine,
  type DamageHistoryEntry,
  type SheetHpAdapter,
} from './utils/dano.ts';
import { TacticalMapCanvas, type ActiveMapTool } from './components/TacticalMapCanvas.tsx';
import { BottomOwlbearDock } from './components/BottomOwlbearDock.tsx';
import { RightQuestPortalSidebar } from './components/RightQuestPortalSidebar.tsx';
import { CharacterSheetDrawer } from './components/CharacterSheetDrawer.tsx';
import { CampaignHubModal } from './components/CampaignHubModal.tsx';
import { PersistentAudioEngine } from './components/PersistentAudioEngine.tsx';

const LOCAL_STORAGE_KEY = 'owlbear_quest_vtt_state_v1';
const SESSION_ID_KEY = 'owlbear_quest_session_id_v1';
const GM_LOCK_STORAGE_KEY = 'owlbear_quest_gm_lock_v1';

function getOrCreateClientSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const created = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_ID_KEY, created);
    return created;
  } catch {
    return `sess-${Date.now()}`;
  }
}

export default function App() {
  const [sessionId] = useState<string>(() => getOrCreateClientSessionId());

  // Load initial campaign state from localStorage or fallback to deterministic seed data
  const [campaign, setCampaign] = useState<CampaignState>(() => {
    let activeGmSessionId: string | null = null;
    let activeGmName: string | null = null;
    try {
      const gmLockRaw = localStorage.getItem(GM_LOCK_STORAGE_KEY);
      if (gmLockRaw) {
        const parsedLock = JSON.parse(gmLockRaw);
        if (parsedLock?.mestreSessionId) {
          activeGmSessionId = parsedLock.mestreSessionId;
          activeGmName = parsedLock.mestreNome || 'Mestre (GM)';
        }
      }
    } catch {
      // ignore
    }

    const params = new URLSearchParams(window.location.search);
    const wantsPlayerRole = params.get('role') === 'jogador';

    if (!activeGmSessionId && !wantsPlayerRole) {
      activeGmSessionId = getOrCreateClientSessionId();
      activeGmName = 'Phap La (you)';
      try {
        localStorage.setItem(
          GM_LOCK_STORAGE_KEY,
          JSON.stringify({ mestreSessionId: activeGmSessionId, mestreNome: activeGmName })
        );
      } catch {
        // ignore
      }
    }

    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.cenas) && Array.isArray(parsed.fichas)) {
          return {
            ...parsed,
            mestreSessionId: activeGmSessionId,
            mestreNome: activeGmName,
            logsCombate: INITIAL_CAMPAIGN_STATE.logsCombate,
          };
        }
      }
    } catch {
      // ignore storage errors
    }
    return {
      ...INITIAL_CAMPAIGN_STATE,
      mestreSessionId: activeGmSessionId,
      mestreNome: activeGmName,
    };
  });

  // UI Navigation States: Start on Initial Campaign Hub unless ?autostart=1 or ?tabletop=1 is set
  const [showCampaignHub, setShowCampaignHub] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || params.get('tabletop') === '1') return false;
    return true;
  });

  const [activeSheetModalId, setActiveSheetModalId] = useState<string | null>(null);
  const [activePlayingSheetId, setActivePlayingSheetId] = useState<string>(
    INITIAL_CAMPAIGN_STATE.fichas[0]?.id || 'char-elara'
  );
  const [damageHistory, setDamageHistory] = useState<DamageHistoryEntry[]>([]);

  // Single-GM Enforcement: Only 1 Mestre allowed in the room!
  const isGmSlotTakenByAnother = Boolean(
    campaign.mestreSessionId && campaign.mestreSessionId !== sessionId
  );

  const [userRole, setUserRoleState] = useState<'mestre' | 'jogador'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'jogador') return 'jogador';
    if (campaign.mestreSessionId && campaign.mestreSessionId !== sessionId) {
      return 'jogador';
    }
    return 'mestre';
  });

  const [userName, setUserName] = useState<string>('Phap La (you)');

  // Enforce automatic demotion to 'jogador' if another session holds the single GM lock
  useEffect(() => {
    if (campaign.mestreSessionId && campaign.mestreSessionId !== sessionId && userRole === 'mestre') {
      setUserRoleState('jogador');
    }
  }, [campaign.mestreSessionId, sessionId, userRole]);

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
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'iniciativa' | 'musica' | 'fichas'>('chat');

  // Undo/Redo Drawing Stack
  const [redoDrawings, setRedoDrawings] = useState<MapDrawing[]>([]);

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

  // Single-GM Role Change Handler (Blocks claiming GM if another user already holds GM in the room)
  const handleChangeUserRole = (targetRole: 'mestre' | 'jogador') => {
    if (targetRole === 'mestre') {
      if (campaign.mestreSessionId && campaign.mestreSessionId !== sessionId) {
        return;
      }
      setUserRoleState('mestre');
      try {
        localStorage.setItem(
          GM_LOCK_STORAGE_KEY,
          JSON.stringify({ mestreSessionId: sessionId, mestreNome: userName })
        );
      } catch {
        // ignore
      }
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
      if (bcRef.current) {
        bcRef.current.postMessage({
          type: 'gm:lock_update',
          payload: { mestreSessionId: sessionId, mestreNome: userName },
        });
      }
    } else {
      setUserRoleState('jogador');
      if (campaign.mestreSessionId === sessionId) {
        try {
          localStorage.removeItem(GM_LOCK_STORAGE_KEY);
        } catch {
          // ignore
        }
        setCampaign((prev) => ({
          ...prev,
          mestreSessionId: null,
          mestreNome: null,
        }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ type: 'gm:release', payload: { sessionId } })
          );
        }
        if (bcRef.current) {
          bcRef.current.postMessage({
            type: 'gm:lock_update',
            payload: { mestreSessionId: null, mestreNome: null },
          });
        }
      }
    }
  };

  // Sync state to localStorage (excluding transient roll logs per Section 7) + BroadcastChannel + WebSocket
  const commitCampaignState = (updater: (prev: CampaignState) => CampaignState) => {
    setCampaign((prev) => {
      const next = updater(prev);
      next.nomesCampanha = syncCampaignCharacterNames(next.nomesCampanha || [], next.fichas || []);
      try {
        const persistedCopy = { ...next, logsCombate: [] };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(persistedCopy));
      } catch {
        // ignore quota errors
      }
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
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === GM_LOCK_STORAGE_KEY) {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          setCampaign((prev) => ({
            ...prev,
            mestreSessionId: parsed?.mestreSessionId || null,
            mestreNome: parsed?.mestreNome || null,
          }));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('owlbear_quest_vtt_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'campaign:state' && ev.data.payload) {
          isRemoteUpdateRef.current = true;
          setCampaign(ev.data.payload);
          isRemoteUpdateRef.current = false;
        } else if (ev.data?.type === 'gm:lock_update' && ev.data.payload) {
          setCampaign((prev) => ({
            ...prev,
            mestreSessionId: ev.data.payload.mestreSessionId,
            mestreNome: ev.data.payload.mestreNome,
          }));
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
              setCampaign((prev) => ({
                ...msg.payload,
                mestreSessionId: msg.payload.mestreSessionId ?? prev.mestreSessionId,
                mestreNome: msg.payload.mestreNome ?? prev.mestreNome,
              }));
              isRemoteUpdateRef.current = false;
            }
          } else if (msg.type === 'gm:lock_update' && msg.payload) {
            setCampaign((prev) => ({
              ...prev,
              mestreSessionId: msg.payload.mestreSessionId,
              mestreNome: msg.payload.mestreNome,
            }));
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
      window.removeEventListener('storage', handleStorageEvent);
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
                tokens: c.tokens.map((t) => (t.id === tokenId ? { ...t, x: newX, y: newY } : t)),
              }
            : c
        ),
      };
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({ ...next, logsCombate: [] })
        );
      } catch {
        // ignore
      }
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
    commitCampaignState((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) =>
        c.id === activeScene.id
          ? {
               ...c,
              tokens: c.tokens.map((t) => (t.id === updatedToken.id ? updatedToken : t)),
            }
          : c
      ),
      fichas: prev.fichas.map((f) =>
        f.id === updatedToken.fichaId
          ? {
              ...f,
              nomePersonagem: updatedToken.nome || f.nomePersonagem,
              pvAtual: updatedToken.pvAtual ?? f.pvAtual,
              visaoAlcanceQuadrados: updatedToken.visaoQuadrados,
              luzAlcanceQuadrados: updatedToken.luzQuadrados,
            }
          : f
      ),
    }));
  };

  const handleDeleteToken = (tokenId: string) => {
    if (userRole !== 'mestre') return;
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

  const handleCreateCharacterFromHub = (newSheet: CharacterSheet, spawnToken: boolean) => {
    const newToken: MapToken | null =
      spawnToken && userRole === 'mestre'
        ? {
            id: `tok-${Date.now()}`,
            nome: newSheet.nomePersonagem,
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

    commitCampaignState((prev) => ({
      ...prev,
      fichas: [newSheet, ...prev.fichas],
      assets: [newAsset, ...prev.assets],
      nomesCampanha: syncCampaignCharacterNames(
        [...prev.nomesCampanha, newSheet.nomePersonagem],
        [newSheet, ...prev.fichas]
      ),
      cenas: newToken
        ? prev.cenas.map((c) =>
            c.id === prev.cenaAtivaId ? { ...c, tokens: [...c.tokens, newToken] } : c
          )
        : prev.cenas,
    }));

    setActivePlayingSheetId(newSheet.id);
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
        onOpenSheet={(sheetId) => setActiveSheetModalId(sheetId)}
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

          <button
            type="button"
            onClick={() => setShowCampaignHub(true)}
            title="Gerenciar Perfil e Papel (Mestre / Jogador)"
            className="p-1.5 rounded-xl text-violet-300 hover:bg-zinc-700/60 transition-colors cursor-pointer"
          >
            <User className="w-4 h-4" />
          </button>

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
            onClick={() => setActiveSheetModalId(activePlayingSheetId)}
            aria-label="Abrir Ficha D&D 5e"
            title="Abrir Ficha D&D 5e Completa"
            className="p-1.5 rounded-xl text-zinc-300 hover:bg-zinc-700/60 hover:text-white transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4" />
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
        </div>

        {/* Owlbear "Players" Card + Single-GM Lock Status + Exclusive Player Fog Selector */}
        <div
          className={`w-64 bg-[#232530]/95 border border-zinc-700/80 rounded-2xl p-3.5 shadow-2xl pointer-events-auto ${
            sidebarOpen ? 'hidden md:block' : 'block'
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-700/80">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">Players</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                1 GM Max
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCampaignHub(true)}
              aria-label="Criar ou adicionar personagem à campanha"
              title="Abrir Tela Inicial da Campanha"
              className="p-1 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700/60 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between py-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full bg-[#4ade80] shrink-0" />
              <span className="text-xs font-medium text-zinc-100 truncate">{userName}</span>
            </div>

            {userRole === 'mestre' ? (
              <button
                type="button"
                onClick={() => handleChangeUserRole('jogador')}
                data-testid="toggle-role-btn"
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer transition-colors bg-violet-600/30 text-violet-300 border border-violet-500/40 hover:bg-violet-600/50 shrink-0"
                title="Você é o único Mestre da sala (1/1). Clique se quiser liberar a vaga de Mestre e virar Jogador."
              >
                Mestre (1/1)
              </button>
            ) : isGmSlotTakenByAnother ? (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1 shrink-0 cursor-not-allowed"
                title={`A sala já possui 1 Mestre ativo (${campaign.mestreNome || 'GM'}). Apenas 1 Mestre é permitido.`}
              >
                <Lock className="w-2.5 h-2.5 text-amber-400" /> Player (GM 1/1)
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleChangeUserRole('mestre')}
                data-testid="toggle-role-btn"
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer transition-colors bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-violet-600/40 shrink-0"
                title="Vaga de Mestre livre (0/1). Clique para assumir como Mestre da sala."
              >
                Assumir GM (0/1)
              </button>
            )}
          </div>

          {/* Per-Player Exclusive Fog of War Vision Indicator & Character Selector */}
          <div className="mt-2 pt-2 border-t border-zinc-800/80 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span className="font-semibold uppercase tracking-wider">
                {userRole === 'mestre' ? 'Visão: Mestre (Vê Tudo)' : 'Visão Exclusiva do Token:'}
              </span>
            </div>
            <select
              aria-label="Selecionar Meu Personagem para Visão na Névoa"
              data-testid="player-fog-sheet-select"
              value={activePlayingSheetId}
              onChange={(e) => {
                const nextId = e.target.value;
                setActivePlayingSheetId(nextId);
                const ownTok = activeScene.tokens.find((t) => t.fichaId === nextId);
                if (ownTok) {
                  setSelectedTokenId(ownTok.id);
                }
              }}
              className="w-full bg-[#181922] border border-zinc-700/80 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
            >
              {campaign.fichas
                .filter((f) => !f.ehMestreOculto || userRole === 'mestre')
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nomePersonagem} ({f.classeNivel})
                  </option>
                ))}
            </select>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-zinc-800 space-y-1.5">
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
                      if (ficha) setActiveSheetModalId(ficha.id);
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
          </div>
        </div>
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
            onClick={() => {
              if (selectedTokenId) {
                const tok = activeScene.tokens.find((t) => t.id === selectedTokenId);
                if (tok) {
                  handleUpdateToken({
                    ...tok,
                    luzQuadrados: tok.luzQuadrados > 0 ? 0 : 4,
                  });
                }
              }
            }}
            aria-label="Alternar Luz / Tocha no Token Selecionado"
            title="Adicionar/Alternar Luz (Tocha 20ft) no Personagem Selecionado"
            className="p-2 rounded-xl text-amber-400 hover:bg-zinc-700/60 transition-colors cursor-pointer"
          >
            <Flame className="w-4 h-4" />
          </button>

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
          onOpenSheetById={(sheetId) => setActiveSheetModalId(sheetId)}
        />
      )}

      {/* RIGHT QUEST PORTAL SIDEBAR */}
      {sidebarOpen && (
        <RightQuestPortalSidebar
          activeTab={sidebarTab}
          onChangeTab={setSidebarTab}
          logs={campaign.logsCombate}
          damageHistory={damageHistory}
          sheets={campaign.fichas}
          activeSheetId={activePlayingSheetId}
          onSelectActiveSheet={setActivePlayingSheetId}
          onOpenFullSheet={(sheetId) => setActiveSheetModalId(sheetId)}
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
      {showCampaignHub && (
        <CampaignHubModal
          campaign={campaign}
          activeSheetId={activePlayingSheetId}
          userRole={userRole}
          userName={userName}
          isGmSlotTakenByAnother={isGmSlotTakenByAnother}
          currentGmName={campaign.mestreNome}
          onChangeRole={handleChangeUserRole}
          onChangeUserName={setUserName}
          onUpdateCampaignMeta={(nomeCampanha, capaCampanhaUrl) => {
            commitCampaignState((prev) => ({
              ...prev,
              nomeCampanha,
              capaCampanhaUrl: capaCampanhaUrl ?? prev.capaCampanhaUrl,
            }));
          }}
          onSelectSheet={(sheetId) => setActivePlayingSheetId(sheetId)}
          onOpenFullSheet={(sheetId) => {
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
          onImportCampaignJson={(importedState) => {
            commitCampaignState(() => importedState);
          }}
        />
      )}
    </div>
  );
}
