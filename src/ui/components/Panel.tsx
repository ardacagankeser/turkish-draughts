import { useEffect, useRef, useState } from 'react';
import type { Color } from '../../engine';
import { INITIAL_FEN } from '../../engine';
import { routeHash } from '../route';
import { formatEvaluation } from '../evaluation';
import { revealWithin } from '../scroll';
import type { GameSession, Practice, Snapshot } from '../session';
import type { Translate } from '../i18n';
import { levelKey, reasonKey, useI18n } from '../i18n';
import { ClockFace } from './ClockFace';
import { ReviewPanel } from './ReviewPanel';
import type { ReviewedMove } from '../review';
import { SYMBOLS, judgementKey } from '../review';
import { outcomeText } from '../announce';

interface PanelProps {
  readonly game: Snapshot;
  readonly session: GameSession;
  readonly onNewGame: () => void;
}

export function Panel({ game, session, onNewGame }: PanelProps) {
  const { t } = useI18n();
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<'illegal' | 'ambiguous' | 'not-your-turn' | null>(
    null,
  );
  const moveListEnd = useRef<HTMLOListElement>(null);
  const settings = game.settings;
  const human: Color = settings?.human ?? 1;
  // Two players on one device: both sides are human, named by colour.
  const hotseat = settings?.opponent === 'human';
  const over = game.result !== null;
  const humanTurn = !over && (hotseat || game.turn === human) && !game.thinking;

  // Keep the move shown in view: the newest one while playing, the chosen one while browsing.
  useEffect(() => {
    const list = moveListEnd.current;
    if (!list) return;
    const current = list.querySelector<HTMLElement>('[aria-current="true"]');
    if (current) revealWithin(list, current);
    else if (!game.browsing) list.scrollTop = list.scrollHeight;
  }, [game.moveNumber, game.moveList.length, game.browsing]);

  // A confirmation that is not given within a few seconds lapses.
  useEffect(() => {
    if (!confirmResign && !confirmDraw) return;
    const timer = setTimeout(() => {
      setConfirmResign(false);
      setConfirmDraw(false);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [confirmResign, confirmDraw]);

  const whitePieces = game.pieces.filter((p) => p.piece > 0).length;
  const blackPieces = game.pieces.length - whitePieces;
  const takenBy = (color: Color) => (color === 1 ? game.taken.white : game.taken.black);
  // Pieces on the board, as lichess shows "+2" next to the side that is ahead.
  const lead = (color: Color) => (color === 1 ? 1 : -1) * (whitePieces - blackPieces);
  let status = '';
  if (game.practice) {
    status = practiceText(game.practice, t);
  } else if (game.browsing) {
    status = t('browsing', { n: game.moveNumber, total: game.liveMoveNumber });
  } else if (game.result) {
    const outcome = outcomeText(game.result.winner, hotseat ? null : human, t);
    // "Game over: You lose. By resignation." The outcome may already end with "!".
    const head = `${t('gameOver')}: ${outcome}`;
    status = `${/[.!?]$/.test(head) ? head : `${head}.`} ${t(reasonKey(game.result))}`;
  } else if (game.thinking && !hotseat && game.turn !== human) status = t('thinking');
  else if (hotseat || game.turn === human) {
    if (game.confirming) status = t('confirmMove');
    else if (game.ambiguous) status = t('choosePath');
    else if (game.selection && game.selection.path.length > 0) status = t('continueChain');
    else if ((game.humanMoves[0]?.captures.length ?? 0) > 0) status = t('mustCapture');
    else if (hotseat) status = t(game.turn === 1 ? 'whiteToMove' : 'blackToMove');
    else status = t('yourTurn');
  }

  const player = (color: Color) => {
    const isHuman = color === human;
    const active = !over && game.turn === color;
    return (
      <div className={`player${active ? ' active' : ''}`}>
        <span className={`swatch ${color === 1 ? 'white' : 'black'}`} aria-hidden="true" />
        <span className="player-name">
          {hotseat ? t(color === 1 ? 'white' : 'black') : isHuman ? t('you') : t('computer')}
          {!hotseat && !isHuman && settings && <small> · {t(levelKey(settings.level))}</small>}
        </span>
        <span className="taken" aria-label={`${t('takenPieces')}: ${takenBy(color).length}`}>
          {takenBy(color).map((piece, i) => (
            <span
              key={i}
              className={`mini ${piece > 0 ? 'white' : 'black'}${piece === 2 || piece === -2 ? ' king' : ''}`}
              aria-hidden="true"
            />
          ))}
          {lead(color) > 0 && (
            <span className="lead" title={t('ahead', { n: lead(color) })}>
              +{lead(color)}
            </span>
          )}
        </span>
        {game.clock && <ClockFace view={game.clock} color={color} />}
      </div>
    );
  };

  const bottom: Color = hotseat ? (game.flipped ? -1 : 1) : human;
  const sideName = (color: Color) =>
    hotseat ? t(color === 1 ? 'white' : 'black') : color === human ? t('you') : t('computer');
  // Judged moves by their index in the game.
  const judged = new Map<number, ReviewedMove>();
  for (const move of game.review?.moves ?? []) judged.set(move.ply, move);

  // Moves in pairs, numbered like a score sheet: White's move, then Black's.
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < game.moveList.length; i += 2) {
    rows.push([game.moveList[i] ?? '', game.moveList[i + 1]]);
  }

  return (
    <aside className="panel">
      <section className="players" aria-label={t('you')}>
        {/* The side at the bottom of the board is listed last, nearest to it. */}
        {player(-bottom as Color)}
        {player(bottom)}
      </section>

      <p className={`status${over ? ' over' : ''}`} role="status" aria-live="polite">
        {game.thinking && !hotseat && game.turn !== human && (
          <span className="spinner" aria-hidden="true" />
        )}
        {status}
      </p>

      <section className="controls">
        <button type="button" className="primary" onClick={onNewGame}>
          {t('newGame')}
        </button>
        <button type="button" onClick={session.undo} disabled={!game.canUndo}>
          {t('undo')}
        </button>
        {over && !game.review ? (
          <button type="button" onClick={session.startReview}>
            {t('analyseGame')}
          </button>
        ) : (
          <button type="button" onClick={session.requestHint} disabled={!humanTurn}>
            {t('hint')}
          </button>
        )}
        {hotseat ? (
          <button
            type="button"
            className={confirmDraw ? 'danger' : ''}
            disabled={!humanTurn}
            onClick={() => {
              if (confirmDraw) {
                setConfirmDraw(false);
                session.offerDraw();
              } else setConfirmDraw(true);
            }}
          >
            {confirmDraw ? t('confirmDraw') : t('agreeDraw')}
          </button>
        ) : (
          <button
            type="button"
            onClick={session.offerDraw}
            disabled={!humanTurn || game.drawOffersLeft === 0}
            title={t('drawOffersLeft', { n: game.drawOffersLeft })}
          >
            {t('offerDraw')} <small>({game.drawOffersLeft})</small>
          </button>
        )}
        <button
          type="button"
          className={confirmResign ? 'danger' : ''}
          disabled={over || !settings}
          onClick={() => {
            if (confirmResign) {
              setConfirmResign(false);
              session.resign();
            } else setConfirmResign(true);
          }}
        >
          {confirmResign ? t('confirmResign') : t('resign')}
        </button>
        <button type="button" onClick={session.flip}>
          {t('flip')}
        </button>
        <button type="button" aria-pressed={game.showEvaluation} onClick={session.toggleEvaluation}>
          {t('evalBar')}
        </button>
      </section>

      {game.review && (
        <ReviewPanel
          review={game.review}
          moveNumber={game.moveNumber}
          white={sideName(1)}
          black={sideName(-1)}
          onPly={session.showPly}
          practice={game.practice}
          onPractice={{
            start: session.startPractice,
            next: session.nextPractice,
            solution: session.showSolution,
            stop: session.stopPractice,
          }}
        />
      )}

      <form
        className="notation"
        onSubmit={(event) => {
          event.preventDefault();
          const result = session.playNotation(typed);
          setTypedError(result === 'played' ? null : result);
          if (result === 'played') setTyped('');
        }}
      >
        <label htmlFor="notation-input">{t('typeMove')}</label>
        <div className="notation-row">
          <input
            id="notation-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            placeholder="c3-c4"
            disabled={over}
            aria-describedby="notation-help"
            aria-invalid={typedError !== null}
            onChange={(event) => {
              setTyped(event.target.value);
              setTypedError(null);
            }}
          />
          <button type="submit" disabled={over || typed.trim() === ''}>
            {t('play')}
          </button>
        </div>
        <p
          id="notation-help"
          className={typedError ? 'error' : 'help'}
          role={typedError ? 'alert' : undefined}
        >
          {typedError === 'illegal'
            ? t('illegalMove')
            : typedError === 'ambiguous'
              ? t('ambiguousMove')
              : typedError === 'not-your-turn'
                ? t('notYourTurn')
                : t('typeMoveHint')}
        </p>
      </form>

      <section className="moves">
        <h2>{t('moves')}</h2>
        {rows.length === 0 ? (
          <p className="empty">{t('noMoves')}</p>
        ) : (
          <ol ref={moveListEnd}>
            {rows.map(([white, black], i) => {
              // The position after White's move is ply 2i + 1, after Black's 2i + 2.
              const cell = (notation: string, ply: number) => {
                const move = judged.get(ply - 1);
                const symbol = move ? SYMBOLS[move.judgement] : undefined;
                const label =
                  move && move.judgement !== 'good' ? t(judgementKey(move.judgement)) : '';
                const bestShown = game.review?.bestMoves[ply - 1];
                const better =
                  move?.best && bestShown && move.best !== move.played
                    ? t('bestWas', { move: bestShown })
                    : '';
                return (
                  <button
                    type="button"
                    className={`move${move ? ` ${move.judgement}` : ''}`}
                    aria-current={game.moveNumber === ply}
                    title={[label, better].filter(Boolean).join('. ') || undefined}
                    onClick={() => {
                      session.showPly(ply);
                    }}
                  >
                    {notation}
                    {symbol && (
                      <span className="symbol" aria-label={label}>
                        {symbol}
                      </span>
                    )}
                  </button>
                );
              };
              return (
                <li key={i}>
                  {cell(white, 2 * i + 1)}
                  {black !== undefined && cell(black, 2 * i + 2)}
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
            disabled={game.moveNumber === 0}
          >
            ⏮
          </button>
          <button
            type="button"
            aria-label={t('previousMove')}
            onClick={session.showPrevious}
            disabled={game.moveNumber === 0}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label={t('nextMove')}
            onClick={session.showNext}
            disabled={!game.browsing}
          >
            ▶
          </button>
          <button
            type="button"
            aria-label={t('lastMove')}
            onClick={session.showLive}
            disabled={!game.browsing}
          >
            ⏭
          </button>
        </div>
        {(over || hotseat) && game.moveList.length > 0 && (
          <a
            className="open-analysis"
            href={routeHash({
              page: 'analysis',
              fen: INITIAL_FEN,
              moves: session.landingMoves(),
              ply: game.moveNumber,
            })}
          >
            {t('openInAnalysis')}
          </a>
        )}
        {game.browsing && (
          <button type="button" className="primary back-to-game" onClick={session.showLive}>
            {t('backToGame')}
            {game.missedMoves > 0 && (
              <span className="badge">{t('newMoves', { n: game.missedMoves })}</span>
            )}
          </button>
        )}
      </section>

      {game.evaluation && !game.evaluation.final && (
        <p className="engine">
          {t('analysis')}: {t('depth', { n: game.evaluation.depth })} ·{' '}
          {formatEvaluation(game.evaluation)}
          {game.evaluation.pv.length > 0 && (
            <span className="pv"> · {game.evaluation.pv.slice(0, 4).join(' ')}</span>
          )}
        </p>
      )}
    </aside>
  );
}

/** What the status line says during "Learn from your mistakes". */
function practiceText(practice: Practice, t: Translate): string {
  const side = t(practice.side === 1 ? 'white' : 'black');
  const tried = practice.tried ?? '';
  const best = practice.best ?? '';
  switch (practice.status) {
    case 'try':
      return t('practiceTry', { move: practice.played, side });
    case 'checking':
      return t('practiceChecking');
    case 'right':
      return t('practiceRight', { move: tried });
    case 'good':
      return t('practiceGood', { move: tried, best });
    case 'wrong':
      return t('practiceWrong', { move: tried });
    case 'shown':
      return t('practiceShown', { best });
    case 'done':
      return practice.total === 0 ? t('practiceNone') : t('practiceDone');
  }
}
