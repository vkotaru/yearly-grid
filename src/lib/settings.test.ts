import { describe, expect, it } from 'vitest';
import { passesFilter } from './settings';
import { toGridEvent } from './events';
import type { GCalendar } from './types';

const cal: GCalendar = {
  id: 'cal1', summary: 'Me', backgroundColor: '#039be5', foregroundColor: '#000000', accessRole: 'owner',
};

const trip = toGridEvent({ id: 'trip', start: { date: '2026-03-05' }, end: { date: '2026-03-09' } }, cal)!;
const meeting = toGridEvent(
  { id: 'meeting', start: { dateTime: '2026-03-05T10:00:00' }, end: { dateTime: '2026-03-05T11:00:00' } }, cal,
)!;
const flight = toGridEvent(
  { id: 'flight', start: { dateTime: '2026-03-05T22:00:00' }, end: { dateTime: '2026-03-06T07:00:00' } }, cal,
)!;
const lateMeeting = toGridEvent( // ends at midnight, so it occupies one day
  { id: 'late', start: { dateTime: '2026-03-05T23:00:00' }, end: { dateTime: '2026-03-06T00:00:00' } }, cal,
)!;

describe('passesFilter', () => {
  it('shows everything by default', () => {
    expect([trip, meeting, flight, lateMeeting].every((g) => passesFilter(g, 'all'))).toBe(true);
  });
  it('keeps all-day and overnight events, drops same-day timed events', () => {
    expect(passesFilter(trip, 'multiDay')).toBe(true);
    expect(passesFilter(flight, 'multiDay')).toBe(true);
    expect(passesFilter(meeting, 'multiDay')).toBe(false);
    expect(passesFilter(lateMeeting, 'multiDay')).toBe(false);
  });
  it('keeps only all-day events', () => {
    expect(passesFilter(trip, 'allDay')).toBe(true);
    expect(passesFilter(flight, 'allDay')).toBe(false);
    expect(passesFilter(meeting, 'allDay')).toBe(false);
  });
});
