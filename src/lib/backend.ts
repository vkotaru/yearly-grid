import type { GCalendar, GEvent } from './types';

/** Everything the UI needs from a calendar source. */
export interface Backend {
  kind: 'google' | 'mock';
  /** Returns true if signed in. Non-interactive calls never show a prompt. */
  signIn(interactive: boolean): Promise<boolean>;
  signOut(): Promise<void>;
  listCalendars(): Promise<GCalendar[]>;
  listEvents(calendarId: string, year: number): Promise<GEvent[]>;
  createEvent(calendarId: string, body: Partial<GEvent>): Promise<GEvent>;
  updateEvent(calendarId: string, eventId: string, body: Partial<GEvent>): Promise<GEvent>;
  moveEvent(fromCalendarId: string, eventId: string, toCalendarId: string): Promise<GEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** True when running as an installed extension (vs. `npm run dev` in a tab). */
export function isExtension(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.identity);
}
