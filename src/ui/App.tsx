import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AiClient, AnalysisClient } from '../ai';
import { Board } from './components/Board';
import { EvalBar } from './components/EvalBar';
import {
  GameOverDialog,
  NewGameDialog,
  SettingsDialog,
  ShortcutsDialog,
} from './components/Dialogs';
import { Panel } from './components/Panel';
import type { Language } from './i18n';
import { I18nContext, LANGUAGES, detectLanguage, translator } from './i18n';
import { timing } from './animation';
import { describeEvent } from './announce';
import type { Preferences } from './preferences';
import { animationScale, applyPreferences, loadPreferences, savePreferences } from './preferences';
import { GameSession } from './session';
import { SoundPlayer } from './sound';
import { loadLanguage, saveLanguage } from './storage';

const REPOSITORY = 'https://github.com/ardacagankeser/turkish-draughts';

interface AppProps {
  /** Creates the AI client; tests pass one backed by a fake worker. */
  readonly createAi?: () => AiClient;
  /** Creates the live analysis client; tests pass one backed by a fake worker. */
  readonly createAnalysis?: () => AnalysisClient;
  /** Plays sounds; tests pass one without audio. */
  readonly createSound?: () => SoundPlayer;
  readonly storage?: Storage;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => undefined;
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches;

function initialLanguage(storage: Storage): Language {
  const saved = loadLanguage(storage);
  return saved === 'tr' || saved === 'en' ? saved : detectLanguage();
}

export function App({
  createAi,
  createAnalysis,
  createSound,
  storage = globalThis.localStorage,
}: AppProps) {
  const [session] = useState(
    () =>
      new GameSession(
        createAi?.() ?? new AiClient(),
        storage,
        createAnalysis?.() ?? new AnalysisClient(),
      ),
  );
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    session.start();
    return session.stop;
  }, [session]);

  const [language, setLanguage] = useState<Language>(() => initialLanguage(storage));
  const i18n = useMemo(() => ({ t: translator(language), language }), [language]);
  const { t } = i18n;

  const [choosing, setChoosing] = useState(game.settings === null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sound] = useState(() => createSound?.() ?? new SoundPlayer());
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences(storage));
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion);
  const boardTiming = useMemo(
    () => timing(animationScale(preferences.animation), reducedMotion),
    [preferences.animation, reducedMotion],
  );
  const human = game.settings?.human ?? 1;
  // Announcements and sounds speak of White and Black when two players share the device.
  const listener = game.settings?.opponent === 'human' ? null : human;

  useEffect(() => {
    applyPreferences(document.documentElement, preferences);
    savePreferences(preferences, storage);
    sound.setVolume(preferences.volume, preferences.muted);
    session.setConfirmMoves(preferences.confirmMoves);
  }, [preferences, session, sound, storage]);

  // Browsers allow audio only after a user gesture.
  useEffect(() => {
    const unlock = () => {
      sound.unlock();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [sound]);

  // One sound per game event (move, capture, promotion, start, end).
  useEffect(() => {
    if (game.event) sound.play(game.event, listener, boardTiming);
    // Only when a new event arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.event]);
  // The game-over dialog shows once per ending, until the player closes it.
  // A game that was already over when the page loaded does not reopen the dialog;
  // the status line shows its result.
  const [closedResult, setClosedResult] = useState(() => session.getSnapshot().resultId);

  // ← → Home End browse the moves, as on lichess. The board's own arrow-key focus
  // movement, text fields and open dialogs keep their keys.
  useEffect(() => {
    const browse: Record<string, () => void> = {
      ArrowLeft: session.showPrevious,
      ArrowRight: session.showNext,
      Home: session.showFirst,
      End: session.showLive,
    };
    const letters: Record<string, () => void> = {
      f: session.flip,
      h: session.requestHint,
      u: session.undo,
      n: () => {
        setChoosing(true);
      },
      '?': () => {
        setHelpOpen(true);
      },
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [role="dialog"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      // The board's own arrow keys move the focus between squares.
      const action =
        browse[event.key] && !target?.closest('.board') ? browse[event.key] : letters[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [session]);

  // The clocks stop while the page is hidden (another tab, a locked phone).
  useEffect(() => {
    const onVisibility = () => {
      session.setHidden(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('title');
    saveLanguage(language, storage);
  }, [language, storage, t]);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <header className="header">
          <div>
            <h1>{t('title')}</h1>
            <p className="subtitle">{t('subtitle')}</p>
          </div>
          <div className="header-tools">
            <button
              type="button"
              className="icon-button"
              aria-pressed={!preferences.muted}
              aria-label={t('sound')}
              title={t('sound')}
              onClick={() => {
                setPreferences({ ...preferences, muted: !preferences.muted });
              }}
            >
              {preferences.muted ? '🔇' : '🔊'}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t('settings')}
              title={t('settings')}
              onClick={() => {
                setSettingsOpen(true);
              }}
            >
              ⚙
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t('shortcuts')}
              title={t('shortcuts')}
              onClick={() => {
                setHelpOpen(true);
              }}
            >
              ?
            </button>
            <div className="language" role="group" aria-label={t('language')}>
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={language === code}
                  onClick={() => {
                    setLanguage(code);
                  }}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Screen readers hear each move, capture, promotion and result. */}
        <div className="visually-hidden" aria-live="polite" aria-atomic="true">
          {game.event && <span key={game.event.id}>{describeEvent(game.event, listener, t)}</span>}
        </div>

        <main className="layout">
          <div className="board-area">
            <div className={`board-wrap${game.browsing ? ' browsing' : ''}`}>
              <Board
                pieces={game.pieces}
                captured={game.captured}
                lastMove={game.lastMove}
                moveNumber={game.moveNumber}
                legalMoves={game.humanMoves}
                selection={game.selection}
                hint={game.hint}
                flipped={game.flipped}
                premove={game.premove}
                premoveFrom={game.premoveFrom}
                premoveTargets={game.premoveTargets}
                premovable={game.premovable}
                ghosts={game.ghosts}
                timing={boardTiming}
                onSquare={session.clickSquare}
                onCancelPremove={session.cancelPremove}
              />
              {game.notice && (
                <div className={`notice ${game.notice}`} role="status">
                  {t(game.notice)}
                </div>
              )}
            </div>
            {game.showEvaluation && <EvalBar evaluation={game.evaluation} flipped={game.flipped} />}
          </div>
          <Panel
            game={game}
            session={session}
            onNewGame={() => {
              setChoosing(true);
            }}
          />
        </main>

        <footer className="footer">
          <a href={`${REPOSITORY}/blob/main/docs/RULES.md`}>{t('rules')}</a>
          <span aria-hidden="true">·</span>
          <a href={REPOSITORY}>GitHub</a>
        </footer>

        {settingsOpen && (
          <SettingsDialog
            preferences={preferences}
            onChange={setPreferences}
            showEvaluation={game.showEvaluation}
            onToggleEvaluation={session.toggleEvaluation}
            language={language}
            onLanguage={setLanguage}
            onClose={() => {
              setSettingsOpen(false);
            }}
          />
        )}
        {helpOpen && (
          <ShortcutsDialog
            onClose={() => {
              setHelpOpen(false);
            }}
          />
        )}
        {choosing && (
          <NewGameDialog
            initial={game.settings}
            onStart={(settings) => {
              setChoosing(false);
              session.newGame(settings);
            }}
            onCancel={
              game.settings
                ? () => {
                    setChoosing(false);
                  }
                : null
            }
          />
        )}
        {!choosing && game.result && game.settings && closedResult !== game.resultId && (
          <GameOverDialog
            result={game.result}
            human={listener}
            onPlayAgain={() => {
              setChoosing(true);
            }}
            onClose={() => {
              setClosedResult(game.resultId);
            }}
          />
        )}
      </div>
    </I18nContext.Provider>
  );
}
