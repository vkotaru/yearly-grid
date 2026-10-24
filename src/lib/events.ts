import { dayNumFromDate, dayNumFromIso, hhmm, isoFromDayNum } from './dates';
import type { GCalendar, GEvent, GridEvent } from './types';

// Google's fixed event palette (colorId → background). These are the colours
// the Calendar web UI shows; the API's /colors endpoint returns older shades.
export const EVENT_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6bf26', '6': '#f4511e', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
};

/** Google event → grid item, or null for cancelled/unplaceable events. */
export function toGridEvent(ev: GEvent, cal: GCalendar): GridEvent | null {
  if (ev.status === 'cancelled') return null;

  let startDay: number;
  let endDay: number;
  let allDay: boolean;
  let timeLabel: string | undefined;

  if (ev.start.date) {
    allDay = true;
    startDay = dayNumFromIso(ev.start.date);
    // All-day end dates are exclusive: a one-day event on the 5th ends on the 6th.
    endDay = ev.end?.date ? dayNumFromIso(ev.end.date) - 1 : startDay;
  } else if (ev.start.dateTime) {
    allDay = false;
    const start = new Date(ev.start.dateTime);
    const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : start;
    startDay = dayNumFromDate(start);
    endDay = dayNumFromDate(end);
    // An event ending exactly at midnight doesn't occupy the next day.
    if (endDay > startDay && end.getHours() === 0 && end.getMinutes() === 0) endDay -= 1;
    timeLabel = hhmm(start);
  } else {
    return null;
  }

  const color = (ev.colorId && EVENT_COLORS[ev.colorId]) || cal.backgroundColor;
  return {
    key: `${cal.id}|${ev.id}`,
    calendarId: cal.id,
    event: ev,
    title: ev.summary || '(No title)',
    color,
    textColor: ev.colorId ? '#ffffff' : cal.foregroundColor,
    startDay,
    endDay: Math.max(startDay, endDay),
    allDay,
    timeLabel,
  };
}

/** What the editor edits. Days are inclusive day numbers; times are 'HH:MM'. */
export interface Draft {
  calendarId: string;
  title: string;
  description: string;
  allDay: boolean;
  startDay: number;
  endDay: number;
  startTime: string;
  endTime: string;
}

export function newDraft(calendarId: string, startDay: number, endDay: number): Draft {
  return {
    calendarId,
    title: '',
    description: '',
    allDay: true,
    startDay: Math.min(startDay, endDay),
    endDay: Math.max(startDay, endDay),
    startTime: '09:00',
    endTime: '10:00',
  };
}

export function draftFromGridEvent(g: GridEvent): Draft {
  const ev = g.event;
  const startTime = ev.start.dateTime ? hhmm(new Date(ev.start.dateTime)) : '09:00';
  const endTime = ev.end?.dateTime ? hhmm(new Date(ev.end.dateTime)) : '10:00';
  return {
    calendarId: g.calendarId,
    title: ev.summary || '',
    description: ev.description || '',
    allDay: g.allDay,
    startDay: g.startDay,
    // For timed events the editor shows the real end date, not the grid's
    // midnight-adjusted one, so a save round-trips unchanged.
    endDay: ev.end?.dateTime ? dayNumFromDate(new Date(ev.end.dateTime)) : g.endDay,
    startTime,
    endTime,
  };
}

/** Returns an error message, or null if the draft can be saved. */
export function validateDraft(d: Draft): string | null {
  if (d.endDay < d.startDay) return 'End date is before the start date.';
  if (!d.allDay && d.endDay === d.startDay && d.endTime <= d.startTime) {
    return 'End time must be after the start time.';
  }
  return null;
}

/**
 * Draft → Google event body. With `base`, the existing event's other fields
 * (attendees, reminders, recurrence links, …) are preserved, since updates are
 * sent as full replacements.
 */
export function draftToEventBody(d: Draft, timeZone: string, base?: GEvent): Partial<GEvent> {
  const body: Partial<GEvent> = { ...(base ?? {}), summary: d.title, description: d.description };
  if (d.allDay) {
    body.start = { date: isoFromDayNum(d.startDay) };
    body.end = { date: isoFromDayNum(d.endDay + 1) };
  } else {
    const tz = base?.start.timeZone || timeZone;
    body.start = { dateTime: `${isoFromDayNum(d.startDay)}T${d.startTime}:00`, timeZone: tz };
    body.end = { dateTime: `${isoFromDayNum(d.endDay)}T${d.endTime}:00`, timeZone: tz };
  }
  return body;
}
