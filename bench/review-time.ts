/**
 * Times a full game review: plays a self-play game, then reviews it with the browser's
 * per-position budget. Usage: npx tsx bench/review-time.ts
 */
import { review, reviewTime } from '../src/ai/review';
import { Searcher } from '../src/ai/search';
import { Game, INITIAL_FEN, moveToNotation } from '../src/engine';

const player = new Searcher();
const game = new Game();
while (!game.isOver && game.history.length < 120) {
  const result = player.search(game, { timeMs: 60, randomMargin: 20 });
  if (!result.move) break;
  game.play(result.move);
}
const moves = game.history.map(moveToNotation);
const started = performance.now();
let positions = 0;
await review(
  new Searcher(),
  {
    id: 1,
    type: 'review',
    fen: INITIAL_FEN,
    moves,
    timeMs: reviewTime(moves.length + 1),
    maxDepth: 16,
  },
  (update) => {
    if (update.type === 'review-position') positions++;
  },
  () => true,
);
const seconds = (performance.now() - started) / 1000;
console.log(`${moves.length} moves, ${positions} positions reviewed in ${seconds.toFixed(1)} s`);
