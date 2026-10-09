import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Timing } from '../animation';
import { useI18n } from '../i18n';
import { LearnSession } from '../learn-session';
import { EXERCISES, LESSONS } from '../lessons';
import { Board } from './Board';

const NONE: readonly never[] = [];

/**
 * The rules tutorial (like lichess /learn): lessons on moving, capturing, promotion and
 * kings, then the TÜDAF rulebook examples, one exercise at a time on the board.
 */
export function LearnView({ storage, timing }: { storage: Storage; timing: Timing }) {
  const { t } = useI18n();
  const [session] = useState(() => {
    // Start from the first exercise not solved yet.
    const probe = new LearnSession(storage);
    const solved = probe.getSnapshot().solved;
    const first = EXERCISES.findIndex(({ exercise }) => !solved.has(exercise.id));
    return first > 0 ? new LearnSession(storage, first) : probe;
  });
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => session.stop, [session]);

  const { exercise, status } = state;
  const side = t(exercise.fen.trim().toUpperCase().startsWith('B') ? 'black' : 'white');
  let message = t(exercise.task, { side });
  if (status === 'right') message = `${t('learnRight')} ${t(exercise.rule)}`;
  else if (status === 'wrong') message = t('learnWrong');
  else if (status === 'missed') message = t('learnMissed');

  return (
    <main className="layout learn-page">
      <div className="board-area">
        <div className="board-wrap">
          <Board
            pieces={state.pieces}
            captured={state.captured}
            lastMove={state.lastMove}
            moveNumber={state.moveNumber}
            legalMoves={state.legalMoves}
            selection={state.selection}
            hint={null}
            flipped={false}
            premove={null}
            premoveFrom={null}
            premoveTargets={NONE}
            premovable={NONE}
            ghosts={state.ghosts}
            timing={timing}
            hideTargets={exercise.hideTargets === true}
            onSquare={session.clickSquare}
            onCancelPremove={() => undefined}
          />
        </div>
      </div>

      <aside className="panel">
        <section className="lesson">
          <h2>
            {t(state.lesson.title)}{' '}
            <span>{t('learnProgress', { n: state.index + 1, total: state.total })}</span>
          </h2>
          <p className={`lesson-text ${status}`} role="status" aria-live="polite">
            {message}
          </p>
          <div className="lesson-actions">
            <button type="button" onClick={session.previous} disabled={state.index === 0}>
              {t('previous')}
            </button>
            <button type="button" onClick={session.retry} disabled={status === 'try'}>
              {t('retry')}
            </button>
            <button
              type="button"
              className={status === 'right' ? 'primary' : ''}
              onClick={session.next}
              disabled={state.index === state.total - 1}
            >
              {t('next')}
            </button>
          </div>
        </section>

        <nav className="lesson-list" aria-label={t('lessons')}>
          <ol>
            {LESSONS.map((lesson) => (
              <li key={lesson.id}>
                <span className="lesson-name">{t(lesson.title)}</span>
                <span className="steps">
                  {lesson.exercises.map((item) => {
                    const index = EXERCISES.findIndex((entry) => entry.exercise === item);
                    const done = state.solved.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`step${done ? ' done' : ''}`}
                        aria-current={index === state.index ? 'step' : undefined}
                        aria-label={t('exerciseLabel', {
                          n: index + 1,
                          state: done ? t('solved') : t('notSolved'),
                        })}
                        onClick={() => {
                          session.goTo(index);
                        }}
                      >
                        {done ? '✓' : index + 1}
                      </button>
                    );
                  })}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
    </main>
  );
}
