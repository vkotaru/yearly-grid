// Google Calendar backend. Auth goes through chrome.identity, which uses the
// Google account signed into Chrome and the oauth2 block in the manifest.

import { ApiError, type Backend } from './backend';
import type { GCalendar, GEvent } from './types';

const API = 'https://www.googleapis.com/calendar/v3';

let token: string | null = null;

async function getToken(interactive: boolean): Promise<string | null> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive });
    token = result.token ?? null;
  } catch {
    token = null;
  }
  return token;
}

async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!token && !(await getToken(false))) throw new ApiError(401, 'Not signed in');

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });

  // Expired or revoked token: drop it from Chrome's cache and retry once.
  if (res.status === 401 && retry) {
    if (token) await chrome.identity.removeCachedAuthToken({ token });
    token = null;
    return api<T>(path, init, false);
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      message = (await res.json()).error?.message || message;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Follows nextPageToken until every page has been read. */
async function listAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ ...params, ...(pageToken ? { pageToken } : {}) });
    const page = await api<{ items?: T[]; nextPageToken?: string }>(`${path}?${qs}`);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

const cal = (id: string) => `/calendars/${encodeURIComponent(id)}`;

export const googleBackend: Backend = {
  kind: 'google',

  async signIn(interactive) {
    return Boolean(await getToken(interactive));
  },

  async signOut() {
    token = null;
    await chrome.identity.clearAllCachedAuthTokens();
  },

  async listCalendars() {
    const all = await listAll<GCalendar>('/users/me/calendarList', { maxResults: '250' });
    // Free/busy-only calendars expose no event details worth drawing.
    return all.filter((c) => c.accessRole !== 'freeBusyReader');
  },

  listEvents(calendarId, year) {
    return listAll<GEvent>(`${cal(calendarId)}/events`, {
      timeMin: new Date(year, 0, 1).toISOString(),
      timeMax: new Date(year + 1, 0, 1).toISOString(),
      singleEvents: 'true', // expand recurring events into instances
      maxResults: '2500',
    });
  },

  createEvent(calendarId, body) {
    return api<GEvent>(`${cal(calendarId)}/events`, { method: 'POST', body: JSON.stringify(body) });
  },

  updateEvent(calendarId, eventId, body) {
    // PUT, not PATCH: switching all-day ↔ timed must replace start/end whole,
    // and PATCH would merge `date` and `dateTime` into an invalid pair.
    return api<GEvent>(`${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  moveEvent(fromCalendarId, eventId, toCalendarId) {
    const qs = new URLSearchParams({ destination: toCalendarId });
    return api<GEvent>(`${cal(fromCalendarId)}/events/${encodeURIComponent(eventId)}/move?${qs}`, { method: 'POST' });
  },

  async deleteEvent(calendarId, eventId) {
    await api<void>(`${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
  },
};
