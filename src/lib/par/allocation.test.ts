import { describe, expect, it } from "vitest";

import {
  generateParAllocation,
  PTO_GRANT_ID,
  type ParAllocation,
  type ParAllocationInput,
} from "./allocation";
import { getParPeriodDates } from "./periods";

const tenths = (hours: number) => Math.round(hours * 10);

function hoursFor(
  result: ParAllocation,
  grantId: string,
  date: string,
): number {
  const row = result.rows.find((r) => r.grantId === grantId && r.date === date);
  if (!row) throw new Error(`Missing row ${grantId} ${date}`);
  return row.hours;
}

/** Checks rules 1, 2, 4a, 4b, and 5, plus the shape of the output. */
function expectValidPar(input: ParAllocationInput, result: ParAllocation) {
  const { days, workingDays } = getParPeriodDates(
    input.periodId,
    input.holidays ?? [],
  );
  const grantIds = input.grants.map((g) => g.grantId);

  expect(result.periodId).toBe(input.periodId);
  expect(result.rows).toHaveLength(days.length * (grantIds.length + 1));

  for (const row of result.rows) {
    expect(row.hours).toBeGreaterThanOrEqual(0);
    expect(Math.abs(row.hours * 10 - tenths(row.hours))).toBeLessThan(1e-9);
  }

  const workedByDay = days.map((date) =>
    grantIds.reduce((sum, id) => sum + tenths(hoursFor(result, id, date)), 0),
  );
  days.forEach((date, i) => {
    const pto = tenths(hoursFor(result, PTO_GRANT_ID, date));
    expect(pto).toBe(tenths(input.pto?.[date] ?? 0));
    expect(workedByDay[i] + pto).toBeLessThanOrEqual(80);
    if (!workingDays.includes(date)) expect(workedByDay[i]).toBe(0);
    if (input.hoursPerDay)
      expect(workedByDay[i]).toBe(tenths(input.hoursPerDay[date] ?? 0));
  });

  const total = workedByDay.reduce((sum, h) => sum + h, 0);
  if (input.totalHours !== undefined)
    expect(total).toBe(tenths(input.totalHours));

  const largest = input.grants.reduce((best, g) =>
    g.percent > best.percent ? g : best,
  );
  let grantSum = 0;
  for (const { grantId, percent } of input.grants) {
    const grantTotal = days.reduce(
      (sum, d) => sum + tenths(hoursFor(result, grantId, d)),
      0,
    );
    grantSum += grantTotal;
    if (grantId !== largest.grantId) {
      expect(grantTotal).toBe(Math.round((percent * total) / 100));
    }
  }
  expect(grantSum).toBe(total);

  const workedDays = days.filter((_, i) => workedByDay[i] > 0);
  if (input.grants.length < 2 || workedDays.length < 3) return;

  const maxDay = Math.max(...workedByDay);
  for (const { grantId, percent } of input.grants) {
    const perDay = workedDays.map((d) => tenths(hoursFor(result, grantId, d)));
    const grantTotal = perDay.reduce((sum, h) => sum + h, 0);
    if (percent < 25) {
      expect(perDay.filter((h) => h > 0).length).toBeLessThanOrEqual(
        Math.floor(workedDays.length / 2),
      );
    }
    expect(Math.max(...perDay) - Math.min(...perDay)).toBeGreaterThanOrEqual(
      Math.min(20, grantTotal, maxDay),
    );
  }
}

const OCT_WORKING_DAYS = getParPeriodDates("2026-P20").workingDays;

const example1: ParAllocationInput = {
  periodId: "2026-P20",
  grants: [
    { grantId: "Grant A", percent: 10 },
    { grantId: "Grant B", percent: 10 },
    { grantId: "Grant C", percent: 80 },
  ],
  hoursPerDay: Object.fromEntries(OCT_WORKING_DAYS.map((d) => [d, 8])),
  seed: 42,
};

const example2: ParAllocationInput = {
  periodId: "2026-P21",
  grants: [
    { grantId: "Grant A", percent: 60 },
    { grantId: "Grant D", percent: 40 },
  ],
  totalHours: 52,
  pto: { "2026-11-06": 4, "2026-11-13": 8 },
  holidays: ["2026-11-11"],
  seed: 7,
};

describe("generateParAllocation", () => {
  it("handles the 10/10/80 example with per-day hours", () => {
    const result = generateParAllocation(example1);
    expectValidPar(example1, result);

    const total = (id: string) =>
      OCT_WORKING_DAYS.reduce(
        (sum, d) => sum + tenths(hoursFor(result, id, d)),
        0,
      );
    expect(total("Grant A")).toBe(88);
    expect(total("Grant B")).toBe(88);
    expect(total("Grant C")).toBe(704);
  });

  it("zeroes weekends", () => {
    const result = generateParAllocation(example1);
    for (const id of ["Grant A", "Grant B", "Grant C", PTO_GRANT_ID]) {
      expect(hoursFor(result, id, "2026-10-17")).toBe(0);
      expect(hoursFor(result, id, "2026-10-18")).toBe(0);
    }
  });

  it("handles period total mode with partial PTO, a full PTO day, and a holiday", () => {
    const result = generateParAllocation(example2);
    expectValidPar(example2, result);

    const worked = (date: string) =>
      ["Grant A", "Grant D"].reduce(
        (sum, id) => sum + hoursFor(result, id, date),
        0,
      );
    expect(worked("2026-11-06")).toBeLessThanOrEqual(4);
    expect(worked("2026-11-13")).toBe(0);
    expect(worked("2026-11-11")).toBe(0);
    expect(hoursFor(result, PTO_GRANT_ID, "2026-11-13")).toBe(8);
  });

  it("handles a single grant", () => {
    const input: ParAllocationInput = {
      periodId: "2026-P20",
      grants: [{ grantId: "Grant A", percent: 100 }],
      totalHours: 40,
      seed: 1,
    };
    expectValidPar(input, generateParAllocation(input));
  });

  it("handles six grants", () => {
    const input: ParAllocationInput = {
      periodId: "2026-P20",
      grants: [
        { grantId: "Grant A", percent: 5 },
        { grantId: "Grant B", percent: 10 },
        { grantId: "Grant C", percent: 15 },
        { grantId: "Grant D", percent: 20 },
        { grantId: "Grant E", percent: 20 },
        { grantId: "Grant F", percent: 30 },
      ],
      totalHours: 88,
      seed: 3,
    };
    expectValidPar(input, generateParAllocation(input));
  });

  it("keeps totals exact when they don't divide evenly", () => {
    const input: ParAllocationInput = {
      periodId: "2026-P20",
      grants: [
        { grantId: "Grant A", percent: 33.3 },
        { grantId: "Grant B", percent: 33.3 },
        { grantId: "Grant C", percent: 33.4 },
      ],
      totalHours: 61.7,
      seed: 5,
    };
    expectValidPar(input, generateParAllocation(input));
  });

  it("is deterministic for a seed", () => {
    expect(generateParAllocation(example1)).toEqual(
      generateParAllocation(example1),
    );
  });

  it("puts concentrated hours on different days for different seeds", () => {
    const daysUsed = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      const result = generateParAllocation({ ...example1, seed });
      daysUsed.add(
        OCT_WORKING_DAYS.filter((d) => hoursFor(result, "Grant A", d) > 0).join(
          ",",
        ),
      );
    }
    expect(daysUsed.size).toBeGreaterThan(5);
  });

  it("does not apply the same split every day", () => {
    const result = generateParAllocation(example1);
    const grantC = OCT_WORKING_DAYS.map((d) => hoursFor(result, "Grant C", d));
    expect(grantC).toContain(8);
    expect(new Set(grantC).size).toBeGreaterThan(1);
  });

  describe("input errors", () => {
    const base = { periodId: "2026-P20", grants: example1.grants };

    it("rejects percentages that don't sum to 100", () => {
      expect(() =>
        generateParAllocation({
          ...base,
          grants: [{ grantId: "Grant A", percent: 90 }],
          totalHours: 40,
        }),
      ).toThrow(/sum to 100/);
    });

    it("rejects both or neither input mode", () => {
      expect(() => generateParAllocation(base)).toThrow(/exactly one/);
      expect(() =>
        generateParAllocation({
          ...base,
          totalHours: 8,
          hoursPerDay: { "2026-10-16": 8 },
        }),
      ).toThrow(/exactly one/);
    });

    it("rejects totalHours that can't fit under the daily cap", () => {
      expect(() =>
        generateParAllocation({ ...base, totalHours: 88.1 }),
      ).toThrow(/doesn't fit/);
      expect(() =>
        generateParAllocation({
          ...base,
          totalHours: 84,
          pto: { "2026-10-16": 8 },
        }),
      ).toThrow(/doesn't fit/);
    });

    it("rejects a day over 8 hours including PTO", () => {
      expect(() =>
        generateParAllocation({
          ...base,
          hoursPerDay: { "2026-10-16": 6 },
          pto: { "2026-10-16": 3 },
        }),
      ).toThrow(/daily cap/);
    });

    it("rejects hours on a weekend or holiday", () => {
      expect(() =>
        generateParAllocation({ ...base, hoursPerDay: { "2026-10-17": 4 } }),
      ).toThrow(/not a working day/);
      expect(() =>
        generateParAllocation({
          ...base,
          hoursPerDay: { "2026-10-16": 4 },
          holidays: ["2026-10-16"],
        }),
      ).toThrow(/not a working day/);
    });

    it("rejects invalid hours and grants", () => {
      expect(() => generateParAllocation({ ...base, totalHours: -1 })).toThrow(
        /non-negative/,
      );
      expect(() =>
        generateParAllocation({ ...base, totalHours: 8.25 }),
      ).toThrow(/0\.1/);
      expect(() =>
        generateParAllocation({
          ...base,
          grants: [
            { grantId: "Grant A", percent: 50 },
            { grantId: "Grant A", percent: 50 },
          ],
          totalHours: 8,
        }),
      ).toThrow(/Duplicate/);
      expect(() =>
        generateParAllocation({
          ...base,
          grants: [{ grantId: PTO_GRANT_ID, percent: 100 }],
          totalHours: 8,
        }),
      ).toThrow(/Invalid grantId/);
      expect(() =>
        generateParAllocation({ ...base, periodId: "2026-P25", totalHours: 8 }),
      ).toThrow(/Invalid PAR period/);
    });
  });

  // Hours are kept to at least half-time. Much lower totals (e.g. 0.6 hours a
  // day) can make rule 4b impossible; that's an open question on ALT-13.
  it("meets the rules for 1,000 random inputs", () => {
    let state = 12345;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const randomInt = (min: number, max: number) =>
      min + Math.floor(random() * (max - min + 1));

    for (let i = 0; i < 1000; i++) {
      const periodId = `${randomInt(2025, 2028)}-P${String(randomInt(1, 24)).padStart(2, "0")}`;
      const allWorkingDays = getParPeriodDates(periodId).workingDays;
      const holidays =
        random() < 0.3
          ? [allWorkingDays[randomInt(0, allWorkingDays.length - 1)]]
          : [];
      const workingDays = allWorkingDays.filter((d) => !holidays.includes(d));

      const grantCount = randomInt(1, 6);
      const weights = Array.from(
        { length: grantCount },
        () => random() ** 2 + 0.05,
      );
      const weightSum = weights.reduce((sum, w) => sum + w, 0);
      const percents = weights.map(
        (w) => 3 + Math.floor((w / weightSum) * (100 - 3 * grantCount)),
      );
      percents[0] += 100 - percents.reduce((sum, p) => sum + p, 0);
      const grants = percents.map((percent, g) => ({
        grantId: `Grant ${g + 1}`,
        percent,
      }));

      const pto: Record<string, number> = {};
      for (const d of workingDays) if (random() < 0.1) pto[d] = randomInt(1, 8);

      const input: ParAllocationInput = {
        periodId,
        grants,
        pto,
        holidays,
        seed: i,
      };
      if (random() < 0.5) {
        input.hoursPerDay = {};
        for (const d of workingDays) {
          const room = 80 - (pto[d] ?? 0) * 10;
          if (room > 0 && random() < 0.85)
            input.hoursPerDay[d] = randomInt(Math.min(20, room), room) / 10;
        }
      } else {
        const capacity = workingDays.reduce(
          (sum, d) => sum + 80 - (pto[d] ?? 0) * 10,
          0,
        );
        input.totalHours = randomInt(Math.floor(capacity / 2), capacity) / 10;
      }

      expectValidPar(input, generateParAllocation(input));
    }
  });
});
