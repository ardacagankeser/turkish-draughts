import type { Color } from '../engine';
import type { Translate } from './i18n';
import { reasonKey } from './i18n';
import type { GameEvent } from './session';

/** What a screen reader should say about an event, in the current language. */
export function describeEvent(event: GameEvent, human: Color, t: Translate): string {
  if (event.kind === 'start') {
    return t('announceStart', { side: t(human === 1 ? 'white' : 'black') });
  }
  if (event.kind === 'end') return describeResult(event.result.winner, human, t, event);

  const parts = [
    t(event.by === 'computer' ? 'announceComputerMove' : 'announceYourMove', {
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
  human: Color,
  t: Translate,
  event: GameEvent,
): string {
  const result = event.kind === 'start' ? null : event.result;
  const outcome = winner === null ? t('draw') : winner === human ? t('youWin') : t('youLose');
  const sentence = /[.!?]$/.test(outcome) ? outcome : `${outcome}.`;
  return result ? `${sentence} ${t(reasonKey(result))}` : sentence;
}
