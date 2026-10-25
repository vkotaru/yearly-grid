import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { describeWhen } from '../lib/events';
import type { GridEvent } from '../lib/types';
import styles from './EventHoverCard.module.css';

interface Props {
  event: GridEvent;
  /** Where the hovered chip is on screen; the card sits below it, or above near the bottom edge. */
  anchor: DOMRect;
}

const GAP = 6;
const MARGIN = 8;
const MAX_DESCRIPTION = 240;

/** Google descriptions can be HTML; show them as plain text. DOMParser doesn't run scripts. */
function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
  const text = (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION).trimEnd()}…` : text;
}

export default function EventHoverCard({ event, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ev = event.event;
  const description = useMemo(() => (ev.description ? plainText(ev.description) : ''), [ev.description]);

  // Measure, then place: below the chip if it fits, else above; kept inside the window.
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    const { width, height } = card.getBoundingClientRect();
    const left = Math.min(Math.max(anchor.left, MARGIN), window.innerWidth - width - MARGIN);
    const below = anchor.bottom + GAP;
    const top = below + height <= window.innerHeight - MARGIN ? below : Math.max(MARGIN, anchor.top - GAP - height);
    setPos({ left, top });
  }, [anchor]);

  return (
    <div
      ref={ref}
      className={styles.card}
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      <div className={styles.title}>
        <span className={styles.swatch} style={{ background: event.color }} />
        <span>{event.title}</span>
      </div>
      <div className={styles.row}>{describeWhen(event)}</div>
      {ev.location && <div className={styles.row}>📍 {ev.location}</div>}
      <div className={`${styles.row} ${styles.muted}`}>
        {event.calendarName}
        {ev.status === 'tentative' && ' · tentative'}
        {ev.recurringEventId && ' · repeats'}
      </div>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
