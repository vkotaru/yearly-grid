import { calendarName, canEdit, type GCalendar } from '../lib/types';
import styles from './CalendarList.module.css';

interface Props {
  calendars: GCalendar[];
  selected: string[];
  onToggle: (id: string) => void;
}

export default function CalendarList({ calendars, selected, onToggle }: Props) {
  const mine = calendars.filter(canEdit).sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
  const others = calendars.filter((c) => !canEdit(c));

  const group = (title: string, cals: GCalendar[]) =>
    cals.length > 0 && (
      <section className={styles.group}>
        <h2 className={styles.heading}>{title}</h2>
        {cals.map((c) => (
          <label key={c.id} className={styles.item}>
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={() => onToggle(c.id)}
              style={{ accentColor: c.backgroundColor }}
            />
            <span className={styles.name}>{calendarName(c)}</span>
            {!canEdit(c) && <span className={styles.badge} title="You can't edit events in this calendar">view</span>}
          </label>
        ))}
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
