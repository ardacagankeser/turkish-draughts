import { favoured, formatEvaluation, whiteShare } from '../evaluation';
import { useI18n } from '../i18n';
import type { Evaluation } from '../session';

interface EvalBarProps {
  readonly evaluation: Evaluation | null;
  /** True when Black is at the bottom of the board; the bar turns with it. */
  readonly flipped: boolean;
}

/**
 * Vertical evaluation bar, like lichess's gauge and chess.com's bar. The white part grows
 * from White's side of the board; its size is the winning chance, not the raw score.
 */
export function EvalBar({ evaluation, flipped }: EvalBarProps) {
  const { t } = useI18n();
  const share = whiteShare(evaluation);
  const side = evaluation ? favoured(evaluation) : null;
  const label = evaluation ? formatEvaluation(evaluation) : '';

  let text = t('evalPending');
  if (evaluation) {
    text =
      side === null
        ? t('evalEqual', { score: label })
        : t('evalBetter', { side: t(side === 1 ? 'white' : 'black'), score: label });
  }

  // The label sits at the end of the favoured side, as on chess.com.
  const labelAtWhiteEnd = side !== -1;
  const whiteAtBottom = !flipped;
  const labelAtBottom = labelAtWhiteEnd === whiteAtBottom;

  return (
    <div
      className={`eval-bar${flipped ? ' flipped' : ''}${evaluation ? '' : ' pending'}`}
      role="meter"
      aria-label={t('evalBar')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      aria-valuetext={text}
      title={
        evaluation && !evaluation.final ? `${text} · ${t('depth', { n: evaluation.depth })}` : text
      }
    >
      <div className="eval-white" style={{ height: `${share * 100}%` }} />
      <div className="eval-mid" aria-hidden="true" />
      {label && (
        <span
          className={`eval-label ${labelAtBottom ? 'bottom' : 'top'} ${labelAtWhiteEnd ? 'on-white' : 'on-black'}`}
          aria-hidden="true"
        >
          {label}
        </span>
      )}
    </div>
  );
}
