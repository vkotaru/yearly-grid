import { useCallback, useEffect, useMemo, useState } from 'react';
import CalendarList from './components/CalendarList';
import EventEditor from './components/EventEditor';
import Segmented from './components/Segmented';
import SettingsPanel from './components/SettingsPanel';
import YearGrid from './components/YearGrid';
import { isExtension, type Backend } from './lib/backend';
import { draftFromGridEvent, newDraft, toGridEvent, type Draft } from './lib/events';
import { applyTheme, clampSidebarWidth, DEFAULT_SETTINGS, EVENT_FILTERS, laneKey, loadSettings, passesFilter, saveSettings, TEXT_SIZES, type Settings } from './lib/settings';
import { canEdit, type GridEvent } from './lib/types';
import { useYearData } from './useYearData';
import styles from './App.module.css';

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function ago(iso: string): string {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  return Math.abs(minutes) < 60 ? RELATIVE.format(minutes, 'minute') : RELATIVE.format(Math.round(minutes / 60), 'hour');
}

interface Editing {
  draft: Draft;
  existing?: GridEvent;
}

export default function App({ backend }: { backend: Backend }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const data = useYearData(backend, year);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    applyTheme(settings);
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const canWrite = Boolean(data.signedIn) && data.online;

  const { gridEvents, hidden } = useMemo(() => {
    const out: GridEvent[] = [];
    let hidden = 0;
    for (const cal of data.calendars) {
      if (!data.selected.includes(cal.id)) continue;
      const alpha = settings.calendarAlpha[cal.id];
      for (const ev of data.events[cal.id] ?? []) {
        const g = toGridEvent(ev, cal);
        if (!g) continue;
        if (alpha !== undefined) g.alpha = alpha;
        if (passesFilter(g, settings.eventFilter)) out.push(g);
        else hidden++;
      }
    }
    return { gridEvents: out, hidden };
  }, [data.calendars, data.selected, data.events, settings.eventFilter, settings.calendarAlpha]);

  // New events go to the primary calendar if it's shown, else the first
  // shown calendar you can write to, else any writable calendar.
  const defaultCalendar = useMemo(() => {
    const writable = data.calendars.filter(canEdit);
    const shown = writable.filter((c) => data.selected.includes(c.id));
    return (shown.find((c) => c.primary) ?? shown[0] ?? writable[0])?.id;
  }, [data.calendars, data.selected]);

  const onCreate = useCallback(
    (start: number, end: number) => {
      if (defaultCalendar) setEditing({ draft: newDraft(defaultCalendar, start, end) });
    },
    [defaultCalendar],
  );

  const setCalendarAlpha = useCallback(
    (id: string, value: number) =>
      setSettings((s) => {
        const calendarAlpha = { ...s.calendarAlpha };
        if (value >= 1) delete calendarAlpha[id];
        else calendarAlpha[id] = value;
        return { ...s, calendarAlpha };
      }),
    [],
  );

  const extraLanes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => settings.extraLanes[laneKey(year, i + 1)] ?? 0),
    [settings.extraLanes, year],
  );
  const setExtraLanes = useCallback(
    (month: number, count: number) =>
      setSettings((s) => {
        const extra = { ...s.extraLanes };
        if (count > 0) extra[laneKey(year, month)] = count;
        else delete extra[laneKey(year, month)];
        return { ...s, extraLanes: extra };
      }),
    [year],
  );

  // ── Sidebar resize: drag its right edge; double-click resets ──
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const sidebarWidth = dragWidth ?? settings.sidebarWidth;
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = settings.sidebarWidth;
    let width = startWidth;
    const move = (ev: PointerEvent) => {
      width = clampSidebarWidth(startWidth + ev.clientX - startX);
      setDragWidth(width);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      setDragWidth(null);
      updateSettings({ sidebarWidth: width });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  const onOpen = useCallback((g: GridEvent) => setEditing({ draft: draftFromGridEvent(g), existing: g }), []);
  const closeEditor = useCallback(() => setEditing(null), []);

  if (data.signedIn === false && data.calendars.length === 0) {
    return (
      <div className={styles.signIn}>
        <img src="/icons/icon-128.png" alt="" width={64} height={64} />
        <h1>Yearly Grid</h1>
        <p>Your whole Google Calendar year on one grid.</p>
        <button className={styles.primary} onClick={data.signIn}>Sign in with Google</button>
        {data.error && <p className={styles.errorText}>{data.error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <button
          className={styles.iconButton}
          onClick={() => updateSettings({ sidebarOpen: !settings.sidebarOpen })}
          aria-label={settings.sidebarOpen ? 'Hide calendars' : 'Show calendars'}
          aria-expanded={settings.sidebarOpen}
          title={settings.sidebarOpen ? 'Hide calendars' : 'Show calendars'}
        >
          ☰
        </button>
        <div className={styles.brand}>
          <img src="/icons/icon-32.png" alt="" width={22} height={22} />
          Yearly Grid
        </div>
        <div className={styles.yearNav}>
          <button className={styles.iconButton} onClick={() => setYear((y) => y - 1)} aria-label="Previous year">‹</button>
          <span className={styles.year}>{year}</span>
          <button className={styles.iconButton} onClick={() => setYear((y) => y + 1)} aria-label="Next year">›</button>
          {year !== new Date().getFullYear() && (
            <button className={styles.textButton} onClick={() => setYear(new Date().getFullYear())}>Today</button>
          )}
        </div>
        <div className={styles.status}>
          {data.loading ? 'Syncing…' : data.savedAt ? `Updated ${ago(data.savedAt)}` : ''}
          <button
            className={styles.iconButton}
            onClick={data.refresh}
            disabled={data.loading || !canWrite}
            aria-label="Refresh"
            title="Refresh from Google"
          >
            ↻
          </button>
          <button
            className={`${styles.iconButton} ${settingsOpen ? styles.active : ''}`}
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Settings"
            aria-expanded={settingsOpen}
            title="Settings"
            data-settings-toggle
          >
            ⚙
          </button>
          {data.signedIn && isExtension() && (
            <button className={styles.textButton} onClick={data.signOut}>Sign out</button>
          )}
        </div>
        {settingsOpen && <SettingsPanel settings={settings} onChange={updateSettings} onClose={closeSettings} />}
      </header>

      {backend.kind === 'mock' && (
        <div className={styles.banner}>Demo mode — sample data, nothing is sent to Google. Load the built extension to use your calendar.</div>
      )}
      {!data.online && <div className={styles.banner}>Offline — showing your last synced copy. Editing is paused.</div>}
      {data.signedIn === false && (
        <div className={styles.banner}>
          Signed out — showing your last synced copy.
          <button className={styles.textButton} onClick={data.signIn}>Sign in</button>
        </div>
      )}
      {data.error && (
        <div className={`${styles.banner} ${styles.errorBanner}`} role="alert">
          {data.error}
          <button className={styles.textButton} onClick={() => data.setError(null)}>Dismiss</button>
        </div>
      )}

      <div className={styles.body}>
        {settings.sidebarOpen && (
          <aside className={styles.sidebar} style={{ width: sidebarWidth }}>
            <section className={styles.sideSection}>
              <h2 className={styles.sideHeading}>Show</h2>
              <Segmented
                label="Show on the grid"
                value={settings.eventFilter}
                options={EVENT_FILTERS.map((f) => [f.value, f.short, f.hint])}
                onChange={(eventFilter) => updateSettings({ eventFilter })}
              />
            </section>
            <CalendarList
              calendars={data.calendars}
              selected={data.selected}
              onToggle={data.toggleCalendar}
              alpha={settings.calendarAlpha}
              onAlpha={setCalendarAlpha}
            />
            {hidden > 0 && (
              <p className={styles.hint}>
                {hidden} timed {hidden === 1 ? 'event' : 'events'} hidden.{' '}
                <button className={styles.linkButton} onClick={() => updateSettings({ eventFilter: 'all' })}>Show all</button>
              </p>
            )}
            {canWrite && defaultCalendar && <p className={styles.hint}>Click or drag across days to add an event.</p>}
          </aside>
        )}
        {settings.sidebarOpen && (
          <div
            className={`${styles.resizer} ${dragWidth !== null ? styles.resizing : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize calendars"
            title="Drag to resize · double-click to reset"
            onPointerDown={startResize}
            onDoubleClick={() => updateSettings({ sidebarWidth: DEFAULT_SETTINGS.sidebarWidth })}
          />
        )}
        <main className={styles.main}>
          <YearGrid
            year={year}
            events={gridEvents}
            editable={canWrite && Boolean(defaultCalendar)}
            laneHeight={TEXT_SIZES[settings.textSize].lane}
            fontSize={TEXT_SIZES[settings.textSize].font}
            onCreate={onCreate}
            onOpen={onOpen}
            extraLanes={extraLanes}
            onExtraLanes={setExtraLanes}
          />
        </main>
      </div>

      {editing && (
        <EventEditor
          initial={editing.draft}
          existing={editing.existing}
          calendars={data.calendars}
          canWrite={canWrite}
          onSave={(draft) => data.save(draft, editing.existing)}
          onDelete={() => data.remove(editing.existing!)}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
