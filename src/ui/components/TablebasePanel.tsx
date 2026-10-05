import type { Outcome } from '../../ai';
import type { TablebasePanel as Panel } from '../analysis-session';
import type { Translate } from '../i18n';
import { useI18n } from '../i18n';
import { movesOf } from '../tablebase-view';

/** "Win in 3", "Draw", "Loss in 5" (in moves, as people count them). */
function outcomeLabel(outcome: Outcome | null, t: Translate): string {
  if (!outcome) return '?';
  if (outcome.result === 'draw') return t('tbDraw');
  const n = movesOf(outcome.plies);
  return t(outcome.result === 'win' ? 'tbWinIn' : 'tbLossIn', { n });
}

/**
 * The exact result of a position with three pieces or fewer, and of each of its moves,
 * like the lichess tablebase panel. A move is played by clicking it.
 */
export function TablebasePanel({
  panel,
  onMove,
}: {
  panel: Panel;
  onMove: (landing: string) => void;
}) {
  const { t } = useI18n();
  let summary: string;
  if (panel.status === 'loading') summary = t('tbLoading');
  else if (panel.status === 'unavailable') summary = t('tbUnavailable');
  else {
    const side = t(panel.turn === 1 ? 'white' : 'black');
    const outcome = panel.outcome;
    summary = !outcome
      ? t('tbUnknown')
      : outcome.result === 'draw'
        ? t('tbPositionDraw')
        : t(outcome.result === 'win' ? 'tbPositionWin' : 'tbPositionLoss', {
            side,
            n: movesOf(outcome.plies),
          });
  }

  return (
    <section className="tablebase" aria-label={t('tablebase')}>
      <h2>{t('tablebase')}</h2>
      <p className="tablebase-summary">{summary}</p>
      {panel.status === 'ready' && panel.moves.length > 0 && (
        <ul>
          {panel.moves.map((move) => (
            <li key={move.landing}>
              <button
                type="button"
                className={`tb-move ${move.outcome?.result ?? 'unknown'}`}
                onClick={() => {
                  onMove(move.landing);
                }}
              >
                <span className="tb-notation">{move.notation}</span>
                <span className="tb-result">{outcomeLabel(move.outcome, t)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
