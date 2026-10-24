// Key-value persistence: chrome.storage.local inside the extension, localStorage
// under `npm run dev`. Google is the source of truth — this is only a cache of
// the last fetch (so the grid opens instantly and offline) plus preferences.

import { isExtension } from './backend';
import type { GCalendar, GEvent } from './types';

async function get<T>(key: string): Promise<T | undefined> {
  try {
    if (isExtension()) return (await chrome.storage.local.get(key))[key] as T | undefined;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    if (isExtension()) await chrome.storage.local.set({ [key]: value });
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — the cache is best-effort.
  }
}

export interface YearCache {
  savedAt: string;                    // ISO time of the last successful fetch
  events: Record<string, GEvent[]>;   // calendarId → events in that year
}

export const storage = {
  /** Calendar IDs the user chose to show; undefined until they first choose. */
  getSelected: () => get<string[]>('selectedCalendars'),
  setSelected: (ids: string[]) => set('selectedCalendars', ids),

  getCalendars: () => get<GCalendar[]>('calendars'),
  setCalendars: (cals: GCalendar[]) => set('calendars', cals),

  /** Set by "Sign out" so the next launch doesn't silently sign back in. */
  getSignedOut: async () => Boolean(await get<boolean>('signedOut')),
  setSignedOut: (value: boolean) => set('signedOut', value),

  getYear: (year: number) => get<YearCache>(`year:${year}`),
  setYear: (year: number, cache: YearCache) => set(`year:${year}`, cache),
};
