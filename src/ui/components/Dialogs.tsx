import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Color, GameResult } from '../../engine';
import type { Level } from '../../ai';
import { LEVELS } from '../../ai';
import { levelKey, reasonKey, useI18n } from '../i18n';
import type { Settings } from '../storage';

function Dialog({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button, input')?.focus();
  }, []);
  return (
    <div className="backdrop">
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
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
    <Dialog title={t('newGame')}>
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
    <Dialog title={title}>
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
