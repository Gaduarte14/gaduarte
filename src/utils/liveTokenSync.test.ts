import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canUserStartDraggingToken,
  shouldAcceptRemoteLivePacket,
  stepTokenInterpolation,
  type LiveTokenDragPacket,
} from './liveTokenSync.ts';

describe('Movimento de Token em Tempo Real (liveTokenSync)', () => {
  it('shouldAcceptRemoteLivePacket ignora eco do próprio usuário e descarta pacotes fora de ordem', () => {
    const basePacket: LiveTokenDragPacket = {
      tokenId: 'tok-elara',
      sceneId: 'scene-crypt',
      x: 8.5,
      y: 6.25,
      movedBy: 'user-other',
      moverName: 'Thorin',
      role: 'jogador',
      seq: 5,
      ts: 1000,
      active: true,
    };

    // Ignora eco quando movedBy === myMoverId
    assert.equal(
      shouldAcceptRemoteLivePacket(basePacket, 'user-other', null, null),
      false
    );

    // Ignora quando o próprio usuário já está arrastando o mesmo token
    assert.equal(
      shouldAcceptRemoteLivePacket(basePacket, 'user-me', 'tok-elara', null),
      false
    );

    // Aceita pacote válido mais novo de outro usuário
    assert.equal(
      shouldAcceptRemoteLivePacket(basePacket, 'user-me', null, {
        movedBy: 'user-other',
        seq: 4,
        ts: 950,
      }),
      true
    );

    // Descarta pacote atrasado/fora de ordem (seq <= último seq aceito)
    assert.equal(
      shouldAcceptRemoteLivePacket(
        { ...basePacket, seq: 3 },
        'user-me',
        null,
        { movedBy: 'user-other', seq: 4, ts: 950 }
      ),
      false
    );
  });

  it('canUserStartDraggingToken respeita permissões (Mestre vs Jogador) e bloqueia conflito simultâneo', () => {
    const monsterToken = {
      id: 'tok-goblin',
      bloqueado: false,
      ehFonteDeLuz: false,
      fichaId: 'char-krag',
    };

    // Jogador que controla Elara NÃO pode mover o Goblin
    const playerAttemptMonster = canUserStartDraggingToken(
      monsterToken,
      'player-1',
      'jogador',
      'char-elara',
      null,
      2000
    );
    assert.equal(playerAttemptMonster.allowed, false);

    // Mestre pode mover o Goblin
    const gmAttemptMonster = canUserStartDraggingToken(
      monsterToken,
      'gm-1',
      'mestre',
      'char-elara',
      null,
      2000
    );
    assert.equal(gmAttemptMonster.allowed, true);

    // Conflito: outro jogador já está arrastando o token há 500ms -> bloqueia segundo jogador
    const activeRemote: LiveTokenDragPacket = {
      tokenId: 'tok-elara',
      sceneId: 'scene-crypt',
      x: 5,
      y: 5,
      movedBy: 'player-1',
      moverName: 'Jogador 1',
      role: 'jogador',
      seq: 2,
      ts: 1800,
      active: true,
    };
    const conflictAttempt = canUserStartDraggingToken(
      { id: 'tok-elara', bloqueado: false, ehFonteDeLuz: false, fichaId: 'char-elara' },
      'player-2',
      'jogador',
      'char-elara',
      activeRemote,
      2000
    );
    assert.equal(conflictAttempt.allowed, false);
    assert.equal(conflictAttempt.lockedBy, 'Jogador 1');

    // Mestre tem prioridade e consegue mover mesmo se um jogador estiver segurando
    const gmOverride = canUserStartDraggingToken(
      { id: 'tok-elara', bloqueado: false, ehFonteDeLuz: false, fichaId: 'char-elara' },
      'gm-1',
      'mestre',
      null,
      activeRemote,
      2000
    );
    assert.equal(gmOverride.allowed, true);
  });

  it('stepTokenInterpolation aproxima suavemente até o alvo e encerra ao atingir epsilon', () => {
    let curr = { x: 2, y: 4, settled: false };
    for (let i = 0; i < 40 && !curr.settled; i++) {
      curr = stepTokenInterpolation(curr.x, curr.y, 6, 8, 0.35, 0.004);
    }
    assert.equal(curr.settled, true);
    assert.equal(curr.x, 6);
    assert.equal(curr.y, 8);
  });
});
