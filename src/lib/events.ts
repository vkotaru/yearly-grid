import { dayNumFromDate, dayNumFromIso, hhmm, isoFromDayNum, zonedParts } from './dates';
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
  /**
   * IANA zones the start/end times are expressed in — the event's own zones,
   * so a save never shifts the instant. Undefined means the browser's zone.
   */
  startZone?: string;
  endZone?: string;
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
  const draft: Draft = {
    calendarId: g.calendarId,
    title: ev.summary || '',
    description: ev.description || '',
    allDay: g.allDay,
    startDay: g.startDay,
    endDay: g.endDay,
    startTime: '09:00',
    endTime: '10:00',
  };
  if (ev.start.dateTime) {
    // Read times in the event's own zone (not the browser's): the body is
    // written back in that zone, so this keeps an unchanged save a no-op. The
    // end date is the real one, not the grid's midnight-adjusted day.
    draft.startZone = ev.start.timeZone;
    draft.endZone = ev.end?.timeZone ?? ev.start.timeZone;
    const start = zonedParts(ev.start.dateTime, draft.startZone);
    const end = zonedParts(ev.end?.dateTime ?? ev.start.dateTime, draft.endZone);
    Object.assign(draft, { startDay: start.day, startTime: start.time, endDay: end.day, endTime: end.time });
  }
  return draft;
}

/** Returns an error message, or null if the draft can be saved. */
export function validateDraft(d: Draft): string | null {
  if (d.endDay < d.startDay) return 'End date is before the start date.';
  if (!d.allDay && d.endDay === d.startDay && d.endTime <= d.startTime && (d.endZone ?? d.startZone) === d.startZone) {
    return 'End time must be after the start time.';
  }
  return null;
}

function draftTimes(d: Draft, timeZone: string): Pick<GEvent, 'start' | 'end'> {
  if (d.allDay) {
    return { start: { date: isoFromDayNum(d.startDay) }, end: { date: isoFromDayNum(d.endDay + 1) } };
  }
  const startZone = d.startZone || timeZone;
  return {
    start: { dateTime: `${isoFromDayNum(d.startDay)}T${d.startTime}:00`, timeZone: startZone },
    end: { dateTime: `${isoFromDayNum(d.endDay)}T${d.endTime}:00`, timeZone: d.endZone || startZone },
  };
}

/** Body for a new event. */
export function draftToEventBody(d: Draft, timeZone: string): Partial<GEvent> {
  return { summary: d.title, description: d.description, ...draftTimes(d, timeZone) };
}

/**
 * Body for updating `fresh` (the event as Google has it right now). Only the
 * fields the user changed between `initial` and `draft` are applied, so edits
 * made elsewhere since the grid was loaded survive. Everything else in `fresh`
 * (attendees, reminders, …) is kept, since updates are full replacements.
 */
export function applyDraft(fresh: GEvent, initial: Draft, draft: Draft, timeZone: string): GEvent {
  const body: GEvent = { ...fresh };
  if (draft.title !== initial.title) body.summary = draft.title;
  if (draft.description !== initial.description) body.description = draft.description;
  const timesChanged = (['allDay', 'startDay', 'endDay', 'startTime', 'endTime'] as const)
    .some((k) => draft[k] !== initial[k]);
  if (timesChanged) Object.assign(body, draftTimes(draft, timeZone));
  return body;
}

/** Google event types other than plain events can't be edited through the API like normal events. */
export function isPlainEvent(ev: GEvent): boolean {
  return !ev.eventType || ev.eventType === 'default';
}
