import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Level } from '../../ai';
import { LEVELS } from '../../ai';
import { INITIAL_FEN, toPdn } from '../../engine';
import type { ArchiveFilter, ArchivedGame, GameArchive, Outcome } from '../archive';
import { LEVEL_UP_WINS, filterGames, formatDuration, outcomeOf, statistics } from '../archive';
import type { MessageKey } from '../i18n';
import { levelKey, reasonKey, useI18n } from '../i18n';
import { routeHash } from '../route';

const OUTCOMES: readonly Outcome[] = ['win', 'draw', 'loss'];

/** PDN of one game, with the players and date as tags. */
function gamePdn(game: ArchivedGame, names: { white: string; black: string }): string {
  const date = new Date(game.endedAt);
  return toPdn(INITIAL_FEN, game.moves, game.result, {
    Date: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`,
    White: names.white,
    Black: names.black,
  });
}

/** Saves text as a file through a temporary link. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-draughts-pdn' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * The archive page: finished games, newest first, with their statistics. A game can be
 * reviewed, opened on the analysis board, saved as PDN or deleted.
 */
export function ArchiveView({
  archive,
  gameInProgress,
  onReview,
}: {
  archive: GameArchive;
  /** Reviewing an archived game replaces the game on the play page, so ask first. */
  gameInProgress: boolean;
  onReview: (game: ArchivedGame) => void;
}) {
  const { t, language } = useI18n();
  const games = useSyncExternalStore(archive.subscribe, archive.getSnapshot);
  const [filter, setFilter] = useState<ArchiveFilter>({ outcome: 'all', opponent: 'all' });
  /** The game whose review or deletion waits for a second click. */
  const [confirming, setConfirming] = useState<{ id: string; action: string } | null>(null);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => {
      setConfirming(null);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [confirming]);

  const shown = filterGames(games, filter);
  const stats = statistics(games);
  const outcomeName = (outcome: Outcome): string => t(`outcome.${outcome}` as MessageKey);
  const names = (game: ArchivedGame) => {
    if (game.opponent === 'human') return { white: t('white'), black: t('black') };
    const computer = `${t('computer')} (${t(levelKey(game.level))})`;
    return game.human === 1
      ? { white: t('you'), black: computer }
      : { white: computer, black: t('you') };
  };
  const confirm = (id: string, action: string, run: () => void) => {
    if (confirming?.id === id && confirming.action === action) {
      setConfirming(null);
      run();
    } else setConfirming({ id, action });
  };
  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <main className="archive-page">
      <section className="archive-stats" aria-label={t('statistics')}>
        <h2>{t('statistics')}</h2>
        {stats.levels.length === 0 ? (
          <p className="empty">{t('noComputerGames')}</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">{t('level')}</th>
                {OUTCOMES.map((outcome) => (
                  <th key={outcome} scope="col">
                    {outcomeName(outcome)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.levels.map(({ level, tally }) => (
                <tr key={level}>
                  <th scope="row">{t(levelKey(level))}</th>
                  {OUTCOMES.map((outcome) => (
                    <td key={outcome}>{tally[outcome]}</td>
                  ))}
                </tr>
              ))}
              <tr className="total">
                <th scope="row">{t('total')}</th>
                {OUTCOMES.map((outcome) => (
                  <td key={outcome}>{stats.total[outcome]}</td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
        {stats.streak && stats.streak.length > 1 && (
          <p>{t(`streak.${stats.streak.outcome}` as MessageKey, { n: stats.streak.length })}</p>
        )}
        {stats.suggestion && (
          <p className="suggestion">
            {t('levelUp', {
              n: LEVEL_UP_WINS,
              from: t(levelKey(stats.suggestion.from)),
              to: t(levelKey(stats.suggestion.to)),
            })}
          </p>
        )}
      </section>

      <section className="archive-games" aria-label={t('archive')}>
        <div className="archive-header">
          <h2>{t('archive')}</h2>
          <select
            aria-label={t('filterResult')}
            value={filter.outcome}
            onChange={(event) => {
              const value = OUTCOMES.find((outcome) => outcome === event.target.value);
              setFilter({ ...filter, outcome: value ?? 'all' });
            }}
          >
            <option value="all">{t('allResults')}</option>
            {OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {outcomeName(outcome)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('filterOpponent')}
            value={filter.opponent}
            onChange={(event) => {
              const value: Level | 'human' | undefined =
                event.target.value === 'human'
                  ? 'human'
                  : LEVELS.find((level) => level === event.target.value);
              setFilter({ ...filter, opponent: value ?? 'all' });
            }}
          >
            <option value="all">{t('allOpponents')}</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(levelKey(level))}
              </option>
            ))}
            <option value="human">{t('twoPlayers')}</option>
          </select>
          {games.length > 0 && (
            <button
              type="button"
              onClick={() => {
                download(
                  'turkish-draughts.pdn',
                  shown.map((game) => gamePdn(game, names(game))).join('\n'),
                );
              }}
            >
              {t('downloadAll')}
            </button>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="empty">{games.length === 0 ? t('archiveEmpty') : t('archiveNoMatch')}</p>
        ) : (
          <ol className="game-list">
            {shown.map((game) => {
              const outcome = outcomeOf(game);
              const opponent =
                game.opponent === 'human' ? t('twoPlayers') : t(levelKey(game.level));
              const side = t(game.human === 1 ? 'white' : 'black');
              return (
                <li key={game.id} className="game-card">
                  <div className="game-summary">
                    <span className={`result-badge ${outcome}`}>{outcomeName(outcome)}</span>
                    <span className="game-title">
                      {game.opponent === 'human' ? opponent : `${opponent} · ${side}`}
                    </span>
                    <span className="game-meta">
                      {dateFormat.format(game.endedAt)} · {t('moveCount', { n: game.moves.length })}
                      {game.durationMs !== null && ` · ${formatDuration(game.durationMs)}`}
                      {' · '}
                      {t(reasonKey(game.result))}
                    </span>
                  </div>
                  <div className="game-actions">
                    <button
                      type="button"
                      onClick={() => {
                        if (gameInProgress) {
                          confirm(game.id, 'review', () => {
                            onReview(game);
                          });
                        } else onReview(game);
                      }}
                    >
                      {confirming?.id === game.id && confirming.action === 'review'
                        ? t('replaceGame')
                        : t('reviewGame')}
                    </button>
                    <a
                      href={routeHash({
                        page: 'analysis',
                        fen: INITIAL_FEN,
                        moves: game.moves,
                        ply: null,
                      })}
                    >
                      {t('pageAnalysis')}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        download(
                          `turkish-draughts-${game.id.slice(0, 8)}.pdn`,
                          gamePdn(game, names(game)),
                        );
                      }}
                    >
                      PDN
                    </button>
                    <button
                      type="button"
                      className={
                        confirming?.id === game.id && confirming.action === 'delete' ? 'danger' : ''
                      }
                      onClick={() => {
                        confirm(game.id, 'delete', () => {
                          void archive.remove(game.id);
                        });
                      }}
                    >
                      {confirming?.id === game.id && confirming.action === 'delete'
                        ? t('confirmDelete')
                        : t('delete')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
