import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Color, GameResult } from '../../engine';
import type { Level } from '../../ai';
import { LEVELS } from '../../ai';
import { levelKey, reasonKey, useI18n } from '../i18n';
import type { Settings } from '../storage';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]';

/**
 * A modal dialog: focuses its first control, keeps Tab inside, closes on Escape when it can
 * be closed, and gives the focus back to where it was when it closes.
 */
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: (() => void) | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="backdrop">
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Keyboard shortcuts, opened with `?`. */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const rows: [string, string][] = [
    ['← → Home End', t('shortcutBrowse')],
    ['f', t('flip')],
    ['h', t('hint')],
    ['u', t('undo')],
    ['n', t('newGame')],
    ['Esc', t('shortcutCancel')],
    ['?', t('shortcutHelp')],
  ];
  return (
    <Dialog title={t('shortcuts')} onClose={onClose}>
      <dl className="shortcuts">
        {rows.map(([keys, label]) => (
          <div key={keys}>
            <dt>
              {keys.split(' ').map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
      <div className="actions">
        <button type="button" className="primary" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </Dialog>
  );
}

type SideChoice = Color | 'random';

export function NewGameDialog({
  initial,
  onStart,
  onCancel,
}: {
  initial: Settings | null;
  onStart: (settings: Settings) => void;
  onCancel: (() => void) | null;
}) {
  const { t } = useI18n();
  const [side, setSide] = useState<SideChoice>(initial?.human ?? 1);
  const [level, setLevel] = useState<Level>(initial?.level ?? 'medium');

  const sides: [SideChoice, string][] = [
    [1, t('white')],
    [-1, t('black')],
    ['random', t('random')],
  ];

  return (
    <Dialog title={t('newGame')} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const human: Color = side === 'random' ? (Math.random() < 0.5 ? 1 : -1) : side;
          onStart({ human, level });
        }}
      >
        <fieldset>
          <legend>{t('playAs')}</legend>
          <div className="choices">
            {sides.map(([value, label]) => (
              <label key={String(value)} className="choice">
                <input
                  type="radio"
                  name="side"
                  checked={side === value}
                  onChange={() => {
                    setSide(value);
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('level')}</legend>
          <div className="choices levels">
            {LEVELS.map((value) => (
              <label key={value} className="choice">
                <input
                  type="radio"
                  name="level"
                  checked={level === value}
                  onChange={() => {
                    setLevel(value);
                  }}
                />
                <span>{t(levelKey(value))}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="actions">
          {onCancel && (
            <button type="button" onClick={onCancel}>
              {t('cancel')}
            </button>
          )}
          <button type="submit" className="primary">
            {t('start')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function GameOverDialog({
  result,
  human,
  onPlayAgain,
  onClose,
}: {
  result: GameResult;
  human: Color;
  onPlayAgain: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const title =
    result.winner === null ? t('draw') : result.winner === human ? t('youWin') : t('youLose');
  return (
    <Dialog title={title} onClose={onClose}>
      <p>{t(reasonKey(result))}</p>
      <div className="actions">
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
        <button type="button" className="primary" onClick={onPlayAgain}>
          {t('playAgain')}
        </button>
      </div>
    </Dialog>
  );
}
