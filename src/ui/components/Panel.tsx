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

  useEffect(() => {
    const list = moveListEnd.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [game.moveList.length]);

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
  if (game.result) {
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
            {rows.map(([white, black], i) => (
              <li key={i}>
                <span className="move">{white}</span>
                {black && <span className="move">{black}</span>}
              </li>
            ))}
          </ol>
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
