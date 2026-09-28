/**
 * Generates the three-piece endgame tablebase by retrograde analysis:
 *
 *   npm run tablebase
 *
 * Writes public/tablebase/3pieces.bin.gz and prints statistics as Markdown.
 *
 * Each signature is solved by level-synchronous value iteration. Pass d finds the positions
 * won in exactly d plies (some move reaches a position lost in d − 1) and lost in exactly
 * d plies (every move reaches a position won by the opponent, the longest in d − 1).
 * Positions never resolved are draws: neither side can force a result.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { Piece } from '../src/engine';
import { BLACK, Board, WHITE, generateMoves } from '../src/engine';
import {
  DRAW,
  INVALID,
  SIGNATURES,
  TABLE_SIZE,
  decode,
  encodeLoss,
  encodeWin,
  locate,
} from '../src/ai/tablebase';

const OUTPUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/tablebase/3pieces.bin.gz',
);

const tables: Uint8Array[] = [];

function pieceOf(kind: 'K' | 'M', colour: 1 | -1): Piece {
  return (colour * (kind === 'K' ? 2 : 1)) as Piece;
}

function solve(signatureIndex: number): Uint8Array {
  const signature = SIGNATURES[signatureIndex];
  if (!signature) throw new Error('No such signature');
  const [kind0, kind1] = signature.white;
  const board = new Board();

  const valid: number[] = [];
  const offsets: number[] = [];
  const successors: number[] = [];
  // Per valid state (same order as `valid`):
  const externalLossMin: number[] = []; // shortest external successor lost for the opponent
  const externalWinMax: number[] = []; // longest external successor won by the opponent
  const externalBlocksLoss: boolean[] = []; // some external successor is not a win for the opponent
  const terminal: boolean[] = [];

  for (let w0 = 0; w0 < 64; w0++) {
    if (kind0 === 'M' && w0 >> 3 === 7) continue;
    for (let w1 = 0; w1 < 64; w1++) {
      if (w1 === w0 || (kind1 === 'M' && w1 >> 3 === 7)) continue;
      if (kind0 === kind1 && w1 < w0) continue; // canonical order for identical pieces
      for (let b = 0; b < 64; b++) {
        if (b === w0 || b === w1 || (signature.black === 'M' && b >> 3 === 0)) continue;
        for (const side of [0, 1] as const) {
          board.squares.fill(0);
          board.set(w0, pieceOf(kind0, WHITE));
          board.set(w1, pieceOf(kind1, WHITE));
          board.set(b, pieceOf(signature.black, BLACK));
          board.turn = side === 0 ? WHITE : BLACK;

          valid.push(((w0 * 64 + w1) * 64 + b) * 2 + side);
          offsets.push(successors.length);
          let lossMin = Infinity;
          let winMax = -1;
          let blocksLoss = false;

          const moves = generateMoves(board);
          terminal.push(moves.length === 0);
          for (const move of moves) {
            board.make(move);
            const white = board.count(WHITE);
            const black = board.count(BLACK);
            const toMove = board.turn === WHITE ? white : black;
            if (toMove === 0) {
              lossMin = Math.min(lossMin, 0); // the opponent has no pieces left
            } else if (white === 1 && black === 1) {
              blocksLoss = true; // one piece each: a draw
            } else {
              const located = locate(board);
              if (!located) throw new Error('Successor outside the tablebase');
              if (located.signature === signatureIndex) {
                successors.push(located.index);
              } else {
                const table = tables[located.signature];
                const outcome = table ? decode(table[located.index] ?? INVALID) : null;
                if (!outcome) throw new Error(`Signature ${located.signature} not solved yet`);
                if (outcome.result === 'loss') lossMin = Math.min(lossMin, outcome.plies);
                else if (outcome.result === 'win') winMax = Math.max(winMax, outcome.plies);
                else blocksLoss = true;
              }
            }
            board.unmake(move);
          }
          externalLossMin.push(lossMin);
          externalWinMax.push(winMax);
          externalBlocksLoss.push(blocksLoss || lossMin !== Infinity);
        }
      }
    }
  }
  offsets.push(successors.length);

  const table = new Uint8Array(TABLE_SIZE).fill(INVALID);
  // Pass at which each table index was resolved; -1 while unresolved.
  const resolvedAt = new Int16Array(TABLE_SIZE).fill(-1);
  const isWin = (index: number) => (table[index] ?? INVALID) < 128;
  const distance = (index: number) => {
    const byte = table[index] ?? 0;
    return byte < 128 ? byte : byte - 128;
  };

  let unresolved: number[] = [];
  valid.forEach((index, i) => {
    if (terminal[i]) {
      table[index] = encodeLoss(0);
      resolvedAt[index] = 0;
    } else unresolved.push(i);
  });

  let longestExternal = 0;
  for (let i = 0; i < valid.length; i++) {
    const loss = externalLossMin[i] ?? Infinity;
    longestExternal = Math.max(
      longestExternal,
      externalWinMax[i] ?? 0,
      Number.isFinite(loss) ? loss : 0,
    );
  }
  for (let pass = 1; unresolved.length > 0; pass++) {
    const found: [number, number][] = [];
    const still: number[] = [];
    for (const i of unresolved) {
      const index = valid[i] ?? 0;
      const start = offsets[i] ?? 0;
      const end = offsets[i + 1] ?? 0;

      let win = externalLossMin[i] === pass - 1;
      for (let s = start; !win && s < end; s++) {
        const next = successors[s] ?? 0;
        const at = resolvedAt[next] ?? -1;
        if (at >= 0 && at < pass && !isWin(next) && distance(next) === pass - 1) win = true;
      }
      if (win) {
        found.push([index, encodeWin(pass)]);
        continue;
      }

      if (!externalBlocksLoss[i]) {
        let allWon = true;
        let longest = externalWinMax[i] ?? -1;
        for (let s = start; s < end; s++) {
          const next = successors[s] ?? 0;
          const at = resolvedAt[next] ?? -1;
          if (at < 0 || at >= pass || !isWin(next)) {
            allWon = false;
            break;
          }
          longest = Math.max(longest, distance(next));
        }
        if (allWon && longest + 1 === pass) {
          found.push([index, encodeLoss(pass)]);
          continue;
        }
      }
      still.push(i);
    }
    for (const [index, byte] of found) {
      table[index] = byte;
      resolvedAt[index] = pass;
    }
    unresolved = still;
    if (found.length === 0 && pass > longestExternal + 1) break;
  }
  for (const i of unresolved) table[valid[i] ?? 0] = DRAW;
  return table;
}

function statistics(name: string, table: Uint8Array): string {
  const rows: string[] = [];
  for (const side of [0, 1] as const) {
    let win = 0;
    let draw = 0;
    let loss = 0;
    let longest = 0;
    for (let index = side; index < table.length; index += 2) {
      const outcome = decode(table[index] ?? INVALID);
      if (!outcome) continue;
      if (outcome.result === 'draw') draw++;
      else if (outcome.result === 'win') {
        win++;
        longest = Math.max(longest, outcome.plies);
      } else loss++;
    }
    const total = win + draw + loss;
    const pct = (n: number) => `${((100 * n) / total).toFixed(1)}%`;
    rows.push(
      `| ${name} | ${side === 0 ? 'White' : 'Black'} | ${total} | ${pct(win)} | ${pct(draw)} | ${pct(loss)} | ${longest} |`,
    );
  }
  return rows.join('\n');
}

const started = performance.now();
const report = [
  '| Signature | To move | Positions | Win | Draw | Loss | Longest win (plies) |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
SIGNATURES.forEach((signature, i) => {
  const table = solve(i);
  tables.push(table);
  report.push(statistics(signature.name, table));
  process.stderr.write(
    `${signature.name} solved (${((performance.now() - started) / 1000).toFixed(1)} s)\n`,
  );
});

const all = new Uint8Array(SIGNATURES.length * TABLE_SIZE);
tables.forEach((table, i) => {
  all.set(table, i * TABLE_SIZE);
});
const compressed = gzipSync(all, { level: 9 });
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, compressed);
console.log(report.join('\n'));
console.log(`\n${compressed.length} bytes compressed (${all.length} raw)`);
