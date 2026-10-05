import { useEffect, useState } from 'react';
import type { Color } from '../../engine';
import type { ClockView } from '../clock';
import { LOW_TIME_MS, formatTime, shownTime } from '../clock';
import { useI18n } from '../i18n';

/** One side's clock. It redraws itself while running; the session only keeps the times. */
export function ClockFace({ view, color }: { view: ClockView; color: Color }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => performance.now());
  const running = view.running === color && !view.paused;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setNow(performance.now());
    }, 100);
    return () => {
      clearInterval(timer);
    };
  }, [running]);

  const ms = shownTime(view, color, now);
  const low = ms < LOW_TIME_MS;
  return (
    <span
      className={`clock${running ? ' running' : ''}${low ? ' low' : ''}`}
      role="timer"
      aria-label={t('clockOf', { side: t(color === 1 ? 'white' : 'black') })}
    >
      {formatTime(ms)}
    </span>
  );
}
