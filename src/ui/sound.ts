import type { Color } from '../engine';
import { STEP_MS } from './components/Board';
import type { GameEvent } from './session';

const MUTED_KEY = 'turkish-draughts:muted';
const VOLUME = 0.35;

/** The parts of the Web Audio API the player uses; tests pass a fake. */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
}

interface Tone {
  /** Seconds after now. */
  readonly at: number;
  readonly frequency: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly gain: number;
}

/** The tones for an event; empty when it makes no sound. */
export function tonesFor(event: GameEvent, human: Color): Tone[] {
  const tone = (at: number, frequency: number, duration = 0.08, gain = 1): Tone => ({
    at,
    frequency,
    duration,
    type: 'triangle',
    gain,
  });
  if (event.kind === 'start') return [tone(0, 523), tone(0.11, 784)];
  if (event.kind === 'end') return endTones(event.result.winner, human, tone);

  const tones: Tone[] = [tone(0, 330, 0.06)];
  // One tick per captured piece, as it fades on the board.
  for (let i = 0; i < event.captures; i++) {
    tones.push({ ...tone(((i + 0.5) * STEP_MS) / 1000, 880, 0.05, 0.8), type: 'square' });
  }
  const after = (Math.max(1, event.captures) * STEP_MS) / 1000;
  if (event.promotes) tones.push(tone(after, 660, 0.12), tone(after + 0.12, 990, 0.18));
  else if (event.damaAlti) tones.push(tone(after, 587, 0.1, 0.6));
  if (event.mustCapture) tones.push(tone(after + 0.05, 440, 0.07, 0.5));
  if (event.result) tones.push(...endTones(event.result.winner, human, tone, after + 0.3));
  return tones;
}

function endTones(
  winner: Color | null,
  human: Color,
  tone: (at: number, frequency: number, duration?: number) => Tone,
  start = 0,
): Tone[] {
  const notes = winner === null ? [523, 523] : winner === human ? [523, 659, 784] : [523, 415, 330];
  return notes.map((frequency, i) => tone(start + i * 0.14, frequency, 0.16));
}

/**
 * Short synthesised sounds (no audio files). Browsers only allow audio after a user
 * gesture, so the context is created on the first click or key press.
 */
export class SoundPlayer {
  readonly #storage: Storage;
  readonly #createContext: () => AudioContextLike | null;
  #context: AudioContextLike | null = null;
  #muted: boolean;

  constructor(
    storage: Storage = globalThis.localStorage,
    createContext: () => AudioContextLike | null = defaultContext,
  ) {
    this.#storage = storage;
    this.#createContext = createContext;
    let muted = false;
    try {
      muted = storage.getItem(MUTED_KEY) === 'true';
    } catch {
      // Storage unavailable: sound stays on.
    }
    this.#muted = muted;
  }

  get muted(): boolean {
    return this.#muted;
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    try {
      this.#storage.setItem(MUTED_KEY, String(muted));
    } catch {
      // Not remembered.
    }
  }

  /** Call from a user gesture: creates or resumes the audio context. */
  unlock(): void {
    this.#context ??= this.#createContext();
    if (this.#context?.state === 'suspended') void this.#context.resume().catch(() => undefined);
  }

  play(event: GameEvent, human: Color): number {
    const context = this.#context;
    if (this.#muted || !context) return 0;
    const tones = tonesFor(event, human);
    for (const tone of tones) {
      const start = context.currentTime + tone.at;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(VOLUME * tone.gain, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.02);
    }
    return tones.length;
  }
}

function defaultContext(): AudioContextLike | null {
  return typeof AudioContext === 'undefined' ? null : new AudioContext();
}
