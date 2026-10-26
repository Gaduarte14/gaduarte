import type { CharacterSheet } from '../types/vtt.ts';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a guaranteed-unique room code in format `OWL-XXXX` (never equal to any code in `existingCodes`).
 */
export function generateUniqueRoomCode(
  existingCodes: string[] = [],
  rng: () => number = Math.random
): string {
  const normalizedSet = new Set(
    existingCodes
      .filter((c) => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim().toUpperCase())
  );

  for (let attempt = 0; attempt < 500; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(rng() * ROOM_CODE_ALPHABET.length) % ROOM_CODE_ALPHABET.length;
      suffix += ROOM_CODE_ALPHABET[Math.max(0, idx)];
    }
    const candidate = `OWL-${suffix}`;
    if (!normalizedSet.has(candidate)) {
      return candidate;
    }
  }

  // Fallback with 5 characters if 500 attempts collided
  let fallbackSuffix = '';
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(rng() * ROOM_CODE_ALPHABET.length) % ROOM_CODE_ALPHABET.length;
    fallbackSuffix += ROOM_CODE_ALPHABET[Math.max(0, idx)];
  }
  return `OWL-${fallbackSuffix}`;
}

/**
 * Ensures every created GM room in a list has a distinct room code (never duplicate codes across created rooms).
 */
export function ensureUniqueGmRoomCodes<
  T extends { id: string; codigo: string; papel: 'mestre' | 'jogador' },
>(rooms: T[], rng: () => number = Math.random): T[] {
  const usedGmCodes = new Set<string>();
  return rooms.map((room) => {
    if (room.papel !== 'mestre') {
      return room;
    }
    const normalized = (room.codigo || '').trim().toUpperCase();
    if (normalized && !usedGmCodes.has(normalized)) {
      usedGmCodes.add(normalized);
      return { ...room, codigo: normalized };
    }
    const freshCode = generateUniqueRoomCode(Array.from(usedGmCodes), rng);
    usedGmCodes.add(freshCode);
    return { ...room, codigo: freshCode };
  });
}

/**
 * Determines the fixed role when entering a room:
 * - Only the creator of the room (`papel === 'mestre'`) enters as `'mestre'`.
 * - Anyone joining via code (`papel === 'jogador'`) enters as `'jogador'`.
 */
export function resolveRoomRoleForEntry(room: {
  papel: 'mestre' | 'jogador';
}): 'mestre' | 'jogador' {
  return room.papel === 'mestre' ? 'mestre' : 'jogador';
}

/**
 * Returns true if the character sheet is currently claimed/occupied by a DIFFERENT player session.
 */
export function isSheetOccupiedByAnotherPlayer(
  sheet: Pick<CharacterSheet, 'ocupadoPorSessionId'>,
  viewerSessionId: string
): boolean {
  if (!sheet.ocupadoPorSessionId) return false;
  return sheet.ocupadoPorSessionId !== viewerSessionId;
}

/**
 * Returns true if the character sheet is currently claimed by this exact player session.
 */
export function isSheetOccupiedByViewer(
  sheet: Pick<CharacterSheet, 'ocupadoPorSessionId'>,
  viewerSessionId: string
): boolean {
  if (!sheet.ocupadoPorSessionId || !viewerSessionId) return false;
  return sheet.ocupadoPorSessionId === viewerSessionId;
}

/**
 * Checks whether a user can select/claim a given character sheet in "Fichas de Personagens Salvas".
 * - Mestre can select any sheet.
 * - Jogador can only select non-hidden (`!ehMestreOculto`) sheets that are NOT occupied by another player (`1 jogador por ficha`).
 */
export function canUserSelectCharacterSheet(
  sheet: CharacterSheet,
  userRole: 'mestre' | 'jogador',
  viewerSessionId: string
): boolean {
  if (userRole === 'mestre') return true;
  if (sheet.ehMestreOculto) return false;
  return !isSheetOccupiedByAnotherPlayer(sheet, viewerSessionId);
}

/**
 * Enforces the 1-player-per-sheet rule when a player selects a character sheet in "Fichas de Personagens Salvas":
 * - Rejects if the sheet is hidden (`ehMestreOculto`) or already occupied by another player (`ocupadoPorSessionId !== playerSessionId`).
 * - Automatically releases any other sheet previously claimed by `playerSessionId` so 1 player = 1 sheet and 1 sheet = 1 player.
 */
export function claimCharacterSheetForPlayer(
  sheets: CharacterSheet[],
  targetSheetId: string,
  playerSessionId: string,
  playerName: string,
  userRole: 'mestre' | 'jogador'
): { updatedSheets: CharacterSheet[]; claimed: boolean; error?: string } {
  const target = sheets.find((s) => s.id === targetSheetId);
  if (!target) {
    return {
      updatedSheets: sheets,
      claimed: false,
      error: 'Ficha não encontrada.',
    };
  }

  if (userRole === 'mestre') {
    return {
      updatedSheets: sheets,
      claimed: true,
    };
  }

  if (target.ehMestreOculto) {
    return {
      updatedSheets: sheets,
      claimed: false,
      error: 'Esta ficha pertence exclusivamente ao Mestre.',
    };
  }

  if (isSheetOccupiedByAnotherPlayer(target, playerSessionId)) {
    return {
      updatedSheets: sheets,
      claimed: false,
      error: `Esta ficha já está sendo usada por ${target.ocupadoPorNome || 'outro jogador'} (máximo de 1 jogador por ficha).`,
    };
  }

  const cleanPlayerName = playerName.replace(/\s*\(you\)\s*/i, '').trim() || 'Jogador';

  const updatedSheets = sheets.map((s) => {
    if (s.id === targetSheetId) {
      return {
        ...s,
        ocupadoPorSessionId: playerSessionId,
        ocupadoPorNome: cleanPlayerName,
        nomeJogador: cleanPlayerName,
      };
    }
    // Release any previous sheet held by this same player session
    if (s.ocupadoPorSessionId === playerSessionId) {
      return {
        ...s,
        ocupadoPorSessionId: null,
        ocupadoPorNome: null,
      };
    }
    return s;
  });

  return {
    updatedSheets,
    claimed: true,
  };
}

/**
 * Releases the 1-player lock on a character sheet (used by the Mestre or when resetting).
 */
export function releaseCharacterSheetLock(
  sheets: CharacterSheet[],
  sheetId: string
): CharacterSheet[] {
  return sheets.map((s) =>
    s.id === sheetId
      ? {
          ...s,
          ocupadoPorSessionId: null,
          ocupadoPorNome: null,
        }
      : s
  );
}

/**
 * Determines whether the current user is allowed to open/inspect the full D&D 5e sheet of a character:
 * - Mestre (`userRole === 'mestre'`) can open any sheet.
 * - Jogador (`userRole === 'jogador'`) can ONLY open the single character sheet that they selected
 *   (`sheet.id === activePlayingSheetId`) and that is not occupied by another player!
 */
export function canUserOpenCharacterSheet(
  sheet: CharacterSheet | undefined | null,
  userRole: 'mestre' | 'jogador',
  activePlayingSheetId: string | null | undefined,
  viewerSessionId: string
): boolean {
  if (!sheet) return false;
  if (userRole === 'mestre') return true;
  if (sheet.ehMestreOculto) return false;
  if (isSheetOccupiedByAnotherPlayer(sheet, viewerSessionId)) return false;
  return Boolean(activePlayingSheetId && sheet.id === activePlayingSheetId);
}

/**
 * Filters the list of character sheets visible inside the Tabletop (left panel & right sidebar Fichas tab):
 * - Mestre sees all sheets.
 * - Jogador ONLY sees the single character sheet that they selected in "Fichas de Personagens Salvas".
 */
export function getVisibleSheetsForTabletopPlayer(
  sheets: CharacterSheet[],
  userRole: 'mestre' | 'jogador',
  activePlayingSheetId: string | null | undefined,
  viewerSessionId: string
): CharacterSheet[] {
  if (userRole === 'mestre') return sheets;
  return sheets.filter((s) =>
    canUserOpenCharacterSheet(s, userRole, activePlayingSheetId, viewerSessionId)
  );
}
