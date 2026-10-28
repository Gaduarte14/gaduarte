import type { MapToken } from '../types/vtt.ts';

/** Intervalo de envio ao vivo durante o arrasto (entre 30ms e 60ms -> ~22 envios/seg) */
export const LIVE_SEND_THROTTLE_MS = 45;

/** Tempo máximo para expirar automaticamente um arrasto remoto caso a aba caia antes do onDisconnect */
export const STALE_DRAG_TIMEOUT_MS = 4000;

/** Pacote mínimo (~150 bytes) enviado em tempo real enquanto o token é arrastado */
export interface LiveTokenDragPacket {
  tokenId: string;
  sceneId: string;
  x: number;
  y: number;
  movedBy: string;
  moverName: string;
  role: 'mestre' | 'jogador';
  seq: number;
  ts: number;
  active: boolean;
}

export interface AcceptedPacketMeta {
  movedBy: string;
  seq: number;
  ts: number;
}

/**
 * Filtra pacotes recebidos no canal ao vivo:
 * 1. Ignora eco (pacotes enviados pelo próprio usuário ou do token que o próprio usuário está arrastando).
 * 2. Descarta pacotes antigos ou fora de ordem (seq <= último seq aceito do mesmo remetente, ou timestamp mais antigo).
 */
export function shouldAcceptRemoteLivePacket(
  incoming: LiveTokenDragPacket,
  myMoverId: string,
  myDraggingTokenId: string | null,
  lastAccepted?: AcceptedPacketMeta | null
): boolean {
  if (!incoming || !incoming.tokenId || typeof incoming.x !== 'number' || typeof incoming.y !== 'number') {
    return false;
  }

  // 1. Ignorar eco do próprio usuário
  if (incoming.movedBy === myMoverId) {
    return false;
  }

  // Se o próprio usuário já está arrastando este token localmente, não deixar o pacote remoto "brigar" com o mouse
  if (myDraggingTokenId && incoming.tokenId === myDraggingTokenId) {
    return false;
  }

  // 2. Descartar pacotes fora de ordem ou atrasados
  if (lastAccepted) {
    if (incoming.movedBy === lastAccepted.movedBy) {
      if (incoming.seq <= lastAccepted.seq) {
        return false;
      }
    } else if (incoming.ts < lastAccepted.ts) {
      return false;
    }
  }

  return true;
}

/**
 * Verifica se o usuário pode iniciar o arrasto de um token, respeitando:
 * - Permissões da mesa (só o Mestre move monstros/NPCs; jogador só move o token da própria ficha ou luz).
 * - Conflito de arrasto simultâneo: se outro usuário já está arrastando o mesmo token (há menos de 4s),
 *   vence quem começou primeiro (exceto o Mestre, que tem prioridade sobre jogadores).
 */
export function canUserStartDraggingToken(
  token: Pick<MapToken, 'id' | 'bloqueado' | 'ehFonteDeLuz' | 'fichaId'>,
  myMoverId: string,
  myRole: 'mestre' | 'jogador',
  activePlayingSheetId: string | null | undefined,
  activeRemoteDrag: LiveTokenDragPacket | null | undefined,
  nowMs: number = Date.now()
): { allowed: boolean; reason?: string; lockedBy?: string } {
  if (token.bloqueado) {
    return { allowed: false, reason: 'Token bloqueado no mapa.' };
  }

  const hasRolePermission =
    myRole === 'mestre' ||
    Boolean(token.ehFonteDeLuz) ||
    Boolean(activePlayingSheetId && token.fichaId === activePlayingSheetId);

  if (!hasRolePermission) {
    return {
      allowed: false,
      reason: 'Apenas o Mestre ou o dono desta ficha pode mover este token.',
    };
  }

  // Verifica conflito de arrasto ao vivo por outro usuário
  if (
    activeRemoteDrag &&
    activeRemoteDrag.active &&
    activeRemoteDrag.movedBy !== myMoverId &&
    nowMs - activeRemoteDrag.ts < STALE_DRAG_TIMEOUT_MS
  ) {
    // O Mestre pode assumir prioridade sobre um jogador se necessário; caso contrário, vence quem começou primeiro
    if (myRole === 'mestre' && activeRemoteDrag.role !== 'mestre') {
      return { allowed: true };
    }
    return {
      allowed: false,
      lockedBy: activeRemoteDrag.moverName || 'Outro jogador',
      reason: `Sendo movido por ${activeRemoteDrag.moverName || 'outro jogador'}`,
    };
  }

  return { allowed: true };
}

/**
 * Calcula um passo de interpolação suave (lerp) para animar o token remoto a 60 FPS
 * sem "pular" entre os pacotes de rede recebidos a cada ~45ms.
 */
export function stepTokenInterpolation(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  alpha: number = 0.32,
  snapEpsilon: number = 0.004
): { x: number; y: number; settled: boolean } {
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const dist = Math.hypot(dx, dy);

  if (dist <= snapEpsilon) {
    return { x: targetX, y: targetY, settled: true };
  }

  const clampedAlpha = Math.max(0.05, Math.min(1, alpha));
  return {
    x: currentX + dx * clampedAlpha,
    y: currentY + dy * clampedAlpha,
    settled: false,
  };
}
