import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type Backend } from './lib/backend';
import { applyDraft, draftFromGridEvent, draftToEventBody, type Draft } from './lib/events';
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

  // Bumped by every local edit. A fetch that started before an edit would
  // overwrite it with pre-edit data, so fetches retry until no edit landed.
  const editsRef = useRef(0);

  // An expired grant that can't be renewed silently means the user must sign
  // in again; flip to signed-out so the Sign in button appears.
  const noteAuthError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) setSignedIn(false);
  }, []);

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
      setSignedIn((await storage.getSignedOut()) ? false : await backend.signIn(false));
    })();
  }, [backend]);

  const fetchCalendarEvents = useCallback(
    async (ids: string[], y: number): Promise<{ next: EventsByCal; failed: string[] }> => {
      for (let attempt = 0; ; attempt++) {
        const editsBefore = editsRef.current;
        const results = await Promise.allSettled(ids.map((id) => backend.listEvents(id, y)));
        if (editsRef.current !== editsBefore && attempt < 2) continue; // an edit landed mid-fetch
        const next = { ...eventsFor(y) };
        const failed: string[] = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') next[ids[i]] = r.value;
          else {
            noteAuthError(r.reason);
            failed.push(`${ids[i]}: ${(r.reason as Error).message}`);
          }
        });
        return { next, failed };
      }
    },
    [backend, noteAuthError],
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
      noteAuthError(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [backend, selected, fetchCalendarEvents, persist, setYearEvents, noteAuthError]);

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
    if (ok) void storage.setSignedOut(false);
    else setError('Google sign-in was cancelled or failed.');
  }, [backend]);

  const signOut = useCallback(async () => {
    await backend.signOut();
    await storage.setSignedOut(true);
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
      editsRef.current += 1;
      const next = change(eventsFor(y));
      setYearEvents(y, next);
      await persist(y, next);
    },
    [persist, setYearEvents],
  );

  const save = useCallback(
    async (draft: Draft, existing?: GridEvent) => {
      try {
        if (!existing) {
          const created = await backend.createEvent(draft.calendarId, draftToEventBody(draft, TIME_ZONE));
          await apply((p) => ({ ...p, [draft.calendarId]: [...(p[draft.calendarId] ?? []), created] }));
          return;
        }

        const id = existing.event.id;
        // If an earlier attempt already moved the event (and then failed to
        // update it), it now lives in the target calendar — don't move again.
        const alreadyMoved = (eventsFor(yearRef.current)[draft.calendarId] ?? []).some((e) => e.id === id);
        let calendarId = alreadyMoved ? draft.calendarId : existing.calendarId;
        if (draft.calendarId !== calendarId) {
          const moved = await backend.moveEvent(calendarId, id, draft.calendarId);
          // Reflect the move now, so a failure in the update below can't leave
          // a stale copy in the old calendar.
          await apply((p) => ({
            ...p,
            [calendarId]: (p[calendarId] ?? []).filter((e) => e.id !== id),
            [draft.calendarId]: [...(p[draft.calendarId] ?? []), moved],
          }));
          calendarId = draft.calendarId;
        }

        // Build the update on the event as Google has it now, not the cached
        // copy, applying only what changed in the editor; If-Match rejects it if
        // the event changes again between this read and the write.
        const fresh = await backend.getEvent(calendarId, id);
        if (fresh.status === 'cancelled') {
          throw new Error('This event was deleted in Google Calendar. Refresh to update the grid.');
        }
        const body = applyDraft(fresh, draftFromGridEvent(existing), draft, TIME_ZONE);
        const updated = await backend.updateEvent(calendarId, id, body, fresh.etag);
        await apply((p) => ({
          ...p,
          [calendarId]: (p[calendarId] ?? []).map((e) => (e.id === updated.id ? updated : e)),
        }));
      } catch (err) {
        noteAuthError(err);
        if (err instanceof ApiError && err.status === 412) {
          throw new Error('This event changed in Google Calendar while saving. Close and reopen it to see the latest.');
        }
        throw err;
      }
    },
    [backend, apply, noteAuthError],
  );

  const remove = useCallback(
    async (existing: GridEvent) => {
      try {
        // An earlier save may have moved it; delete from wherever it is now.
        const y = yearRef.current;
        const calendarId = Object.keys(eventsFor(y)).find((c) => eventsFor(y)[c].some((e) => e.id === existing.event.id))
          ?? existing.calendarId;
        await backend.deleteEvent(calendarId, existing.event.id);
        await apply((p) => ({ ...p, [calendarId]: (p[calendarId] ?? []).filter((e) => e.id !== existing.event.id) }));
      } catch (err) {
        noteAuthError(err);
        throw err;
      }
    },
    [backend, apply, noteAuthError],
  );

  return {
    online, signedIn, calendars, selected: selected ?? [],
    events: yearData.year === year ? yearData.byCal : {},
    savedAt, loading, error,
    setError, refresh, signIn, signOut, toggleCalendar, save, remove,
  };
}
