import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Color } from '../../engine';
import { winningChances } from '../../ai';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import type { Judgement } from '../review';
import { judgementKey } from '../review';
import type { GameReview, Practice } from '../session';

const WIDTH = 600;
const HEIGHT = 120;
const MARKED: readonly Judgement[] = ['blunder', 'mistake', 'inaccuracy'];
const REVEALED: readonly Practice['status'][] = ['right', 'good', 'shown'];

/**
 * The review of a finished game: progress while the engine works, then each side's
 * accuracy and mistakes, and the evaluation graph (click a point to see that position).
 */
export function ReviewPanel({
  review,
  moveNumber,
  white,
  black,
  onPly,
  practice,
  onPractice,
}: {
  review: GameReview;
  moveNumber: number;
  /** How each side is called: "You" and "Computer", or "White" and "Black". */
  white: string;
  black: string;
  onPly: (ply: number) => void;
  practice: Practice | null;
  onPractice: {
    readonly start: () => void;
    readonly next: () => void;
    readonly solution: () => void;
    readonly stop: () => void;
  };
}) {
  const { t } = useI18n();
  const plies = review.scores.length - 1;
  const x = (ply: number) => (plies > 0 ? (ply / plies) * WIDTH : 0);
  // White's winning chances, from the top (White wins) to the bottom (Black wins).
  const y = (score: number) => ((1 - winningChances(score)) / 2) * HEIGHT;

  const points: string[] = [];
  review.scores.forEach((score, ply) => {
    if (score !== null) points.push(`${x(ply).toFixed(1)},${y(score).toFixed(1)}`);
  });
  const reached = review.scores.findLastIndex((score) => score !== null);
  const area =
    points.length > 1 ? `0,${HEIGHT} ${points.join(' ')} ${x(reached).toFixed(1)},${HEIGHT}` : '';

  const choose = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    onPly(Math.max(0, Math.min(plies, Math.round(ratio * plies))));
  };

  const side = (color: Color, name: string) => {
    const summary = color === 1 ? review.white : review.black;
    return (
      <tr>
        <th scope="row">{name}</th>
        <td>{summary.accuracy === null ? '–' : `${Math.round(summary.accuracy)}%`}</td>
        {MARKED.map((judgement) => (
          <td key={judgement} className={`judgement ${judgement}`}>
            {summary.counts[judgement]}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <section className="review" aria-label={t('review')}>
      <h2>{t('review')}</h2>
      {!review.done && (
        <div className="review-progress">
          <progress value={review.progress} max={1} aria-label={t('reviewing')} />
          <span>{t('reviewProgress', { n: Math.round(review.progress * 100) })}</span>
        </div>
      )}
      <svg
        className="eval-graph"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('evalGraph')}
        onPointerDown={choose}
      >
        <rect className="graph-black" width={WIDTH} height={HEIGHT} />
        {area && <polygon className="graph-white" points={area} />}
        <line className="graph-middle" x1={0} x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} />
        <line className="graph-current" x1={x(moveNumber)} x2={x(moveNumber)} y1={0} y2={HEIGHT} />
        {review.moves
          .filter((move) => MARKED.includes(move.judgement))
          .map((move) => {
            const score = review.scores[move.ply + 1];
            return score === null || score === undefined ? null : (
              <circle
                key={move.ply}
                className={`graph-mark ${move.judgement}`}
                cx={x(move.ply + 1)}
                cy={y(score)}
                r={4}
              >
                <title>{t(judgementKey(move.judgement))}</title>
              </circle>
            );
          })}
      </svg>
      <table className="review-summary">
        <thead>
          <tr>
            <td />
            <th scope="col">{t('accuracy')}</th>
            {MARKED.map((judgement) => (
              <th key={judgement} scope="col" title={t(judgementKey(judgement))}>
                {t(`judgementShort.${judgement}` as MessageKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {side(1, white)}
          {side(-1, black)}
        </tbody>
      </table>
      {review.done && !practice && (
        <button type="button" className="primary learn" onClick={onPractice.start}>
          {t('learnMistakes')}
        </button>
      )}
      {practice && (
        <div className="practice" role="group" aria-label={t('learnMistakes')}>
          <p className="practice-title">
            {t('learnMistakes')}
            {practice.total > 0 && practice.status !== 'done' && (
              <span>
                {' '}
                · {t('practiceProgress', { n: practice.index + 1, total: practice.total })}
              </span>
            )}
          </p>
          <div className="practice-actions">
            {(practice.status === 'try' || practice.status === 'wrong') && (
              <button type="button" onClick={onPractice.solution}>
                {t('showSolution')}
              </button>
            )}
            {practice.status !== 'done' && practice.status !== 'checking' && (
              <button type="button" className="primary" onClick={onPractice.next}>
                {REVEALED.includes(practice.status) ? t('nextMistake') : t('skipMistake')}
              </button>
            )}
            <button type="button" onClick={onPractice.stop}>
              {practice.status === 'done' ? t('close') : t('stopPractice')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
