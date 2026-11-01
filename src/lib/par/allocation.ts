/**
 * ALT-13: PAR allocation generator.
 * Spreads one employee's worked hours for one PAR period across days and
 * grants so that totals are exact but the daily split looks like real work.
 * All math is done in integer tenths of an hour to keep rounding exact.
 */

import { getParPeriodDates, type CalendarDate } from "./periods";

export const PTO_GRANT_ID = "PTO";

export interface GrantAllocation {
  grantId: string;
  percent: number;
}

export interface ParAllocationInput {
  periodId: string;
  grants: GrantAllocation[];
  /** Exactly one of hoursPerDay / totalHours. */
  hoursPerDay?: Record<CalendarDate, number>;
  totalHours?: number;
  pto?: Record<CalendarDate, number>;
  holidays?: CalendarDate[];
  seed?: number;
}

export interface ParAllocationOptions {
  /** Grants under this percent are concentrated on at most half the worked days. */
  smallGrantPercent?: number;
  /** Minimum gap between a grant's highest and lowest worked day. */
  minSpreadHours?: number;
}

export interface ParAllocationRow {
  date: CalendarDate;
  grantId: string;
  hours: number;
}

export interface ParAllocation {
  periodId: string;
  rows: ParAllocationRow[];
}

const DAILY_CAP_TENTHS = 80;
const MAX_ATTEMPTS = 1000;

export function generateParAllocation(
  input: ParAllocationInput,
  options: ParAllocationOptions = {},
): ParAllocation {
  const { smallGrantPercent = 25, minSpreadHours = 2 } = options;
  const { periodId, grants } = input;

  validateGrants(grants);
  if ((input.hoursPerDay === undefined) === (input.totalHours === undefined)) {
    throw new Error("Provide exactly one of hoursPerDay or totalHours");
  }

  const period = getParPeriodDates(periodId, input.holidays ?? []);
  const rng = mulberry32(input.seed ?? Math.floor(Math.random() * 2 ** 32));

  const pto = readDayHours(input.pto ?? {}, period.workingDays, "PTO");
  const worked =
    input.hoursPerDay !== undefined
      ? readDayHours(input.hoursPerDay, period.workingDays, "hoursPerDay")
      : spreadTotalHours(input.totalHours!, period.workingDays, pto, rng);

  for (const date of period.workingDays) {
    const dayTotal = (worked.get(date) ?? 0) + (pto.get(date) ?? 0);
    if (dayTotal > DAILY_CAP_TENTHS) {
      throw new Error(
        `${date} has ${dayTotal / 10} hours of work plus PTO, over the 8-hour daily cap`,
      );
    }
  }

  const workedDays = period.workingDays.filter((d) => (worked.get(d) ?? 0) > 0);
  const dayHours = workedDays.map((d) => worked.get(d)!);
  const targets = grantTargets(
    grants,
    dayHours.reduce((sum, h) => sum + h, 0),
  );

  const checkVariation = grants.length >= 2 && workedDays.length >= 3;
  let grid: number[][] | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !grid; attempt++) {
    const candidate = layOutGrid(dayHours, targets, rng);
    if (
      !checkVariation ||
      looksLikeRealWork(
        candidate,
        grants,
        dayHours,
        smallGrantPercent,
        Math.round(minSpreadHours * 10),
      )
    ) {
      grid = candidate;
    }
  }
  if (!grid) {
    throw new Error(
      `Could not generate a split for ${periodId} that meets the variation rules`,
    );
  }

  const rows: ParAllocationRow[] = [];
  for (const date of period.days) {
    const d = workedDays.indexOf(date);
    grants.forEach((grant, g) => {
      rows.push({
        date,
        grantId: grant.grantId,
        hours: d === -1 ? 0 : grid[g][d] / 10,
      });
    });
    rows.push({
      date,
      grantId: PTO_GRANT_ID,
      hours: (pto.get(date) ?? 0) / 10,
    });
  }
  return { periodId, rows };
}

function validateGrants(grants: GrantAllocation[]): void {
  if (grants.length === 0) throw new Error("At least one grant is required");

  const ids = new Set<string>();
  for (const { grantId, percent } of grants) {
    if (!grantId || grantId === PTO_GRANT_ID) {
      throw new Error(`Invalid grantId: "${grantId}"`);
    }
    if (ids.has(grantId)) throw new Error(`Duplicate grantId: ${grantId}`);
    ids.add(grantId);
    if (!Number.isFinite(percent) || percent <= 0) {
      throw new Error(`Grant ${grantId} has an invalid percent: ${percent}`);
    }
  }

  const sum = grants.reduce((total, g) => total + g.percent, 0);
  if (Math.abs(sum - 100) > 1e-9) {
    throw new Error(`Grant percentages must sum to 100, got ${sum}`);
  }
}

function toTenths(hours: number, label: string): number {
  const tenths = Math.round(hours * 10);
  if (
    !Number.isFinite(hours) ||
    hours < 0 ||
    Math.abs(tenths - hours * 10) > 1e-6
  ) {
    throw new Error(
      `${label} must be a non-negative multiple of 0.1 hours, got ${hours}`,
    );
  }
  return tenths;
}

function readDayHours(
  hours: Record<CalendarDate, number>,
  workingDays: CalendarDate[],
  label: string,
): Map<CalendarDate, number> {
  const result = new Map<CalendarDate, number>();
  for (const [date, value] of Object.entries(hours)) {
    if (!workingDays.includes(date)) {
      throw new Error(
        `${label} date ${date} is not a working day in this period`,
      );
    }
    result.set(date, toTenths(value, `${label} on ${date}`));
  }
  return result;
}

/** Spreads totalHours as evenly as possible over working days, under the daily cap minus PTO. */
function spreadTotalHours(
  totalHours: number,
  workingDays: CalendarDate[],
  pto: Map<CalendarDate, number>,
  rng: () => number,
): Map<CalendarDate, number> {
  let remaining = toTenths(totalHours, "totalHours");
  const caps = workingDays.map((d) =>
    Math.max(0, DAILY_CAP_TENTHS - (pto.get(d) ?? 0)),
  );
  const capacity = caps.reduce((sum, c) => sum + c, 0);
  if (remaining > capacity) {
    throw new Error(
      `totalHours ${totalHours} doesn't fit: this period has room for ${capacity / 10} hours under the 8-hour daily cap`,
    );
  }

  const spread = caps.map(() => 0);
  while (remaining > 0) {
    const open = caps.map((_, i) => i).filter((i) => spread[i] < caps[i]);
    const share = Math.floor(remaining / open.length);
    if (share === 0) {
      for (const i of shuffle(open, rng).slice(0, remaining)) spread[i]++;
      break;
    }
    for (const i of open) {
      const add = Math.min(share, caps[i] - spread[i]);
      spread[i] += add;
      remaining -= add;
    }
  }
  return new Map(workingDays.map((d, i) => [d, spread[i]]));
}

/** Each grant's period total in tenths. The rounding leftover goes to the largest grant. */
function grantTargets(
  grants: GrantAllocation[],
  totalTenths: number,
): number[] {
  const targets = grants.map((g) =>
    Math.round((g.percent * totalTenths) / 100),
  );
  const largest = grants.reduce(
    (best, g, i) => (g.percent > grants[best].percent ? i : best),
    0,
  );
  targets[largest] += totalTenths - targets.reduce((sum, t) => sum + t, 0);
  return targets;
}

/**
 * Cuts each grant's total into 1–3 uneven chunks, shuffles all chunks, and
 * lays them end to end across the worked days in a random order. Day and
 * grant totals are exact by construction; returns grid[grant][day].
 */
function layOutGrid(
  dayHours: number[],
  targets: number[],
  rng: () => number,
): number[][] {
  const chunks = targets.flatMap((total, grant) =>
    splitUnevenly(total, 1 + Math.floor(rng() * 3), rng).map((size) => ({
      grant,
      size,
    })),
  );
  const order = shuffle(
    dayHours.map((_, i) => i),
    rng,
  );
  const grid = targets.map(() => dayHours.map(() => 0));

  let slot = 0;
  let used = 0;
  for (const { grant, size } of shuffle(chunks, rng)) {
    let left = size;
    while (left > 0) {
      const day = order[slot];
      const take = Math.min(left, dayHours[day] - used);
      grid[grant][day] += take;
      left -= take;
      used += take;
      if (used === dayHours[day]) {
        slot++;
        used = 0;
      }
    }
  }
  return grid;
}

function splitUnevenly(
  total: number,
  parts: number,
  rng: () => number,
): number[] {
  const weights = Array.from({ length: parts }, () => 0.3 + rng());
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const sizes = weights.map((w) => Math.floor((total * w) / weightSum));
  sizes[0] += total - sizes.reduce((sum, s) => sum + s, 0);
  return sizes.filter((s) => s > 0);
}

/**
 * Rules 4a and 4b. The required spread is capped at the grant's total and the
 * longest worked day, since a larger spread is impossible there.
 */
function looksLikeRealWork(
  grid: number[][],
  grants: GrantAllocation[],
  dayHours: number[],
  smallGrantPercent: number,
  minSpreadTenths: number,
): boolean {
  const maxDay = Math.max(...dayHours);
  return grid.every((row, g) => {
    const daysUsed = row.filter((h) => h > 0).length;
    if (
      grants[g].percent < smallGrantPercent &&
      daysUsed > Math.floor(row.length / 2)
    ) {
      return false;
    }
    const total = row.reduce((sum, h) => sum + h, 0);
    const required = Math.min(minSpreadTenths, total, maxDay);
    return Math.max(...row) - Math.min(...row) >= required;
  });
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
