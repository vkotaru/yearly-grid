import { useEffect, useRef, useState } from 'react';
import { dayNumFromIso, isoFromDayNum } from '../lib/dates';
import { validateDraft, type Draft } from '../lib/events';
import { calendarName, canEdit, type GCalendar, type GridEvent } from '../lib/types';
import styles from './EventEditor.module.css';

interface Props {
  initial: Draft;
  existing?: GridEvent;
  calendars: GCalendar[];
  /** False when offline or signed out: details are shown but not editable. */
  canWrite: boolean;
  onSave: (draft: Draft) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export default function EventEditor({ initial, existing, calendars, canWrite, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const calendar = calendars.find((c) => c.id === draft.calendarId);
  const editable = canWrite && (calendar ? canEdit(calendar) : false);
  const writable = calendars.filter(canEdit);
  const isRecurring = Boolean(existing?.event.recurringEventId);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateDraft(draft);
    if (problem) setError(problem);
    else void run(() => onSave(draft));
  };

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-label={existing ? 'Edit event' : 'New event'}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <input
          ref={titleRef}
          className={styles.title}
          placeholder="Add title"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          disabled={!editable || busy}
        />

        <label className={styles.row}>
          <span>Calendar</span>
          <select
            value={draft.calendarId}
            onChange={(e) => set('calendarId', e.target.value)}
            disabled={!editable || busy || isRecurring}
          >
            {(editable ? writable : calendar ? [calendar] : []).map((c) => (
              <option key={c.id} value={c.id}>{calendarName(c)}</option>
            ))}
          </select>
        </label>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.allDay}
            onChange={(e) => set('allDay', e.target.checked)}
            disabled={!editable || busy}
          />
          All day
        </label>

        <div className={styles.dates}>
          <label className={styles.row}>
            <span>Start</span>
            <input
              type="date"
              value={isoFromDayNum(draft.startDay)}
              onChange={(e) => e.target.value && set('startDay', dayNumFromIso(e.target.value))}
              disabled={!editable || busy}
              required
            />
            {!draft.allDay && (
              <input type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} disabled={!editable || busy} required />
            )}
          </label>
          <label className={styles.row}>
            <span>End</span>
            <input
              type="date"
              value={isoFromDayNum(draft.endDay)}
              onChange={(e) => e.target.value && set('endDay', dayNumFromIso(e.target.value))}
              disabled={!editable || busy}
              required
            />
            {!draft.allDay && (
              <input type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} disabled={!editable || busy} required />
            )}
          </label>
        </div>

        <textarea
          className={styles.description}
          placeholder="Description"
          rows={3}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          disabled={!editable || busy}
        />

        {isRecurring && <p className={styles.note}>Repeating event — changes apply to this occurrence only.</p>}
        {!canWrite && <p className={styles.note}>Offline or signed out — editing is unavailable.</p>}
        {canWrite && calendar && !canEdit(calendar) && <p className={styles.note}>You can view but not edit this calendar.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          {existing && editable && (
            confirmDelete ? (
              <button type="button" className={styles.danger} disabled={busy} onClick={() => run(onDelete)}>
                Confirm delete
              </button>
            ) : (
              <button type="button" className={styles.ghostDanger} disabled={busy} onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )
          )}
          {existing?.event.htmlLink && (
            <a className={styles.link} href={existing.event.htmlLink} target="_blank" rel="noreferrer">
              Open in Google Calendar
            </a>
          )}
          <span className={styles.spacer} />
          <button type="button" className={styles.ghost} onClick={onClose} disabled={busy}>
            {editable ? 'Cancel' : 'Close'}
          </button>
          {editable && (
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
