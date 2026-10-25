// In-memory stand-in for Google, used by `npm run dev` outside the extension.
// Lets the whole UI (including edits) be exercised without OAuth setup.

import { ApiError, type Backend } from './backend';
import { dayNum, dayOfWeek, isoFromDayNum } from './dates';
import type { GCalendar, GEvent } from './types';

const calendars: GCalendar[] = [
  { id: 'personal', summary: 'Personal', backgroundColor: '#039be5', foregroundColor: '#ffffff', accessRole: 'owner', primary: true, selected: true },
  { id: 'work', summary: 'Work', backgroundColor: '#7986cb', foregroundColor: '#ffffff', accessRole: 'writer', selected: true },
  { id: 'family', summary: 'Family', backgroundColor: '#e67c73', foregroundColor: '#ffffff', accessRole: 'writer', selected: true },
  { id: 'holidays', summary: 'Holidays', backgroundColor: '#0b8043', foregroundColor: '#ffffff', accessRole: 'reader', selected: true },
];

let nextId = 1;
const store = new Map<string, Map<string, GEvent>>(); // calendarId → id → event
const seededYears = new Set<number>();

function put(calendarId: string, ev: GEvent): GEvent {
  if (!store.has(calendarId)) store.set(calendarId, new Map());
  store.get(calendarId)!.set(ev.id, ev);
  return ev;
}

function allDay(calendarId: string, summary: string, start: number, days = 1, colorId?: string) {
  put(calendarId, {
    id: `mock${nextId++}`, summary, colorId,
    start: { date: isoFromDayNum(start) }, end: { date: isoFromDayNum(start + days) },
  });
}

function timed(calendarId: string, summary: string, day: number, from: string, to: string, extra: Partial<GEvent> = {}) {
  put(calendarId, {
    ...extra,
    id: `mock${nextId++}`, summary,
    start: { dateTime: `${isoFromDayNum(day)}T${from}:00` }, end: { dateTime: `${isoFromDayNum(day)}T${to}:00` },
  });
}

function seed(year: number) {
  if (seededYears.has(year)) return;
  seededYears.add(year);
  const d = (m: number, day: number) => dayNum(year, m, day);

  for (const [m, day, name] of [[1, 1, "New Year's Day"], [7, 4, 'Independence Day'], [11, 26, 'Thanksgiving'], [12, 25, 'Christmas Day']] as const) {
    allDay('holidays', name, d(m, day));
  }
  // Alternating work weeks, Monday–Friday.
  for (let n = d(1, 5); n < d(12, 20); n += 14) {
    if (dayOfWeek(n) === 1) allDay('work', 'Work Week', n, 5);
  }
  allDay('personal', 'Paris Trip', d(6, 27), 6, '6');
  allDay('personal', 'Hiking Trip', d(9, 5), 4);
  allDay('personal', 'Beach Weekend', d(8, 14), 3);
  allDay('family', 'Family Visit', d(11, 13), 9);
  allDay('family', "Mom's Birthday", d(3, 12));
  allDay('family', 'Anniversary', d(5, 20));
  allDay('personal', 'Ski Week', d(1, 29), 6); // crosses into February
  allDay('personal', 'New Year Getaway', d(12, 30), 4); // crosses into next year
  timed('personal', 'Dentist', d(2, 10), '09:30', '10:30');
  timed('work', 'Quarterly Review', d(4, 2), '14:00', '15:00');
  timed('personal', 'Concert', d(10, 3), '19:00', '22:00');
  allDay('work', 'Product Conference', d(5, 12), 3, '3');
  allDay('work', 'Team Offsite', d(8, 26), 2, '10');
  allDay('personal', 'Road Trip', d(4, 17), 5, '5');
  allDay('family', 'Kids Spring Break', d(3, 23), 5);
  allDay('personal', 'Lake Cabin', d(7, 17), 4);
  allDay('personal', 'Half Marathon', d(10, 18));
  allDay('family', 'Thanksgiving at Grandma’s', d(11, 25), 4);
  allDay('work', 'Year-end Planning', d(12, 7), 3, '3');
  timed('personal', 'Book Club', d(1, 14), '19:00', '20:30');
  timed('personal', 'Flight to Paris', d(6, 26), '17:45', '23:55', {
    location: 'SFO Terminal 2',
    description: 'Seat 23A. Check in online the day before, and bring the travel adapter.',
  });
  timed('work', 'Board Meeting', d(9, 22), '10:00', '12:00', { location: 'Room 4B' });
  timed('family', 'Parent–Teacher Night', d(10, 8), '18:00', '19:30');
}

const delay = () => new Promise((r) => setTimeout(r, 150));

export const mockBackend: Backend = {
  kind: 'mock',
  async signIn() { return true; },
  async signOut() {},

  async listCalendars() {
    await delay();
    return calendars;
  },

  async listEvents(calendarId, year) {
    await delay();
    seed(year);
    seed(year - 1); // so events crossing into this year from last are present
    const yStart = isoFromDayNum(dayNum(year, 1, 1));
    const yEnd = isoFromDayNum(dayNum(year + 1, 1, 1));
    return [...(store.get(calendarId)?.values() ?? [])].filter((e) => {
      const start = (e.start.date ?? e.start.dateTime!).slice(0, 10);
      const end = (e.end.date ?? e.end.dateTime!).slice(0, 10);
      return end > yStart && start < yEnd;
    });
  },

  async getEvent(calendarId, eventId) {
    await delay();
    const ev = store.get(calendarId)?.get(eventId);
    if (!ev) throw new ApiError(404, 'Not Found');
    return ev;
  },

  async createEvent(calendarId, body) {
    await delay();
    return put(calendarId, { ...body, id: `mock${nextId++}` } as GEvent);
  },

  async updateEvent(calendarId, eventId, body) {
    await delay();
    return put(calendarId, { ...body, id: eventId } as GEvent);
  },

  async moveEvent(fromCalendarId, eventId, toCalendarId) {
    await delay();
    const ev = store.get(fromCalendarId)?.get(eventId);
    if (!ev) throw new Error('Event not found');
    store.get(fromCalendarId)!.delete(eventId);
    return put(toCalendarId, ev);
  },

  async deleteEvent(calendarId, eventId) {
    await delay();
    store.get(calendarId)?.delete(eventId);
  },
};
