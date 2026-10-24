// Day arithmetic on "day numbers": whole days since 1970-01-01 in the *local*
// calendar. Using integers for days sidesteps DST and timezone drift — a day
// number never changes length, unlike a Date at local midnight.

const MS_PER_DAY = 86_400_000;

export function dayNum(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNum(n: number): { year: number; month: number; day: number } {
  const d = new Date(n * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 'YYYY-MM-DD' → day number. */
export function dayNumFromIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return dayNum(y, m, d);
}

/** Day number → 'YYYY-MM-DD'. */
export function isoFromDayNum(n: number): string {
  const { year, month, day } = fromDayNum(n);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Local calendar day of an instant. */
export function dayNumFromDate(date: Date): number {
  return dayNum(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayDayNum(): number {
  return dayNumFromDate(new Date());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(n: number): number {
  // 1970-01-01 was a Thursday (4).
  return (((n + 4) % 7) + 7) % 7;
}

export function isWeekend(n: number): boolean {
  const dow = dayOfWeek(n);
  return dow === 0 || dow === 6;
}

/** 'HH:MM' local time of an instant. */
export function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Calendar day and 'HH:MM' of an RFC 3339 instant as seen in `timeZone`
 * (an IANA name), or in the local zone when it's omitted.
 */
export function zonedParts(dateTime: string, timeZone?: string): { day: number; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(dateTime));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const time = `${String(get('hour')).padStart(2, '0')}:${String(get('minute')).padStart(2, '0')}`;
  return { day: dayNum(get('year'), get('month'), get('day')), time };
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
