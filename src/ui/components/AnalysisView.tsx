import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AnalysisClient } from '../../ai';
import { Game, INITIAL_FEN, parsePdn, toPdn } from '../../engine';
import type { Timing } from '../animation';
import { AnalysisSession } from '../analysis-session';
import { formatEvaluation } from '../evaluation';
import { useI18n } from '../i18n';
import { navigate, routeHash, routeLink } from '../route';
import { Board } from './Board';
import { EvalBar } from './EvalBar';

const NONE: readonly never[] = [];

/** Copies text, falling back to selecting it when the clipboard is not available. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The analysis board page: a free board with the engine's evaluation and line, the moves
 * played on it, and FEN, PDN and link import and export.
 */
export function AnalysisView({
  fen,
  moves,
  ply,
  createAnalysis,
  timing,
}: {
  fen: string;
  moves: readonly string[];
  ply: number | null;
  createAnalysis: () => AnalysisClient;
  timing: Timing;
}) {
  const { t } = useI18n();
  // A link with a bad position or move opens the standard position instead.
  const [{ session, invalid }] = useState(() => {
    try {
      return { session: new AnalysisSession(createAnalysis(), fen, moves, ply), invalid: false };
    } catch {
      return { session: new AnalysisSession(createAnalysis(), INITIAL_FEN, []), invalid: true };
    }
  });
  const board = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    session.start();
    return session.stop;
  }, [session]);

  // ← → Home End browse the line, f turns the board, as on the play page.
  useEffect(() => {
    const keys: Record<string, () => void> = {
      ArrowLeft: session.showPrevious,
      ArrowRight: session.showNext,
      Home: session.showFirst,
      End: session.showLast,
      f: session.flip,
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [role="dialog"], .board')) return;
      const action = keys[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [session]);

  const [fenText, setFenText] = useState<string | null>(null);
  const [pdnText, setPdnText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(invalid ? t('invalidLink') : null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(null);
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const pdn = toPdn(board.startFen, board.line, null, {
    Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
  });
  const link = routeLink({ page: 'analysis', fen: board.startFen, moves: board.line, ply: null });

  const copyText = async (what: string, text: string) => {
    if (await copy(text)) setCopied(what);
  };

  /** Opens another position or game on the board (through the URL, so it can be shared). */
  const open = (startFen: string, line: readonly string[]) => {
    setError(null);
    setFenText(null);
    setPdnText(null);
    navigate({ page: 'analysis', fen: startFen, moves: line, ply: null });
  };

  const side = t(board.turn === 1 ? 'white' : 'black');
  const status = board.result
    ? `${t('gameOver')}: ${t(board.result.winner === null ? 'draw' : board.result.winner === 1 ? 'whiteWins' : 'blackWins')}`
    : t('sideToMove', { side });

  const rows: [string, string | undefined, number][] = [];
  const blackFirst = board.startFen.trim().toUpperCase().startsWith('B');
  const list = blackFirst ? ['…', ...board.moveList] : board.moveList;
  for (let i = 0; i < list.length; i += 2) rows.push([list[i] ?? '', list[i + 1], i]);
  const plyOf = (index: number) => (blackFirst ? index : index + 1);

  return (
    <main className="layout analysis-page">
      <div className="board-area">
        <div className="board-wrap">
          <Board
            pieces={board.pieces}
            captured={board.captured}
            lastMove={board.lastMove}
            moveNumber={board.ply}
            legalMoves={board.legalMoves}
            selection={board.selection}
            hint={board.bestMove}
            flipped={board.flipped}
            premove={null}
            premoveFrom={null}
            premoveTargets={NONE}
            premovable={NONE}
            ghosts={board.ghosts}
            timing={timing}
            onSquare={session.clickSquare}
            onCancelPremove={() => undefined}
          />
        </div>
        <EvalBar evaluation={board.evaluation} flipped={board.flipped} />
      </div>

      <aside className="panel">
        <p className="status" role="status" aria-live="polite">
          {status}
        </p>

        {board.evaluation && (
          <p className="engine">
            {board.evaluation.final ? (
              formatEvaluation(board.evaluation)
            ) : (
              <>
                <strong>{formatEvaluation(board.evaluation)}</strong> ·{' '}
                {t('depth', { n: board.evaluation.depth })}
                {board.pv.length > 0 && <span className="pv"> · {board.pv.join(' ')}</span>}
              </>
            )}
          </p>
        )}

        <section className="moves">
          <h2>{t('moves')}</h2>
          {rows.length === 0 ? (
            <p className="empty">{t('analysisEmpty')}</p>
          ) : (
            <ol>
              {rows.map(([first, second, index]) => {
                const cell = (notation: string, at: number) =>
                  notation === '…' ? (
                    <span className="move">…</span>
                  ) : (
                    <button
                      type="button"
                      className="move"
                      aria-current={board.ply === plyOf(at)}
                      onClick={() => {
                        session.showPly(plyOf(at));
                      }}
                    >
                      {notation}
                    </button>
                  );
                return (
                  <li key={index}>
                    {cell(first, index)}
                    {second !== undefined && cell(second, index + 1)}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="navigation" role="group" aria-label={t('navigation')}>
            <button
              type="button"
              aria-label={t('firstMove')}
              onClick={session.showFirst}
              disabled={board.ply === 0}
            >
              ⏮
            </button>
            <button
              type="button"
              aria-label={t('previousMove')}
              onClick={session.showPrevious}
              disabled={board.ply === 0}
            >
              ◀
            </button>
            <button
              type="button"
              aria-label={t('nextMove')}
              onClick={session.showNext}
              disabled={board.ply === board.line.length}
            >
              ▶
            </button>
            <button
              type="button"
              aria-label={t('lastMove')}
              onClick={session.showLast}
              disabled={board.ply === board.line.length}
            >
              ⏭
            </button>
          </div>
        </section>

        <section className="controls">
          <button type="button" onClick={session.flip}>
            {t('flip')}
          </button>
          <button
            type="button"
            onClick={session.cutLine}
            disabled={board.ply === board.line.length}
          >
            {t('cutLine')}
          </button>
          <button
            type="button"
            onClick={() => {
              void copyText('link', link);
            }}
          >
            {copied === 'link' ? t('copied') : t('copyLink')}
          </button>
          <button
            type="button"
            onClick={() => {
              open(INITIAL_FEN, []);
            }}
          >
            {t('startPosition')}
          </button>
        </section>

        <section className="share">
          <label htmlFor="analysis-fen">FEN</label>
          <div className="share-row">
            <input
              id="analysis-fen"
              type="text"
              spellCheck={false}
              autoComplete="off"
              value={fenText ?? board.fen}
              onChange={(event) => {
                setFenText(event.target.value);
              }}
            />
            <button
              type="button"
              onClick={() => {
                void copyText('fen', board.fen);
              }}
            >
              {copied === 'fen' ? t('copied') : t('copy')}
            </button>
            <button
              type="button"
              disabled={fenText === null}
              onClick={() => {
                try {
                  const text = (fenText ?? '').trim();
                  // Checked here so a bad FEN is reported instead of opening the default.
                  new Game(text);
                  open(text, []);
                } catch {
                  setError(t('invalidFen'));
                }
              }}
            >
              {t('load')}
            </button>
          </div>

          <label htmlFor="analysis-pdn">PDN</label>
          <textarea
            id="analysis-pdn"
            rows={5}
            spellCheck={false}
            value={pdnText ?? pdn}
            onChange={(event) => {
              setPdnText(event.target.value);
            }}
          />
          <div className="share-row">
            <button
              type="button"
              onClick={() => {
                void copyText('pdn', pdn);
              }}
            >
              {copied === 'pdn' ? t('copied') : t('copyPdn')}
            </button>
            <button
              type="button"
              disabled={pdnText === null}
              onClick={() => {
                try {
                  const game = parsePdn(pdnText ?? '');
                  open(game.fen, game.moves);
                } catch (problem) {
                  setError(
                    t('invalidPdn', { reason: problem instanceof Error ? problem.message : '' }),
                  );
                }
              }}
            >
              {t('loadPdn')}
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <a className="back-link" href={routeHash({ page: 'editor', fen: board.fen })}>
          {t('editPosition')}
        </a>
        <a className="back-link" href="#/">
          {t('backToPlay')}
        </a>
      </aside>
    </main>
  );
}
