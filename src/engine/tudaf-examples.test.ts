/**
 * The ten worked examples from the Turkish Draughts Federation (TÜDAF) rules,
 * "Türk Daması Kuralları" by Atila Zeybek, transcribed square by square:
 * https://turkdamasi.org.tr/wp-content/uploads/2022/11/Turk_Damasi_Kurallari_Tudaf_v3.pdf
 */
import { describe, expect, it } from 'vitest';
import { Game, moveToNotation, parseSquare, squareName } from '.';

const notations = (game: Game): string[] => game.legalMoves.map(moveToNotation).sort();
const capturedNames = (game: Game): string[][] =>
  game.legalMoves.map((move) => move.captures.map(squareName).sort());

// White's men in examples 1 and 2.
const WHITE_1_2 = 'a4,h4,a3,b3,c3,d3,e3,f3,g3,h3,a2,c2,d2,f2';
// White's pieces in examples 8, 9 and 10.
const WHITE_8_10 = 'e5,a4,c4,a3,b3,c3,d3,e3,g3,a2,b2,c2,d2,e2,f2,Kh1';

describe('TÜDAF rule examples', () => {
  it('Example 1: the longest chain is mandatory (4 captures, not 2)', () => {
    const game = new Game(`W:W${WHITE_1_2}:Bc7,h7,a6,b6,c6,d6,e6,g6,h6,a5,b5,c5,e5,g5,f4`);
    expect(notations(game)).toEqual(['f3xf5xd5xd7xb7']);
  });

  it('Example 2: the longest chain is mandatory (6 captures, not 5)', () => {
    const game = new Game(`W:W${WHITE_1_2}:Bc7,e7,g7,a6,b6,c6,d6,e6,g6,h6,a5,b5,c5,e5,g5,f4`);
    expect(notations(game)).toEqual(['f3xf5xh5xh7xf7xd7xb7']);
  });

  it('Example 3: a king zig-zags ("L" moves) through 8 captures, crossing freed squares', () => {
    const game = new Game('B:Wc5,a4,g4,a3,b3,c3,f3,h3,b2,e2,g2:BKc8,a7,d7,e7,f7,g7,e6,f6,g6,e5');
    const moves = game.legalMoves;
    // Both orders in the rules capture the same pieces and end on a2: one legal move.
    expect(moves).toHaveLength(1);
    expect(moves[0]?.to).toBe(parseSquare('a2'));
    expect(capturedNames(game)).toEqual([['b2', 'c3', 'c5', 'e2', 'f3', 'g2', 'g4', 'h3']]);
    expect(['c8xc4xc2xf2xh2xh4xf4xf2xa2', 'c8xc4xc2xf2xf4xh4xh2xf2xa2']).toContain(
      notations(game)[0],
    );
  });

  it('Example 4: a king may not turn back 180° to continue capturing', () => {
    const game = new Game(
      'B:Wc5,a4,f4,g4,h4,a3,b3,c3,f3,h3,b2,e2,g2:BKc8,a7,d7,e7,f7,g7,e6,f6,g6,f5',
    );
    // Turning back from h2 along rank 2 would capture b2 as well (5 pieces).
    expect(notations(game)).toEqual(['c8xc4xc2xf2xh2']);
  });

  it('Example 5: a man promoting by capture stops if it cannot continue as a man', () => {
    const game = new Game('W:We4,a3,b3,e3,f3,h3,d2,e2,g2:BKc8,a7,d7,e7,f7,g7,f6,g6,e5');
    expect(notations(game)).toEqual(['e4xe6xe8']);
    game.play('e4xe6xe8');
    expect(game.board.get(parseSquare('e8'))).toBe(2);
    expect(game.turn).toBe(-1);
  });

  it('Example 6: a man promoting without capture cannot capture the adjacent king', () => {
    const game = new Game(
      'W:Wf7,a4,c4,a3,b3,c3,d3,e3,g3,a2,b2,d2,f2,g2:BKe8,a7,b7,c7,d7,a6,b6,c6,d6,h6,a5,c5',
    );
    expect(game.legalMoves.every((move) => move.captures.length === 0)).toBe(true);
    game.play('f7-f8');
    expect(game.turn).toBe(-1);
    // Black's king must take the two men on e3 and d2 rather than the new king on f8.
    expect(notations(game)).toEqual(['e8xe2xc2']);
  });

  it('Example 7: a man reaching the far rank by capture keeps capturing sideways', () => {
    const game = new Game(
      'W:Wf6,a4,c4,a3,b3,c3,d3,g3,a2,b2,d2,f2,g2:BKe8,a7,b7,c7,d7,f7,a6,b6,c6,d6,h6,a5,c5',
    );
    expect(notations(game)).toEqual(['f6xf8xd8']);
    const move = game.play('f6xf8xd8');
    expect(move.promotes).toBe(true);
    expect(game.board.get(parseSquare('d8'))).toBe(2);
  });

  it('Example 8: with equal captures, man and king moves are both allowed', () => {
    const game = new Game(`W:W${WHITE_8_10}:Ba7,b7,c7,d7,a6,b6,c6,d6,h6,a5,c5,f5`);
    expect(notations(game)).toEqual(['e5xg5', 'h1xh7', 'h1xh8']);
  });

  it('Example 9: the man must capture when it takes more than the king', () => {
    const game = new Game(`W:W${WHITE_8_10}:Ba7,b7,c7,d7,a6,b6,c6,d6,f6,g6,h6,a5,c5,f5`);
    expect(notations(game)).toEqual(['e5xg5xg7']);
  });

  it('Example 10: the king must capture when it takes more than the man', () => {
    const game = new Game(`W:W${WHITE_8_10}:Ba7,b7,c7,d7,e7,g7,a6,b6,c6,d6,f6,h6,a5,c5,f5`);
    expect(notations(game)).toEqual(['h1xh7xf7']);
  });
});
