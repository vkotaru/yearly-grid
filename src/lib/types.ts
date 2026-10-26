// The subset of Google Calendar API resources this extension uses.
// https://developers.google.com/calendar/api/v3/reference

export type AccessRole = 'owner' | 'writer' | 'reader' | 'freeBusyReader';

export interface GCalendar {
  id: string;
  summary: string;
  summaryOverride?: string;
  backgroundColor: string;
  foregroundColor: string;
  accessRole: AccessRole;
  primary?: boolean;
  selected?: boolean;
  timeZone?: string;
}

export interface GEventTime {
  date?: string;     // 'YYYY-MM-DD' — all-day events
  dateTime?: string; // RFC 3339 — timed events
  timeZone?: string;
}

export interface GEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  colorId?: string;
  recurringEventId?: string;
  etag?: string;
  /** 'default' for plain events; also 'birthday', 'outOfOffice', 'focusTime', 'workingLocation', 'fromGmail'. */
  eventType?: string;
  start: GEventTime;
  end: GEventTime;
  // Other fields are kept as-is so a full update (PUT) doesn't drop them.
  [key: string]: unknown;
}

/** A Google event placed on the year grid. Days are inclusive day numbers. */
export interface GridEvent {
  key: string;          // `${calendarId}|${event.id}` — unique across calendars
  calendarId: string;
  calendarName: string;
  event: GEvent;
  title: string;
  color: string;
  textColor: string;
  startDay: number;
  endDay: number;
  allDay: boolean;
  timeLabel?: string;   // 'HH:MM' start time for timed events
  alpha?: number;       // 0–1 from the calendar's opacity setting; unset = opaque
}

export function canEdit(cal: GCalendar): boolean {
  return cal.accessRole === 'owner' || cal.accessRole === 'writer';
}

export function calendarName(cal: GCalendar): string {
  return cal.summaryOverride || cal.summary;
}
