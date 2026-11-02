/**
 * ALT-12: PAR Period Calculator
 * All dates are calendar dates in America/Chicago.
 * Date-only strings prevent timezone-related day shifts.
 */

export type ParPeriodId = string;
export type CalendarDate = string; // YYYY-MM-DD

export interface ParPeriodDates {
  start: CalendarDate;
  end: CalendarDate;
  label: string;
  days: CalendarDate[];
  workingDays: CalendarDate[];
}

const CHICAGO_TIME_ZONE = "America/Chicago";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: CHICAGO_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CHICAGO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatCalendarDate(
  year: number,
  month: number,
  day: number,
): CalendarDate {
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCalendarDate(date: CalendarDate): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  ) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  return { year, month, day };
}

function makePeriodId(year: number, number: number): ParPeriodId {
  return `${year}-P${String(number).padStart(2, "0")}`;
}

export function parsePeriodId(periodId: string): {
  year: number;
  number: number;
} {
  const match = /^(\d{4})-P(\d{2})$/.exec(periodId);

  if (!match) {
    throw new Error(`Invalid PAR period ID: ${periodId}`);
  }

  const year = Number(match[1]);
  const number = Number(match[2]);

  if (year < 1 || number < 1 || number > 24) {
    throw new Error(`Invalid PAR period ID: ${periodId}`);
  }

  return { year, number };
}

export function getParPeriodId(date: Date): ParPeriodId {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const parts = dateFormatter.formatToParts(date);
  const getPart = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Missing date component: ${type}`);
    return Number(value);
  };

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");

  const number = (month - 1) * 2 + (day <= 15 ? 1 : 2);

  return makePeriodId(year, number);
}

export function getParPeriodDates(
  periodId: ParPeriodId,
  holidays: CalendarDate[] = [],
): ParPeriodDates {
  const { year, number } = parsePeriodId(periodId);

  const month = Math.ceil(number / 2);
  const firstHalf = number % 2 === 1;

  const startDay = firstHalf ? 1 : 16;
  const endDay = firstHalf
    ? 15
    : new Date(Date.UTC(year, month, 0)).getUTCDate();

  const start = formatCalendarDate(year, month, startDay);
  const end = formatCalendarDate(year, month, endDay);

  const holidaySet = new Set(holidays);
  for (const holiday of holidaySet) {
    parseCalendarDate(holiday);
  }

  const days: CalendarDate[] = [];
  const workingDays: CalendarDate[] = [];

  for (let day = startDay; day <= endDay; day++) {
    const calendarDate = formatCalendarDate(year, month, day);
    days.push(calendarDate);

    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    if (weekday !== 0 && weekday !== 6 && !holidaySet.has(calendarDate)) {
      workingDays.push(calendarDate);
    }
  }

  const monthName = monthFormatter.format(
    new Date(Date.UTC(2020, month - 1, 15, 12)),
  );

  const label = `${monthName} ${startDay}–${endDay}, ${year}`;

  return { start, end, label, days, workingDays };
}

export function nextPeriodId(periodId: ParPeriodId): ParPeriodId {
  const { year, number } = parsePeriodId(periodId);

  if (number === 24) {
    return makePeriodId(year + 1, 1);
  }

  return makePeriodId(year, number + 1);
}

export function previousPeriodId(periodId: ParPeriodId): ParPeriodId {
  const { year, number } = parsePeriodId(periodId);

  if (number === 1) {
    if (year === 1) {
      throw new Error("Cannot go before year 0001");
    }
    return makePeriodId(year - 1, 24);
  }

  return makePeriodId(year, number - 1);
}
