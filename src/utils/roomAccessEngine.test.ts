import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUserOpenCharacterSheet,
  canUserSelectCharacterSheet,
  claimCharacterSheetForPlayer,
  ensureUniqueGmRoomCodes,
  generateUniqueRoomCode,
  getVisibleSheetsForTabletopPlayer,
  releaseCharacterSheetLock,
  resolveRoomRoleForEntry,
} from './roomAccessEngine.ts';
import { DEFAULT_SHEETS } from '../data/initialCampaign.ts';

test('generateUniqueRoomCode never returns an existing room code', () => {
  const existing = ['OWL-AAAA', 'OWL-BBBB', 'OWL-5E26'];
  // Deterministic RNG that would try 'AAAA' on first 4 calls then 'CCCC'
  let callCount = 0;
  const fakeRng = () => {
    callCount++;
    return callCount <= 4 ? 0 : 0.08;
  };
  const code = generateUniqueRoomCode(existing, fakeRng);
  assert.notEqual(code, 'OWL-AAAA');
  assert.equal(existing.includes(code), false);
  assert.match(code, /^OWL-[A-Z0-9]{4,5}$/);
});

test('ensureUniqueGmRoomCodes deduplicates any colliding GM room codes', () => {
  const rooms = [
    { id: 'r1', codigo: 'OWL-5E26', papel: 'mestre' as const },
    { id: 'r2', codigo: 'OWL-5E26', papel: 'mestre' as const },
  ];
  const fixed = ensureUniqueGmRoomCodes(rooms);
  assert.equal(fixed[0].codigo, 'OWL-5E26');
  assert.notEqual(fixed[1].codigo, 'OWL-5E26');
});

test('resolveRoomRoleForEntry assigns mestre only to room creator and jogador to joined rooms', () => {
  assert.equal(resolveRoomRoleForEntry({ papel: 'mestre' }), 'mestre');
  assert.equal(resolveRoomRoleForEntry({ papel: 'jogador' }), 'jogador');
});

test('1-player-per-sheet lock prevents a second player from claiming an occupied sheet and releases previous sheet on switch', () => {
  const baseSheets = DEFAULT_SHEETS.map((s) => ({
    ...s,
    ocupadoPorSessionId: null,
    ocupadoPorNome: null,
  }));

  // Player 1 claims Elara
  const res1 = claimCharacterSheetForPlayer(
    baseSheets,
    'char-elara',
    'sess-player-1',
    'Lucas',
    'jogador'
  );
  assert.equal(res1.claimed, true);
  const elaraAfterP1 = res1.updatedSheets.find((s) => s.id === 'char-elara')!;
  assert.equal(elaraAfterP1.ocupadoPorSessionId, 'sess-player-1');
  assert.equal(elaraAfterP1.ocupadoPorNome, 'Lucas');

  // Player 2 tries to claim Elara -> MUST fail (only 1 player per sheet!)
  const res2 = claimCharacterSheetForPlayer(
    res1.updatedSheets,
    'char-elara',
    'sess-player-2',
    'Mariana',
    'jogador'
  );
  assert.equal(res2.claimed, false);
  assert.ok(res2.error?.includes('Lucas'));
  assert.equal(
    canUserSelectCharacterSheet(elaraAfterP1, 'jogador', 'sess-player-2'),
    false
  );

  // Player 1 switches to Thorin -> Elara is automatically released and Thorin is claimed
  const res3 = claimCharacterSheetForPlayer(
    res1.updatedSheets,
    'char-thorin',
    'sess-player-1',
    'Lucas',
    'jogador'
  );
  assert.equal(res3.claimed, true);
  assert.equal(
    res3.updatedSheets.find((s) => s.id === 'char-elara')?.ocupadoPorSessionId,
    null
  );
  assert.equal(
    res3.updatedSheets.find((s) => s.id === 'char-thorin')?.ocupadoPorSessionId,
    'sess-player-1'
  );

  // Mestre can release a lock
  const released = releaseCharacterSheetLock(res3.updatedSheets, 'char-thorin');
  assert.equal(
    released.find((s) => s.id === 'char-thorin')?.ocupadoPorSessionId,
    null
  );
});

test('canUserOpenCharacterSheet & getVisibleSheetsForTabletopPlayer restrict player to ONLY their selected sheet', () => {
  const claimRes = claimCharacterSheetForPlayer(
    DEFAULT_SHEETS,
    'char-elara',
    'sess-player-1',
    'Lucas',
    'jogador'
  );
  const sheets = claimRes.updatedSheets;
  const elara = sheets.find((s) => s.id === 'char-elara')!;
  const thorin = sheets.find((s) => s.id === 'char-thorin')!;
  const goblin = sheets.find((s) => s.id === 'char-goblin-chefe')!;

  // Player 1 selected Elara: can open ONLY Elara, cannot open Thorin or Goblin
  assert.equal(
    canUserOpenCharacterSheet(elara, 'jogador', 'char-elara', 'sess-player-1'),
    true
  );
  assert.equal(
    canUserOpenCharacterSheet(thorin, 'jogador', 'char-elara', 'sess-player-1'),
    false
  );
  assert.equal(
    canUserOpenCharacterSheet(goblin, 'jogador', 'char-elara', 'sess-player-1'),
    false
  );

  const visibleForPlayer1 = getVisibleSheetsForTabletopPlayer(
    sheets,
    'jogador',
    'char-elara',
    'sess-player-1'
  );
  assert.equal(visibleForPlayer1.length, 1);
  assert.equal(visibleForPlayer1[0].id, 'char-elara');

  // Mestre sees and can open all sheets
  const visibleForGm = getVisibleSheetsForTabletopPlayer(
    sheets,
    'mestre',
    'char-elara',
    'sess-gm'
  );
  assert.equal(visibleForGm.length, sheets.length);
});
