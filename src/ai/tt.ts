export const EXACT = 1;
export const LOWER = 2;
export const UPPER = 3;
export type Bound = typeof EXACT | typeof LOWER | typeof UPPER;

/**
 * Transposition table in flat typed arrays (about 11 bytes per entry, no GC pressure).
 * Stores the move as its index in the generator's move list, which is deterministic
 * for a given position.
 */
export class TranspositionTable {
  readonly size: number;
  readonly #mask: number;
  readonly #check: Int32Array;
  readonly #score: Int32Array;
  readonly #depth: Int8Array;
  readonly #bound: Uint8Array;
  readonly #move: Uint8Array;

  constructor(bits = 20) {
    this.size = 1 << bits;
    this.#mask = this.size - 1;
    this.#check = new Int32Array(this.size);
    this.#score = new Int32Array(this.size);
    this.#depth = new Int8Array(this.size);
    this.#bound = new Uint8Array(this.size);
    this.#move = new Uint8Array(this.size);
  }

  /** The slot holding `(hi, lo)`, or -1 if it is not stored. */
  probe(hi: number, lo: number): number {
    const slot = lo & this.#mask;
    return this.#bound[slot] !== 0 && this.#check[slot] === hi ? slot : -1;
  }

  depth(slot: number): number {
    return this.#depth[slot] ?? 0;
  }

  bound(slot: number): number {
    return this.#bound[slot] ?? 0;
  }

  score(slot: number): number {
    return this.#score[slot] ?? 0;
  }

  move(slot: number): number {
    return this.#move[slot] ?? 0;
  }

  /** Depth-preferred replacement: a different position always replaces, the same one only if deeper. */
  store(hi: number, lo: number, depth: number, bound: Bound, score: number, move: number): void {
    const slot = lo & this.#mask;
    if (this.#check[slot] === hi && this.#bound[slot] !== 0 && (this.#depth[slot] ?? 0) > depth) {
      return;
    }
    this.#check[slot] = hi;
    this.#depth[slot] = Math.min(depth, 127);
    this.#bound[slot] = bound;
    this.#score[slot] = score;
    this.#move[slot] = Math.min(move, 255);
  }

  clear(): void {
    this.#bound.fill(0);
  }
}
