import { useState } from 'react';
import { calendarName, canEdit, type GCalendar } from '../lib/types';
import styles from './CalendarList.module.css';

interface Props {
  calendars: GCalendar[];
  selected: string[];
  onToggle: (id: string) => void;
  /** Event opacity per calendar id, 0–1 (missing = 1). */
  alpha: Record<string, number>;
  onAlpha: (id: string, value: number) => void;
}

export default function CalendarList({ calendars, selected, onToggle, alpha, onAlpha }: Props) {
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const mine = calendars.filter(canEdit).sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
  const others = calendars.filter((c) => !canEdit(c));

  const group = (title: string, cals: GCalendar[]) =>
    cals.length > 0 && (
      <section className={styles.group}>
        <h2 className={styles.heading}>{title}</h2>
        {cals.map((c) => {
          const a = alpha[c.id] ?? 1;
          const open = adjusting === c.id;
          return (
            <div key={c.id} className={styles.row}>
              <div className={styles.item}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => onToggle(c.id)}
                    style={{ accentColor: c.backgroundColor }}
                  />
                  <span className={styles.name}>{calendarName(c)}</span>
                </label>
                {!canEdit(c) && <span className={styles.badge} title="You can't edit events in this calendar">view</span>}
                <button
                  type="button"
                  className={`${styles.alphaButton} ${a < 1 || open ? styles.shown : ''}`}
                  onClick={() => setAdjusting(open ? null : c.id)}
                  aria-expanded={open}
                  title="Opacity on the grid"
                  aria-label={`Opacity of ${calendarName(c)}`}
                >
                  {a < 1 ? `${Math.round(a * 100)}%` : '◐'}
                </button>
              </div>
              {open && (
                <div className={styles.slider}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={a}
                    onChange={(e) => onAlpha(c.id, Number(e.target.value))}
                    style={{ accentColor: c.backgroundColor }}
                    aria-label={`Opacity of ${calendarName(c)}`}
                    autoFocus
                  />
                  {a < 1 && (
                    <button type="button" className={styles.reset} onClick={() => onAlpha(c.id, 1)}>Reset</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    );

  return (
    <nav className={styles.list} aria-label="Calendars">
      {calendars.length === 0 && <p className={styles.empty}>No calendars yet.</p>}
      {group('My calendars', mine)}
      {group('Other calendars', others)}
    </nav>
  );
}
