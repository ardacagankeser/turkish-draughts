import { useEffect, useRef, useState } from 'react';
import type { Color } from '../../engine';
import { formatEvaluation } from '../evaluation';
import type { GameSession, Snapshot } from '../session';
import { levelKey, reasonKey, useI18n } from '../i18n';

interface PanelProps {
  readonly game: Snapshot;
  readonly session: GameSession;
  readonly onNewGame: () => void;
}

export function Panel({ game, session, onNewGame }: PanelProps) {
  const { t } = useI18n();
  const [confirmResign, setConfirmResign] = useState(false);
  const moveListEnd = useRef<HTMLOListElement>(null);
  const settings = game.settings;
  const human: Color = settings?.human ?? 1;
  const over = game.result !== null;
  const humanTurn = !over && game.turn === human && !game.thinking;

  // Keep the move shown in view: the newest one while playing, the chosen one while browsing.
  useEffect(() => {
    const list = moveListEnd.current;
    if (!list) return;
    const current = list.querySelector<HTMLElement>('[aria-current="true"]');
    if (current && typeof current.scrollIntoView === 'function') {
      current.scrollIntoView({ block: 'nearest' });
    } else if (!game.browsing) {
      list.scrollTop = list.scrollHeight;
    }
  }, [game.moveNumber, game.moveList.length, game.browsing]);

  useEffect(() => {
    if (!confirmResign) return;
    const timer = setTimeout(() => {
      setConfirmResign(false);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [confirmResign]);

  const whitePieces = game.pieces.filter((p) => p.piece > 0).length;
  const blackPieces = game.pieces.length - whitePieces;
  const capturedBy = (color: Color) => 16 - (color === 1 ? blackPieces : whitePieces);

  let status = '';
  if (game.browsing) {
    status = t('browsing', { n: game.moveNumber, total: game.liveMoveNumber });
  } else if (game.result) {
    const outcome =
      game.result.winner === null
        ? t('draw')
        : game.result.winner === human
          ? t('youWin')
          : t('youLose');
    status = `${t('gameOver')} — ${outcome} · ${t(reasonKey(game.result))}`;
  } else if (game.thinking && game.turn !== human) status = t('thinking');
  else if (game.turn === human) {
    if (game.selection && game.selection.path.length > 0) status = t('continueChain');
    else if ((game.humanMoves[0]?.captures.length ?? 0) > 0) status = t('mustCapture');
    else status = t('yourTurn');
  }

  const player = (color: Color) => {
    const isHuman = color === human;
    const active = !over && game.turn === color;
    return (
      <div className={`player${active ? ' active' : ''}`}>
        <span className={`swatch ${color === 1 ? 'white' : 'black'}`} aria-hidden="true" />
        <span className="player-name">
          {isHuman ? t('you') : t('computer')}
          {!isHuman && settings && <small> · {t(levelKey(settings.level))}</small>}
        </span>
        <span className="player-captured" title={t('captured')}>
          {capturedBy(color)}
        </span>
      </div>
    );
  };

  // Moves in pairs, numbered like a score sheet: White's move, then Black's.
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < game.moveList.length; i += 2) {
    rows.push([game.moveList[i] ?? '', game.moveList[i + 1]]);
  }

  return (
    <aside className="panel">
      <section className="players" aria-label={t('you')}>
        {player(-human as Color)}
        {player(human)}
      </section>

      <p className={`status${over ? ' over' : ''}`} role="status" aria-live="polite">
        {game.thinking && game.turn !== human && <span className="spinner" aria-hidden="true" />}
        {status}
      </p>

      <section className="controls">
        <button type="button" className="primary" onClick={onNewGame}>
          {t('newGame')}
        </button>
        <button type="button" onClick={session.undo} disabled={!game.canUndo}>
          {t('undo')}
        </button>
        <button type="button" onClick={session.requestHint} disabled={!humanTurn}>
          {t('hint')}
        </button>
        <button
          type="button"
          onClick={session.offerDraw}
          disabled={!humanTurn || game.drawOffersLeft === 0}
          title={t('drawOffersLeft', { n: game.drawOffersLeft })}
        >
          {t('offerDraw')} <small>({game.drawOffersLeft})</small>
        </button>
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

      <section className="moves">
        <h2>{t('moves')}</h2>
        {rows.length === 0 ? (
          <p className="empty">{t('noMoves')}</p>
        ) : (
          <ol ref={moveListEnd}>
            {rows.map(([white, black], i) => {
              // The position after White's move is ply 2i + 1, after Black's 2i + 2.
              const cell = (notation: string, ply: number) => (
                <button
                  type="button"
                  className="move"
                  aria-current={game.moveNumber === ply}
                  onClick={() => {
                    session.showPly(ply);
                  }}
                >
                  {notation}
                </button>
              );
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
