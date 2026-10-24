import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backend } from './lib/backend';
import { draftToEventBody, type Draft } from './lib/events';
import { storage } from './lib/storage';
import type { GCalendar, GEvent, GridEvent } from './lib/types';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

type EventsByCal = Record<string, GEvent[]>;

function defaultSelection(cals: GCalendar[]): string[] {
  return cals.filter((c) => c.selected || c.primary).map((c) => c.id);
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Calendars, selection and one year of events. Shows the cached copy first,
 * then refreshes from Google. Edits go straight to Google (no offline queue):
 * the cache is updated from the API's response, never ahead of it.
 */
export function useYearData(backend: Backend, year: number) {
  const online = useOnline();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [selected, setSelectedState] = useState<string[] | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Responses for a year the user has already navigated away from are dropped.
  const yearRef = useRef(year);
  yearRef.current = year;

  // Events are tagged with their year, so a fetch never merges into another
  // year's events, and `fresh` stops a slow cache read from overwriting data
  // that already came back from Google. The ref is written synchronously so
  // back-to-back updates in one tick build on each other.
  const [yearData, setYearData] = useState({ year, byCal: {} as EventsByCal, fresh: false });
  const dataRef = useRef(yearData);
  const setYearEvents = useCallback((y: number, byCal: EventsByCal, fresh = true) => {
    dataRef.current = { year: y, byCal, fresh };
    setYearData(dataRef.current);
  }, []);
  const eventsFor = (y: number): EventsByCal => (dataRef.current.year === y ? dataRef.current.byCal : {});

  const persist = useCallback((y: number, next: EventsByCal) => {
    const at = new Date().toISOString();
    setSavedAt(at);
    return storage.setYear(y, { savedAt: at, events: next });
  }, []);

  // ── Startup: cached preferences, then a silent sign-in ──
  useEffect(() => {
    (async () => {
      const [cals, sel] = await Promise.all([storage.getCalendars(), storage.getSelected()]);
      if (cals) setCalendars(cals);
      setSelectedState(sel ?? (cals ? defaultSelection(cals) : null));
      setSignedIn(await backend.signIn(false));
    })();
  }, [backend]);

  const fetchCalendarEvents = useCallback(
    async (ids: string[], y: number): Promise<{ next: EventsByCal; failed: string[] }> => {
      const results = await Promise.allSettled(ids.map((id) => backend.listEvents(id, y)));
      const next = { ...eventsFor(y) };
      const failed: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[ids[i]] = r.value;
        else failed.push(`${ids[i]}: ${(r.reason as Error).message}`);
      });
      return { next, failed };
    },
    [backend],
  );

  const refresh = useCallback(async () => {
    const y = yearRef.current;
    setLoading(true);
    setError(null);
    try {
      const cals = await backend.listCalendars();
      setCalendars(cals);
      void storage.setCalendars(cals);

      let sel = selected;
      if (!sel) {
        sel = defaultSelection(cals);
        setSelectedState(sel);
        void storage.setSelected(sel);
      }
      const known = new Set(cals.map((c) => c.id));
      const { next, failed } = await fetchCalendarEvents(sel.filter((id) => known.has(id)), y);
      if (yearRef.current !== y) return;
      setYearEvents(y, next);
      await persist(y, next);
      if (failed.length) setError(`Some calendars failed to load — ${failed.join('; ')}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [backend, selected, fetchCalendarEvents, persist, setYearEvents]);

  // ── Year change: cached copy immediately, then refresh ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cache = await storage.getYear(year);
      if (cancelled || (dataRef.current.year === year && dataRef.current.fresh)) return;
      setYearEvents(year, cache?.events ?? {}, false);
      setSavedAt(cache?.savedAt ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [year, setYearEvents]);

  useEffect(() => {
    if (signedIn && online) void refresh();
    // refresh is deliberately not a dependency: it changes with `selected`,
    // and toggling a calendar fetches just that calendar (see toggleCalendar).
  }, [signedIn, online, year]);

  const signIn = useCallback(async () => {
    const ok = await backend.signIn(true);
    setSignedIn(ok);
    if (!ok) setError('Google sign-in was cancelled or failed.');
  }, [backend]);

  const signOut = useCallback(async () => {
    await backend.signOut();
    setSignedIn(false);
  }, [backend]);

  const toggleCalendar = useCallback(
    async (id: string) => {
      const current = selected ?? [];
      const sel = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
      setSelectedState(sel);
      void storage.setSelected(sel);
      const y = yearRef.current;
      if (sel.includes(id) && !eventsFor(y)[id] && signedIn && online) {
        const { next, failed } = await fetchCalendarEvents([id], y);
        if (yearRef.current !== y) return;
        setYearEvents(y, next);
        await persist(y, next);
        if (failed.length) setError(failed.join('; '));
      }
    },
    [selected, signedIn, online, fetchCalendarEvents, persist, setYearEvents],
  );

  /** Applies a change to the in-memory and cached copy of this year. */
  const apply = useCallback(
    async (change: (prev: EventsByCal) => EventsByCal) => {
      const y = yearRef.current;
      const next = change(eventsFor(y));
      setYearEvents(y, next);
      await persist(y, next);
    },
    [persist, setYearEvents],
  );

  const save = useCallback(
    async (draft: Draft, existing?: GridEvent) => {
      if (!existing) {
        const created = await backend.createEvent(draft.calendarId, draftToEventBody(draft, TIME_ZONE));
        await apply((p) => ({ ...p, [draft.calendarId]: [...(p[draft.calendarId] ?? []), created] }));
        return;
      }

      let base = existing.event;
      if (draft.calendarId !== existing.calendarId) {
        base = await backend.moveEvent(existing.calendarId, base.id, draft.calendarId);
        // Reflect the move now, so a failure in the update below can't leave a
        // stale copy in the old calendar.
        await apply((p) => ({
          ...p,
          [existing.calendarId]: (p[existing.calendarId] ?? []).filter((e) => e.id !== base.id),
          [draft.calendarId]: [...(p[draft.calendarId] ?? []), base],
        }));
      }
      const updated = await backend.updateEvent(draft.calendarId, base.id, draftToEventBody(draft, TIME_ZONE, base));
      await apply((p) => ({
        ...p,
        [draft.calendarId]: (p[draft.calendarId] ?? []).map((e) => (e.id === updated.id ? updated : e)),
      }));
    },
    [backend, apply],
  );

  const remove = useCallback(
    async (existing: GridEvent) => {
      await backend.deleteEvent(existing.calendarId, existing.event.id);
      await apply((p) => ({
        ...p,
        [existing.calendarId]: (p[existing.calendarId] ?? []).filter((e) => e.id !== existing.event.id),
      }));
    },
    [backend, apply],
  );

  return {
    online, signedIn, calendars, selected: selected ?? [],
    events: yearData.year === year ? yearData.byCal : {},
    savedAt, loading, error,
    setError, refresh, signIn, signOut, toggleCalendar, save, remove,
  };
}
