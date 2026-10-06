import { useMemo, useState } from 'react';
import type { Color, Piece } from '../../engine';
import { Board as Position, parseFen, toFen } from '../../engine';
import { timing } from '../animation';
import type { Problem, Tool } from '../editor';
import { TOOLS, place, problems, withTurn } from '../editor';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import { piecesFromBoard } from '../pieces';
import { navigate } from '../route';
import { Board } from './Board';

const NONE: readonly never[] = [];
/** Pieces are put down, not moved: nothing to animate. */
const STILL = timing(0);

const TOOL_LABEL: Record<string, MessageKey> = {
  '1': 'whiteMan',
  '2': 'whiteKing',
  '-1': 'blackMan',
  '-2': 'blackKing',
  '0': 'erase',
};

const PROBLEM_LABEL: Record<Problem, MessageKey> = {
  noWhite: 'editorNoWhite',
  noBlack: 'editorNoBlack',
  over: 'editorOver',
};

function readFen(fen: string): Position | null {
  try {
    return parseFen(fen);
  } catch {
    return null;
  }
}

/**
 * The position editor (lichess /editor): put men and kings on the board, choose the side to
 * move, then analyse the position. A link with an invalid FEN opens the starting position.
 */
export function EditorView({ fen }: { fen: string }) {
  const { t, language } = useI18n();
  // Piece names are written for the middle of a sentence ("c3, white man").
  const toolName = (piece: Piece) => {
    const text = t(TOOL_LABEL[String(piece)] ?? 'erase');
    return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
  };
  const [position, setPosition] = useState<Position>(() => readFen(fen) ?? Position.initial());
  const [tool, setTool] = useState<Tool>(1);
  const [flipped, setFlipped] = useState(false);
  const [fenText, setFenText] = useState<string | null>(null);
  const [fenError, setFenError] = useState(false);

  const pieces = useMemo(() => piecesFromBoard(position), [position]);
  const currentFen = toFen(position);
  const found = problems(position);

  const update = (next: Position) => {
    setPosition(next);
    setFenText(null);
    setFenError(false);
  };

  const sides: [Color, MessageKey][] = [
    [1, 'white'],
    [-1, 'black'],
  ];

  return (
    <main className="layout editor-page">
      <div className="board-area">
        <div className="board-wrap">
          <Board
            pieces={pieces}
            captured={NONE}
            lastMove={null}
            moveNumber={0}
            legalMoves={NONE}
            selection={null}
            hint={null}
            flipped={flipped}
            premove={null}
            premoveFrom={null}
            premoveTargets={NONE}
            premovable={NONE}
            ghosts={NONE}
            timing={STILL}
            onSquare={(square) => {
              update(place(position, square, tool));
            }}
            onCancelPremove={() => undefined}
          />
        </div>
      </div>

      <aside className="panel">
        <section className="editor-tools">
          <h2>{t('editorPieces')}</h2>
          <div className="tools" role="radiogroup" aria-label={t('editorPieces')}>
            {TOOLS.map((piece: Piece) => (
              <button
                key={piece}
                type="button"
                role="radio"
                aria-checked={tool === piece}
                aria-label={toolName(piece)}
                title={toolName(piece)}
                className="tool"
                onClick={() => {
                  setTool(piece);
                }}
              >
                {piece === 0 ? (
                  <span aria-hidden="true">✕</span>
                ) : (
                  <span
                    className={`tool-piece ${piece > 0 ? 'white' : 'black'}${Math.abs(piece) === 2 ? ' king' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
          <p className="setting-hint">{t('editorHint')}</p>

          <h2>{t('editorTurn')}</h2>
          <div className="choices two">
            {sides.map(([color, label]) => (
              <label key={color} className="choice">
                <input
                  type="radio"
                  name="turn"
                  checked={position.turn === color}
                  onChange={() => {
                    update(withTurn(position, color));
                  }}
                />
                <span>{t(label)}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="controls">
          <button
            type="button"
            className="primary"
            disabled={found.length > 0}
            onClick={() => {
              navigate({ page: 'analysis', fen: currentFen, moves: [], ply: null });
            }}
          >
            {t('analysePosition')}
          </button>
          <button
            type="button"
            onClick={() => {
              update(Position.initial());
            }}
          >
            {t('startPosition')}
          </button>
          <button
            type="button"
            onClick={() => {
              update(new Position(undefined, position.turn));
            }}
          >
            {t('clearBoard')}
          </button>
          <button
            type="button"
            onClick={() => {
              setFlipped(!flipped);
            }}
          >
            {t('flip')}
          </button>
        </section>

        {found.length > 0 && (
          <p className="status editor-problems" role="status">
            {found.map((problem) => t(PROBLEM_LABEL[problem])).join(' ')}
          </p>
        )}

        <section className="share">
          <label htmlFor="editor-fen">FEN</label>
          <div className="share-row">
            <input
              id="editor-fen"
              type="text"
              spellCheck={false}
              autoComplete="off"
              value={fenText ?? currentFen}
              onChange={(event) => {
                setFenText(event.target.value);
                setFenError(false);
              }}
            />
            <button
              type="button"
              disabled={fenText === null}
              onClick={() => {
                const read = readFen(fenText ?? '');
                if (read) update(read);
                else setFenError(true);
              }}
            >
              {t('load')}
            </button>
          </div>
          {fenError && (
            <p className="error" role="alert">
              {t('invalidFen')}
            </p>
          )}
        </section>

        <a className="back-link" href="#/">
          {t('backToPlay')}
        </a>
      </aside>
    </main>
  );
}
