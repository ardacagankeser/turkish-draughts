import type { MessageKey } from './i18n';

/** One position to solve: play one of `accept` (or any legal move when it is empty). */
export interface Exercise {
  readonly id: string;
  readonly fen: string;
  /** Moves in landing notation that solve it; empty means any legal move does. */
  readonly accept: readonly string[];
  /** What to do. */
  readonly task: MessageKey;
  /** The rule behind it, shown once it is solved. */
  readonly rule: MessageKey;
  /** Hide the legal-move dots, so the answer is not given away. */
  readonly hideTargets?: boolean;
}

export interface Lesson {
  readonly id: string;
  readonly title: MessageKey;
  readonly exercises: readonly Exercise[];
}

// White's pieces in TÜDAF examples 1–2 and 8–10.
const WHITE_1_2 = 'a4,h4,a3,b3,c3,d3,e3,f3,g3,h3,a2,c2,d2,f2';
const WHITE_8_10 = 'e5,a4,c4,a3,b3,c3,d3,e3,g3,a2,b2,c2,d2,e2,f2,Kh1';

/**
 * The rules, step by step (like lichess /learn), then the ten worked examples of the
 * Turkish Draughts Federation (TÜDAF) rulebook as exercises. Every position is checked
 * against the rules engine by the tests.
 */
export const LESSONS: readonly Lesson[] = [
  {
    id: 'moving',
    title: 'lesson.moving',
    exercises: [
      {
        id: 'moving-forward',
        fen: 'W:Wd3,h2:Bd6,a7',
        accept: ['d3-d4'],
        task: 'learn.movingForward',
        rule: 'learn.movingForwardRule',
      },
      {
        id: 'moving-sideways',
        fen: 'W:Wd3,h2:Bd6,a7',
        accept: ['d3-c3', 'd3-e3'],
        task: 'learn.movingSideways',
        rule: 'learn.movingSidewaysRule',
      },
    ],
  },
  {
    id: 'capturing',
    title: 'lesson.capturing',
    exercises: [
      {
        id: 'capturing-jump',
        fen: 'W:Wd4:Bd5,h7',
        accept: ['d4xd6'],
        task: 'learn.captureJump',
        rule: 'learn.captureJumpRule',
      },
      {
        id: 'capturing-chain',
        fen: 'W:Wd2:Bd3,d5,a7',
        accept: ['d2xd4xd6'],
        task: 'learn.captureChain',
        rule: 'learn.captureChainRule',
      },
      {
        id: 'capturing-most',
        fen: 'W:Wc2:Bc3,c5,d2,h7',
        accept: ['c2xc4xc6'],
        task: 'learn.captureMost',
        rule: 'learn.captureMostRule',
        hideTargets: true,
      },
    ],
  },
  {
    id: 'promotion',
    title: 'lesson.promotion',
    exercises: [
      {
        id: 'promotion-reach',
        fen: 'W:Wc7,h2:Ba5',
        accept: ['c7-c8'],
        task: 'learn.promote',
        rule: 'learn.promoteRule',
      },
    ],
  },
  {
    id: 'kings',
    title: 'lesson.kings',
    exercises: [
      {
        id: 'kings-fly',
        fen: 'W:WKd1:Bh7,a7',
        accept: ['d1-d7'],
        task: 'learn.kingFly',
        rule: 'learn.kingFlyRule',
      },
      {
        id: 'kings-capture',
        fen: 'W:WKd1:Bd5,a7',
        accept: [],
        task: 'learn.kingCapture',
        rule: 'learn.kingCaptureRule',
      },
    ],
  },
  {
    id: 'tudaf',
    title: 'lesson.tudaf',
    exercises: [
      {
        id: 'tudaf-1',
        fen: `W:W${WHITE_1_2}:Bc7,h7,a6,b6,c6,d6,e6,g6,h6,a5,b5,c5,e5,g5,f4`,
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.1',
        hideTargets: true,
      },
      {
        id: 'tudaf-2',
        fen: `W:W${WHITE_1_2}:Bc7,e7,g7,a6,b6,c6,d6,e6,g6,h6,a5,b5,c5,e5,g5,f4`,
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.2',
        hideTargets: true,
      },
      {
        id: 'tudaf-3',
        fen: 'B:Wc5,a4,g4,a3,b3,c3,f3,h3,b2,e2,g2:BKc8,a7,d7,e7,f7,g7,e6,f6,g6,e5',
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.3',
        hideTargets: true,
      },
      {
        id: 'tudaf-4',
        fen: 'B:Wc5,a4,f4,g4,h4,a3,b3,c3,f3,h3,b2,e2,g2:BKc8,a7,d7,e7,f7,g7,e6,f6,g6,f5',
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.4',
        hideTargets: true,
      },
      {
        id: 'tudaf-5',
        fen: 'W:We4,a3,b3,e3,f3,h3,d2,e2,g2:BKc8,a7,d7,e7,f7,g7,f6,g6,e5',
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.5',
        hideTargets: true,
      },
      {
        id: 'tudaf-6',
        // After White's f7-f8: the new king does not capture, Black's king must.
        fen: 'B:Wa4,c4,a3,b3,c3,d3,e3,g3,a2,b2,d2,f2,g2,Kf8:BKe8,a7,b7,c7,d7,a6,b6,c6,d6,h6,a5,c5',
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.6',
        hideTargets: true,
      },
      {
        id: 'tudaf-7',
        fen: 'W:Wf6,a4,c4,a3,b3,c3,d3,g3,a2,b2,d2,f2,g2:BKe8,a7,b7,c7,d7,f7,a6,b6,c6,d6,h6,a5,c5',
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.7',
        hideTargets: true,
      },
      {
        id: 'tudaf-8',
        fen: `W:W${WHITE_8_10}:Ba7,b7,c7,d7,a6,b6,c6,d6,h6,a5,c5,f5`,
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.8',
        hideTargets: true,
      },
      {
        id: 'tudaf-9',
        fen: `W:W${WHITE_8_10}:Ba7,b7,c7,d7,a6,b6,c6,d6,f6,g6,h6,a5,c5,f5`,
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.9',
        hideTargets: true,
      },
      {
        id: 'tudaf-10',
        fen: `W:W${WHITE_8_10}:Ba7,b7,c7,d7,e7,g7,a6,b6,c6,d6,f6,h6,a5,c5,f5`,
        accept: [],
        task: 'learn.findCapture',
        rule: 'tudaf.10',
        hideTargets: true,
      },
    ],
  },
];

/** Every exercise in order, with the lesson it belongs to. */
export const EXERCISES: readonly { readonly lesson: Lesson; readonly exercise: Exercise }[] =
  LESSONS.flatMap((lesson) => lesson.exercises.map((exercise) => ({ lesson, exercise })));
