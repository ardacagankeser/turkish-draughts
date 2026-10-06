import { INITIAL_FEN } from './fen';
import { Game } from './game';
import { findMove, moveToNotation, moveToTudafNotation } from './notation';
import type { GameResult, Move } from './types';

/** PDN game type of Turkish draughts. */
export const PDN_GAME_TYPE = '30';

export interface PdnGame {
  /** Starting position; the standard one unless the PDN has a FEN tag. */
  readonly fen: string;
  /** Moves in landing notation. */
  readonly moves: readonly string[];
  readonly tags: Readonly<Record<string, string>>;
}

/** The PDN result token: 2-0, 0-2 and 1-1 as draughts scores a game, or * while it goes on. */
export function pdnResult(result: GameResult | null): string {
  if (!result) return '*';
  if (result.winner === null) return '1-1';
  return result.winner === 1 ? '2-0' : '0-2';
}

/**
 * Writes a game as PDN. Moves are in landing notation (`d4xd6xb6`), which names every
 * square the piece stops on and so is never ambiguous.
 */
export function toPdn(
  fen: string,
  moves: readonly string[],
  result: GameResult | null,
  tags: Readonly<Record<string, string>> = {},
): string {
  const resultToken = pdnResult(result);
  const all: Record<string, string> = {
    Event: 'Turkish draughts',
    ...tags,
    Result: resultToken,
    GameType: PDN_GAME_TYPE,
  };
  if (fen !== INITIAL_FEN) all.FEN = fen;
  const header = Object.entries(all)
    .map(([name, value]) => `[${name} "${value.replace(/["\\]/g, '\\$&')}"]`)
    .join('\n');

  // Numbered like a score sheet; a game starting with Black to move begins "1...".
  const blackFirst = new Game(fen).turn === -1;
  const tokens: string[] = [];
  moves.forEach((move, i) => {
    const ply = i + (blackFirst ? 1 : 0);
    const number = Math.floor(ply / 2) + 1;
    if (ply % 2 === 0) tokens.push(`${number}.`);
    else if (i === 0) tokens.push(`${number}...`);
    tokens.push(move);
  });
  tokens.push(resultToken);

  // Wrap the movetext at 80 columns, as PGN and PDN files usually are.
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    if (line && line.length + token.length + 1 > 80) {
      lines.push(line);
      line = token;
    } else line = line ? `${line} ${token}` : token;
  }
  if (line) lines.push(line);
  return `${header}\n\n${lines.join('\n')}\n`;
}

const RESULTS = new Set(['*', '2-0', '0-2', '1-1', '1-0', '0-1', '1/2-1/2']);

/** Finds a move written in landing notation, or in TÜDAF notation (captured squares). */
function readMove(game: Game, token: string): Move {
  try {
    return findMove(game.legalMoves, token);
  } catch (error) {
    const wanted = token.toLowerCase();
    const legal = game.legalMoves;
    const matches = legal.filter((move) => {
      const tudaf = moveToTudafNotation(move, legal);
      return tudaf === wanted || tudaf.split('→')[0] === wanted;
    });
    const [only] = matches;
    if (matches.length === 1 && only) return only;
    throw error;
  }
}

/**
 * Reads the first game of a PDN text: its tags and moves. Comments, variations, move
 * numbers, annotation marks and the result are skipped. Every move is checked against the
 * rules, so a bad move throws an error naming it.
 */
export function parsePdn(text: string): PdnGame {
  const tags: Record<string, string> = {};
  for (const [, name, value] of text.matchAll(/\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]/g)) {
    if (name !== undefined && value !== undefined) tags[name] = value.replace(/\\(.)/g, '$1');
  }
  let body = text.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ');
  // Variations may nest: remove the innermost ones until none are left.
  while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, ' ');

  const fen = tags.FEN ?? INITIAL_FEN;
  const game = new Game(fen);
  const moves: string[] = [];
  for (const raw of body.split(/\s+/)) {
    const token = raw.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
    if (!token || RESULTS.has(token) || /^\d+\.*$/.test(token)) continue;
    if (game.isOver) break;
    const move = readMove(game, token);
    moves.push(moveToNotation(game.play(move)));
  }
  return { fen, moves, tags };
}
