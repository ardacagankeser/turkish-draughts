/**
 * Timing of the board animations. A capture is a sequence of identical beats: the capturing
 * piece hops to its next landing square, then the piece it jumped flies off. A chain repeats
 * the beat once per captured piece.
 */

/** Milliseconds for a quiet move to slide one step. */
export const SLIDE_MS = 170;
/** Milliseconds for a capturing piece to hop to its next landing square. */
export const HOP_MS = 300;
/** Milliseconds for a jumped piece to fly off once the capturing piece has landed. */
export const VANISH_MS = 220;
/** Opacity of a piece jumped while a capture chain is being chosen. */
export const GHOST_OPACITY = 0.35;

/** When the hop to the `index`-th landing square of a capture starts. */
export const hopStart = (index: number): number => index * (HOP_MS + VANISH_MS);

/** When the `index`-th jumped piece starts to fly off. */
export const vanishStart = (index: number): number => hopStart(index) + HOP_MS;

/** How long a capture of `count` pieces takes to play out on the board. */
export const captureDuration = (count: number): number => hopStart(count);
