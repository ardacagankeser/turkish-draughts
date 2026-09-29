import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AiClient, AnalysisClient } from '../ai';
import { Board } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { GameOverDialog, NewGameDialog } from './components/Dialogs';
import { Panel } from './components/Panel';
import type { Language } from './i18n';
import { I18nContext, LANGUAGES, detectLanguage, translator } from './i18n';
import { GameSession } from './session';
import { loadLanguage, saveLanguage } from './storage';

const REPOSITORY = 'https://github.com/ardacagankeser/turkish-draughts';

interface AppProps {
  /** Creates the AI client; tests pass one backed by a fake worker. */
  readonly createAi?: () => AiClient;
  /** Creates the live analysis client; tests pass one backed by a fake worker. */
  readonly createAnalysis?: () => AnalysisClient;
  readonly storage?: Storage;
}

function initialLanguage(storage: Storage): Language {
  const saved = loadLanguage(storage);
  return saved === 'tr' || saved === 'en' ? saved : detectLanguage();
}

export function App({ createAi, createAnalysis, storage = globalThis.localStorage }: AppProps) {
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
  // The game-over dialog shows once per ending, until the player closes it.
  const [closedResult, setClosedResult] = useState(0);

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
        </header>

        <main className="layout">
          <div className="board-area">
            <div className="board-wrap">
              <Board
                pieces={game.pieces}
                captured={game.captured}
                lastMove={game.lastMove}
                moveNumber={game.moveNumber}
                legalMoves={game.humanMoves}
                selection={game.selection}
                hint={game.hint}
                flipped={game.flipped}
                onSquare={session.clickSquare}
              />
              {game.notice && (
                <div className={`notice ${game.notice}`} role="status">
                  {t(game.notice)}
                </div>
              )}
            </div>
            {(game.showEvaluation || game.evaluation?.final) && (
              <EvalBar evaluation={game.evaluation} flipped={game.flipped} />
            )}
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
            human={game.settings.human}
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
