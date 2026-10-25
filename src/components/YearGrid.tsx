import { useEffect, useMemo, useRef, useState } from 'react';
import { dayNum, daysInMonth, fromDayNum, isWeekend, MONTH_NAMES, todayDayNum } from '../lib/dates';
import { layoutYear, monthSegments } from '../lib/layout';
import type { GridEvent } from '../lib/types';
import styles from './YearGrid.module.css';

const MIN_LANES = 2;
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

interface Props {
  year: number;
  events: GridEvent[];
  editable: boolean;
  /** Height of one event lane and the event font size, in px (from the text-size setting). */
  laneHeight: number;
  fontSize: number;
  /** Called after a click or drag across empty days (inclusive day numbers). */
  onCreate: (startDay: number, endDay: number) => void;
  onOpen: (event: GridEvent) => void;
}

export default function YearGrid({ year, events, editable, laneHeight, fontSize, onCreate, onOpen }: Props) {
  const layout = useMemo(() => layoutYear(events, year, MIN_LANES), [events, year]);
  const today = todayDayNum();
  const todayParts = fromDayNum(today);

  // ── Click / drag on empty days to create ──
  const [drag, setDragState] = useState<{ anchor: number; current: number } | null>(null);
  // The ref is written synchronously: a fast drag can fire the last mouseenter
  // and the mouseup before React re-renders, and mouseup must see the final cell.
  const dragRef = useRef(drag);
  const setDrag = (d: typeof drag) => {
    dragRef.current = d;
    setDragState(d);
  };

  useEffect(() => {
    if (!drag) return;
    const finish = () => {
      const d = dragRef.current;
      setDrag(null);
      if (d) onCreate(Math.min(d.anchor, d.current), Math.max(d.anchor, d.current));
    };
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  }, [drag !== null, onCreate]); // re-bind only when a drag starts or ends

  const inDrag = (n: number) =>
    drag !== null && n >= Math.min(drag.anchor, drag.current) && n <= Math.max(drag.anchor, drag.current);

  // ── Scroll the current month into view when showing this year ──
  const monthRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (year === todayParts.year) {
      monthRefs.current[todayParts.month - 1]?.scrollIntoView({ block: 'center' });
    }
  }, [year]); // only on year change, not on every edit

  return (
    <div
      className={styles.grid}
      style={{ ['--lane' as string]: `${laneHeight}px`, ['--event-font' as string]: `${fontSize}px` }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className={styles.header}>
        <div className={styles.corner} />
        <div className={styles.dayNumbers}>
          {DAYS.map((d) => (
            <div key={d} className={styles.dayNumber}>{d}</div>
          ))}
        </div>
      </div>

      {MONTH_NAMES.map((name, i) => {
        const month = i + 1;
        const dim = daysInMonth(year, month);
        const lanes = layout.lanesByMonth[i];
        const segments = monthSegments(events, layout, year, month);
        const isCurrentMonth = year === todayParts.year && month === todayParts.month;

        return (
          <div
            key={month}
            ref={(el) => { monthRefs.current[i] = el; }}
            className={styles.month}
            style={{ height: lanes * laneHeight + 6 }}
          >
            <div className={`${styles.monthLabel} ${isCurrentMonth ? styles.currentMonth : ''}`}>{name}</div>
            <div className={styles.days}>
              {DAYS.map((d) => {
                if (d > dim) return <div key={d} className={`${styles.cell} ${styles.outside}`} />;
                const n = dayNum(year, month, d);
                const cls = [
                  styles.cell,
                  isWeekend(n) && styles.weekend,
                  n === today && styles.today,
                  inDrag(n) && styles.selecting,
                  editable && styles.clickable,
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={d}
                    className={cls}
                    title={WEEKDAY.format(new Date(year, i, d))}
                    onMouseDown={editable ? (e) => { if (e.button === 0) setDrag({ anchor: n, current: n }); } : undefined}
                    // No button held: the mouseup happened outside the window, so the drag is over.
                    onMouseEnter={drag ? (e) => setDrag(e.buttons === 0 ? null : { ...dragRef.current!, current: n }) : undefined}
                  />
                );
              })}

              {segments.map((s) => {
                const e = s.event;
                const span = s.toDay - s.fromDay + 1;
                const cls = [
                  styles.event,
                  !e.allDay && styles.timed,
                  s.continuesBefore && styles.contBefore,
                  s.continuesAfter && styles.contAfter,
                  e.event.status === 'tentative' && styles.tentative,
                ].filter(Boolean).join(' ');
                return (
                  <button
                    key={e.key}
                    type="button"
                    className={cls}
                    style={{
                      left: `calc(${s.fromDay - 1} * 100% / 31 + 1px)`,
                      width: `calc(${span} * 100% / 31 - 2px)`,
                      top: s.lane * laneHeight + 3,
                      height: laneHeight - 3,
                      background: e.allDay ? e.color : undefined,
                      color: e.allDay ? e.textColor : undefined,
                      ['--dot' as string]: e.color,
                    }}
                    title={`${e.title}${e.timeLabel ? ` · ${e.timeLabel}` : ''}`}
                    onMouseDown={(ev) => ev.stopPropagation()}
                    onClick={() => onOpen(e)}
                  >
                    {e.timeLabel && <span className={styles.time}>{e.timeLabel}</span>}
                    {e.title}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
