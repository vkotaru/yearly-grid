import { dayNum, daysInMonth } from './dates';
import type { GridEvent } from './types';

export interface YearLayout {
  /** Lane (row within a month) for each event key. */
  lanes: Map<string, number>;
  /** Lanes needed by each month, index 0 = January. */
  lanesByMonth: number[];
}

/**
 * Assigns each event the lowest lane that is free for its whole span.
 *
 * Lanes are shared across the year, so an event running Jan 30 → Feb 2 sits on
 * the same lane in both month rows. Each month row is only as tall as the
 * events that touch it need.
 */
export function layoutYear(events: GridEvent[], year: number, minLanes = 1): YearLayout {
  const yearStart = dayNum(year, 1, 1);
  const yearEnd = dayNum(year, 12, 31);

  const inYear = events
    .filter((e) => e.endDay >= yearStart && e.startDay <= yearEnd)
    .sort(
      (a, b) =>
        a.startDay - b.startDay ||
        (b.endDay - b.startDay) - (a.endDay - a.startDay) || // longer first
        Number(b.allDay) - Number(a.allDay) ||
        (a.timeLabel ?? '').localeCompare(b.timeLabel ?? '') ||
        a.title.localeCompare(b.title),
    );

  const laneEnds: number[] = []; // last occupied day per lane
  const lanes = new Map<string, number>();
  for (const e of inYear) {
    const start = Math.max(e.startDay, yearStart);
    const end = Math.min(e.endDay, yearEnd);
    let lane = laneEnds.findIndex((last) => last < start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    lanes.set(e.key, lane);
  }

  const lanesByMonth = Array.from({ length: 12 }, () => minLanes);
  for (const e of inYear) {
    const lane = lanes.get(e.key)!;
    for (let m = 1; m <= 12; m++) {
      const mStart = dayNum(year, m, 1);
      const mEnd = dayNum(year, m, daysInMonth(year, m));
      if (e.endDay >= mStart && e.startDay <= mEnd) {
        lanesByMonth[m - 1] = Math.max(lanesByMonth[m - 1], lane + 1);
      }
    }
  }

  return { lanes, lanesByMonth };
}

export interface Segment {
  event: GridEvent;
  lane: number;
  fromDay: number;          // 1-based day of month
  toDay: number;            // inclusive
  continuesBefore: boolean; // event started in an earlier month
  continuesAfter: boolean;  // event ends in a later month
}

/** The pieces of each event that fall inside one month row. */
export function monthSegments(events: GridEvent[], layout: YearLayout, year: number, month: number): Segment[] {
  const mStart = dayNum(year, month, 1);
  const mEnd = dayNum(year, month, daysInMonth(year, month));
  const segments: Segment[] = [];
  for (const e of events) {
    const lane = layout.lanes.get(e.key);
    if (lane === undefined || e.endDay < mStart || e.startDay > mEnd) continue;
    segments.push({
      event: e,
      lane,
      fromDay: Math.max(e.startDay, mStart) - mStart + 1,
      toDay: Math.min(e.endDay, mEnd) - mStart + 1,
      continuesBefore: e.startDay < mStart,
      continuesAfter: e.endDay > mEnd,
    });
  }
  return segments;
}
