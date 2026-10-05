import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Color, GameResult } from '../../engine';
import type { Level } from '../../ai';
import { LEVELS } from '../../ai';
import type { Language, MessageKey } from '../i18n';
import { LANGUAGES, levelKey, reasonKey, useI18n } from '../i18n';
import type { Preferences } from '../preferences';
import { ANIMATION_SPEEDS, BOARDS, PIECE_STYLES, THEMES } from '../preferences';
import type { Settings } from '../storage';

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]';

/**
 * A modal dialog: focuses its first control, keeps Tab inside, closes on Escape when it can
 * be closed, and gives the focus back to where it was when it closes.
 */
function Dialog({
  title,
  children,
  onClose,
  className,
}: {
  title: string;
  children: ReactNode;
  onClose?: (() => void) | null;
  className?: string;
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
        className={className ? `dialog ${className}` : 'dialog'}
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

const LANGUAGE_NAMES: Record<Language, string> = { tr: 'Türkçe', en: 'English' };

/** Display, game and sound preferences, applied as they are changed. */
export function SettingsDialog({
  preferences,
  onChange,
  showEvaluation,
  onToggleEvaluation,
  language,
  onLanguage,
  onClose,
}: {
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
  showEvaluation: boolean;
  onToggleEvaluation: () => void;
  language: Language;
  onLanguage: (language: Language) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    onChange({ ...preferences, [key]: value });
  };

  const select = <K extends 'theme' | 'board' | 'pieces' | 'animation'>(
    key: K,
    label: MessageKey,
    options: readonly Preferences[K][],
    prefix: string,
  ) => (
    <label className="setting">
      <span>{t(label)}</span>
      <select
        value={preferences[key]}
        onChange={(event) => {
          const value = options.find((option) => option === event.target.value);
          if (value) set(key, value);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {t(`${prefix}.${option}` as MessageKey)}
          </option>
        ))}
      </select>
    </label>
  );

  const toggle = (checked: boolean, label: MessageKey, onToggle: () => void, hint?: MessageKey) => (
    <label className="setting check">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span>
        {t(label)}
        {hint && <small>{t(hint)}</small>}
      </span>
    </label>
  );
  const flag = (
    key: 'coordinates' | 'legalMoves' | 'lastMove' | 'confirmMoves',
    label: MessageKey,
    hint?: MessageKey,
  ) =>
    toggle(
      preferences[key],
      label,
      () => {
        set(key, !preferences[key]);
      },
      hint,
    );

  return (
    <Dialog title={t('settings')} onClose={onClose} className="settings">
      <fieldset>
        <legend>{t('settings.appearance')}</legend>
        {select('theme', 'settings.theme', THEMES, 'theme')}
        {select('board', 'settings.board', BOARDS, 'board')}
        {select('pieces', 'settings.pieces', PIECE_STYLES, 'pieces')}
        <label className="setting">
          <span>{t('language')}</span>
          <select
            value={language}
            onChange={(event) => {
              const value = LANGUAGES.find((code) => code === event.target.value);
              if (value) onLanguage(value);
            }}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>{t('settings.display')}</legend>
        {flag('coordinates', 'settings.coordinates')}
        {flag('legalMoves', 'settings.legalMoves')}
        {flag('lastMove', 'settings.lastMove')}
        {toggle(showEvaluation, 'settings.evaluation', onToggleEvaluation)}
        {select('animation', 'settings.animation', ANIMATION_SPEEDS, 'animation')}
        <p className="setting-hint">{t('settings.animationHint')}</p>
      </fieldset>
      <fieldset>
        <legend>{t('settings.play')}</legend>
        {flag('confirmMoves', 'settings.confirmMoves', 'settings.confirmMovesHint')}
      </fieldset>
      <fieldset>
        <legend>{t('settings.sound')}</legend>
        <label className="setting">
          <span>{t('settings.volume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(preferences.volume * 100)}
            disabled={preferences.muted}
            onChange={(event) => {
              set('volume', Number(event.target.value) / 100);
            }}
          />
        </label>
        {toggle(preferences.muted, 'settings.mute', () => {
          set('muted', !preferences.muted);
        })}
      </fieldset>
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
