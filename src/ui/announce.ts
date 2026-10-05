import type { Color } from '../engine';
import type { Translate } from './i18n';
import { reasonKey } from './i18n';
import type { GameEvent } from './session';

const sideName = (side: Color, t: Translate) => t(side === 1 ? 'white' : 'black');

/**
 * What a screen reader should say about an event, in the current language. `human` is the
 * player's side against the computer, or `null` when two players share the device.
 */
export function describeEvent(event: GameEvent, human: Color | null, t: Translate): string {
  if (event.kind === 'start') {
    return human === null
      ? t('announceStartTwoPlayers')
      : t('announceStart', { side: sideName(human, t) });
  }
  if (event.kind === 'end') return describeResult(event.result.winner, human, t, event);
  if (event.kind === 'lowTime') {
    if (human === null) return t('announceSideLowTime', { side: sideName(event.side, t) });
    return event.side === human ? t('announceLowTime') : '';
  }

  const parts = [
    human === null
      ? t('announceSideMove', { side: sideName(event.side, t), move: event.notation })
      : t(event.by === 'computer' ? 'announceComputerMove' : 'announceYourMove', {
          move: event.notation,
        }),
  ];
  if (event.captures > 0) parts.push(t('announceCaptures', { n: event.captures }));
  if (event.promotes) parts.push(t('announcePromotion'));
  else if (event.damaAlti) parts.push(t('announceDamaAlti'));
  if (event.result) parts.push(describeResult(event.result.winner, human, t, event));
  else if (event.mustCapture) parts.push(t('mustCapture'));
  return parts.join(' ');
}

function describeResult(
  winner: Color | null,
  human: Color | null,
  t: Translate,
  event: GameEvent,
): string {
  const result = event.kind === 'end' || event.kind === 'move' ? event.result : null;
  const outcome = outcomeText(winner, human, t);
  const sentence = /[.!?]$/.test(outcome) ? outcome : `${outcome}.`;
  return result ? `${sentence} ${t(reasonKey(result))}` : sentence;
}

/** "You win", "You lose", "Draw", or with two players "White wins" and "Black wins". */
export function outcomeText(winner: Color | null, human: Color | null, t: Translate): string {
  if (winner === null) return t('draw');
  if (human === null) return t(winner === 1 ? 'whiteWins' : 'blackWins');
  return winner === human ? t('youWin') : t('youLose');
}
