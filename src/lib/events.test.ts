import { describe, expect, it } from 'vitest';
import { dayNum, dayOfWeek, isoFromDayNum } from './dates';
import { applyDraft, describeWhen, draftFromGridEvent, draftToEventBody, newDraft, toGridEvent, validateDraft } from './events';
import { layoutYear, monthSegments } from './layout';
import type { GCalendar, GEvent, GridEvent } from './types';

const cal: GCalendar = {
  id: 'cal1', summary: 'Me', backgroundColor: '#039be5', foregroundColor: '#000000', accessRole: 'owner',
};

function allDay(id: string, start: string, endExclusive: string): GEvent {
  return { id, summary: id, start: { date: start }, end: { date: endExclusive } };
}

describe('dates', () => {
  it('round-trips ISO dates', () => {
    expect(isoFromDayNum(dayNum(2026, 2, 28))).toBe('2026-02-28');
    expect(dayNum(2024, 3, 1) - dayNum(2024, 2, 28)).toBe(2); // leap year
  });
  it('knows weekdays', () => {
    expect(dayOfWeek(dayNum(2026, 10, 24))).toBe(6); // Saturday
  });
});

describe('toGridEvent', () => {
  it('treats all-day end dates as exclusive', () => {
    const g = toGridEvent(allDay('a', '2026-03-05', '2026-03-06'), cal)!;
    expect(g.startDay).toBe(dayNum(2026, 3, 5));
    expect(g.endDay).toBe(dayNum(2026, 3, 5));
    expect(g.allDay).toBe(true);
  });

  it('places timed events on their local days and drops a midnight end', () => {
    const g = toGridEvent({
      id: 't', start: { dateTime: '2026-03-05T22:00:00' }, end: { dateTime: '2026-03-06T00:00:00' },
    }, cal)!;
    expect(g.startDay).toBe(dayNum(2026, 3, 5));
    expect(g.endDay).toBe(dayNum(2026, 3, 5));
    expect(g.timeLabel).toBe('22:00');
  });

  it('skips cancelled events and uses event colours over calendar colours', () => {
    expect(toGridEvent({ ...allDay('c', '2026-01-01', '2026-01-02'), status: 'cancelled' }, cal)).toBeNull();
    expect(toGridEvent({ ...allDay('d', '2026-01-01', '2026-01-02'), colorId: '11' }, cal)!.color).toBe('#d50000');
  });
});

describe('drafts', () => {
  it('an untouched save changes nothing, for all-day and timed events', () => {
    const events: GEvent[] = [
      allDay('a', '2026-07-01', '2026-07-04'),
      // An event in another zone than the browser (whatever TZ the tests run in).
      { id: 'p', start: { dateTime: '2026-03-05T10:00:00+01:00', timeZone: 'Europe/Paris' },
        end: { dateTime: '2026-03-05T11:30:00+01:00', timeZone: 'Europe/Paris' } },
    ];
    for (const ev of events) {
      const draft = draftFromGridEvent(toGridEvent(ev, cal)!);
      expect(applyDraft(ev, draft, { ...draft }, 'UTC')).toEqual(ev);
    }
  });

  it('edits timed events in their own zone, not the browser zone', () => {
    const ev: GEvent = { id: 'p', start: { dateTime: '2026-03-05T10:00:00+01:00', timeZone: 'Europe/Paris' },
      end: { dateTime: '2026-03-05T11:00:00+01:00', timeZone: 'Europe/Paris' } };
    const draft = draftFromGridEvent(toGridEvent(ev, cal)!);
    expect([draft.startTime, draft.endTime, draft.startZone]).toEqual(['10:00', '11:00', 'Europe/Paris']);
    const body = applyDraft(ev, draft, { ...draft, endTime: '12:00' }, 'America/Los_Angeles');
    expect(body.start).toEqual({ dateTime: '2026-03-05T10:00:00', timeZone: 'Europe/Paris' });
    expect(body.end).toEqual({ dateTime: '2026-03-05T12:00:00', timeZone: 'Europe/Paris' });
  });

  it('keeps separate start and end zones (e.g. a flight)', () => {
    const ev: GEvent = { id: 'f', start: { dateTime: '2026-06-01T08:00:00-07:00', timeZone: 'America/Los_Angeles' },
      end: { dateTime: '2026-06-01T16:30:00-04:00', timeZone: 'America/New_York' } };
    const draft = draftFromGridEvent(toGridEvent(ev, cal)!);
    expect([draft.startTime, draft.endTime]).toEqual(['08:00', '16:30']);
    const body = applyDraft(ev, draft, { ...draft, startTime: '09:00' }, 'UTC');
    expect(body.end).toEqual({ dateTime: '2026-06-01T16:30:00', timeZone: 'America/New_York' });
  });

  it('applies only edited fields on top of the fresh event', () => {
    const cached = allDay('a', '2026-07-01', '2026-07-02');
    const initial = draftFromGridEvent(toGridEvent(cached, cal)!);
    // Since the grid loaded, someone changed the description and added a guest.
    const fresh: GEvent = { ...cached, description: 'new notes', attendees: [{ email: 'x@example.com' }], etag: '"2"' };
    const body = applyDraft(fresh, initial, { ...initial, title: 'Renamed' }, 'UTC');
    expect(body.summary).toBe('Renamed');
    expect(body.description).toBe('new notes');
    expect(body.attendees).toEqual([{ email: 'x@example.com' }]);
    expect(body.start).toEqual(fresh.start);
  });

  it('builds timed bodies in the given zone and validates ranges', () => {
    const d = { ...newDraft('cal1', dayNum(2026, 5, 2), dayNum(2026, 5, 2)), allDay: false };
    expect(draftToEventBody(d, 'America/Los_Angeles').start)
      .toEqual({ dateTime: '2026-05-02T09:00:00', timeZone: 'America/Los_Angeles' });
    expect(validateDraft({ ...d, endTime: '08:00' })).not.toBeNull();
    expect(validateDraft({ ...d, endDay: d.startDay - 1, allDay: true })).not.toBeNull();
    expect(validateDraft(d)).toBeNull();
  });

  it('newDraft orders a backwards drag', () => {
    const d = newDraft('cal1', 10, 4);
    expect([d.startDay, d.endDay]).toEqual([4, 10]);
  });
});

describe('layoutYear', () => {
  const g = (id: string, start: string, endEx: string): GridEvent => toGridEvent(allDay(id, start, endEx), cal)!;

  it('stacks overlaps and reuses freed lanes', () => {
    const events = [g('a', '2026-01-01', '2026-01-10'), g('b', '2026-01-05', '2026-01-06'), g('c', '2026-01-12', '2026-01-13')];
    const { lanes, lanesByMonth } = layoutYear(events, 2026);
    expect(lanes.get('cal1|a')).toBe(0);
    expect(lanes.get('cal1|b')).toBe(1);
    expect(lanes.get('cal1|c')).toBe(0);
    expect(lanesByMonth[0]).toBe(2);
    expect(lanesByMonth[1]).toBe(1);
  });

  it('splits cross-month events into segments on the same lane', () => {
    const events = [g('trip', '2026-01-30', '2026-02-03')];
    const layout = layoutYear(events, 2026);
    const [jan] = monthSegments(events, layout, 2026, 1);
    const [feb] = monthSegments(events, layout, 2026, 2);
    expect([jan.fromDay, jan.toDay, jan.continuesAfter]).toEqual([30, 31, true]);
    expect([feb.fromDay, feb.toDay, feb.continuesBefore]).toEqual([1, 2, true]);
    expect(jan.lane).toBe(feb.lane);
  });

  it('clips events that cross the year boundary', () => {
    const events = [g('nye', '2025-12-30', '2026-01-03')];
    const [seg] = monthSegments(events, layoutYear(events, 2026), 2026, 1);
    expect([seg.fromDay, seg.toDay, seg.continuesBefore]).toEqual([1, 2, true]);
  });
});

describe('describeWhen', () => {
  const timed = (start: string, end: string) =>
    toGridEvent({ id: 't', start: { dateTime: start }, end: { dateTime: end } }, cal)!;
  // Day labels are locale-formatted, so compare against the same formatter's output for the day.
  const label = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      .format(new Date(`${iso}T12:00:00`));

  it('describes all-day events', () => {
    expect(describeWhen(toGridEvent(allDay('a', '2026-03-05', '2026-03-06'), cal)!)).toBe(label('2026-03-05'));
    expect(describeWhen(toGridEvent(allDay('a', '2026-03-05', '2026-03-09'), cal)!))
      .toBe(`${label('2026-03-05')} – ${label('2026-03-08')}`);
  });
  it('describes timed events', () => {
    expect(describeWhen(timed('2026-03-05T10:00:00', '2026-03-05T11:30:00')))
      .toBe(`${label('2026-03-05')} · 10:00 – 11:30`);
    expect(describeWhen(timed('2026-03-05T23:00:00', '2026-03-06T00:00:00')))
      .toBe(`${label('2026-03-05')} · 23:00 – 00:00`);
    expect(describeWhen(timed('2026-03-05T22:00:00', '2026-03-06T07:00:00')))
      .toBe(`${label('2026-03-05')}, 22:00 – ${label('2026-03-06')}, 07:00`);
  });
});
