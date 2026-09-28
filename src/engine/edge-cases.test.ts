/**
 * Situations the TÜDAF rulebook does not illustrate directly. Each test names the rule
 * or the reasoning in docs/RULES.md that decides it.
 */
import { describe, expect, it } from 'vitest';
import { Game, WHITE, moveToNotation, parseFen, parseSquare } from '.';

const notations = (fen: string): string[] => new Game(fen).legalMoves.map(moveToNotation).sort();

describe('promotion by capture (rule 5)', () => {
  it('lets the man keep capturing sideways along the far rank, still as a man', () => {
    // After f6xf8 the man takes e8 and then c8, one square at a time.
    expect(notations('W:Wf6,a1:Bf7,Ke8,Kc8,h5')).toEqual(['f6xf8xd8xb8']);
  });

  it('only finds opposing kings on the far rank, so "adjacent piece" and "adjacent king" agree', () => {
    // Black men can never stand on rank 8, so a white man there can only ever take kings.
    expect(() => parseFen('W:Wa1:Bh8')).not.toThrow();
    const game = new Game('W:Wf6,a1:Bf7,Ke8,h5');
    const move = game.play('f6xf8xd8');
    expect(move.capturedPieces).toEqual([-1, -2]);
  });

  it('does not let a man promoted by a quiet move capture on the same turn', () => {
    const game = new Game('W:Wf7,a1:BKe8,h5');
    game.play('f7-f8');
    expect(game.turn).not.toBe(WHITE);
  });
});

describe('flying king captures', () => {
  it('may land on any empty square beyond the captured piece when the chain ends', () => {
    expect(notations('W:WKa1:Ba3,h8')).toEqual(['a1xa4', 'a1xa5', 'a1xa6', 'a1xa7', 'a1xa8']);
  });

  it('only forbids reversing between consecutive jumps, not a U-turn over three jumps', () => {
    // North over b4, east over d6, then south over f4: north is followed by south later.
    const moves = notations('W:WKb1:Bb4,d6,f4,h8');
    expect(moves).toEqual(['b1xb6xf6xf1', 'b1xb6xf6xf2', 'b1xb6xf6xf3']);
  });

  it('may cross or even finish on its own starting square', () => {
    // A square loop over a3, c5, e3 and c1 ends back on a1. Going round either way
    // captures the same pieces, so the two loops count as a single legal move.
    const game = new Game('W:WKa1:Ba3,c5,e3,Kc1,h8');
    const start = game.fen();
    const loops = game.legalMoves.filter((move) => move.to === move.from);
    expect(loops).toHaveLength(1);
    const [loop] = loops;
    if (!loop) throw new Error('expected a loop');
    expect(['a1xa5xe5xe1xa1', 'a1xe1xe5xa5xa1']).toContain(moveToNotation(loop));
    game.play(loop);
    expect(game.fen()).toBe('B:WKa1:Bh8');
    game.undo();
    expect(game.fen()).toBe(start);
  });
});

describe('end of game', () => {
  it('draws at one piece each even if the side to move could capture', () => {
    // The literal rule: "both players have just one piece left" ends the game.
    const game = new Game('W:WKa1:Ba4');
    expect(game.result).toEqual({ winner: null, reason: 'one-piece-each' });
  });

  it('wins on time regardless of the position (tournament rule 1g)', () => {
    const game = new Game('W:WKa1,Kb1,Kc1:Bh8');
    game.timeout(WHITE);
    expect(game.result).toEqual({ winner: -1, reason: 'timeout' });
  });
});

describe('position validation', () => {
  it('rejects men standing on their own promotion rank', () => {
    expect(() => parseFen('W:Wd8:Ba1')).toThrow('must be a king');
    expect(() => parseFen('W:Wd4:Ba1,b1')).toThrow('must be a king');
    expect(parseFen('W:WKd8:BKa1').get(parseSquare('d8'))).toBe(2);
  });
});
