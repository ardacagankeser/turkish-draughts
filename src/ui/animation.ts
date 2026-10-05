/**
 * Timing of the board animations. A capture is a sequence of identical beats: the capturing
 * piece hops to its next landing square, then the piece it jumped flies off. A chain repeats
 * the beat once per captured piece.
 */

/** Milliseconds for a quiet move to slide, at normal speed. */
export const SLIDE_MS = 170;
/** Milliseconds for a capturing piece to hop to its next landing square, at normal speed. */
export const HOP_MS = 300;
/** Milliseconds for a jumped piece to fly off once the capturing piece has landed. */
export const VANISH_MS = 220;
/** Opacity of a piece jumped while a capture chain is being chosen. */
export const GHOST_OPACITY = 0.35;

export interface Timing {
  /** False when animations are turned off; every duration is then 0. */
  readonly enabled: boolean;
  readonly slide: number;
  readonly hop: number;
  readonly vanish: number;
  /** When the hop to the `index`-th landing square of a capture starts. */
  hopStart(index: number): number;
  /** When the `index`-th jumped piece starts to fly off. */
  vanishStart(index: number): number;
  /** How long a capture of `count` pieces takes to play out on the board. */
  captureDuration(count: number): number;
}

/** The timings at `scale` times the normal durations (0 turns animations off). */
export function timing(scale = 1): Timing {
  const slide = Math.round(SLIDE_MS * scale);
  const hop = Math.round(HOP_MS * scale);
  const vanish = Math.round(VANISH_MS * scale);
  const hopStart = (index: number) => index * (hop + vanish);
  return {
    enabled: scale > 0,
    slide,
    hop,
    vanish,
    hopStart,
    vanishStart: (index) => hopStart(index) + hop,
    captureDuration: hopStart,
  };
}

export const NORMAL_TIMING = timing(1);
