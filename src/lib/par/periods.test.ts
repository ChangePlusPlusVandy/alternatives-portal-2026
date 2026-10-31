import { describe, expect, it } from "vitest";

import {
  getParPeriodId,
  getParPeriodDates,
  parsePeriodId,
  nextPeriodId,
  previousPeriodId,
} from "./periods";

describe("PAR period calculator", () => {
  it("handles the 15th and 16th boundary", () => {
    expect(getParPeriodId(new Date("2026-10-15T12:00:00-05:00"))).toBe(
      "2026-P19",
    );

    expect(getParPeriodId(new Date("2026-10-16T12:00:00-05:00"))).toBe(
      "2026-P20",
    );
  });

  it("generates correct period IDs", () => {
    expect(getParPeriodId(new Date("2026-01-01T12:00:00-06:00"))).toBe(
      "2026-P01",
    );

    expect(getParPeriodId(new Date("2026-12-31T12:00:00-06:00"))).toBe(
      "2026-P24",
    );
  });

  it("uses America/Chicago for timezone boundaries", () => {
    expect(getParPeriodId(new Date("2026-10-16T02:00:00Z"))).toBe("2026-P19");
  });

  it("handles leap-year February", () => {
    const period = getParPeriodDates("2024-P04");

    expect(period.start).toBe("2024-02-16");
    expect(period.end).toBe("2024-02-29");
    expect(period.days).toHaveLength(14);
  });

  it("handles normal February", () => {
    const period = getParPeriodDates("2026-P04");

    expect(period.end).toBe("2026-02-28");
    expect(period.days).toHaveLength(13);
  });

  it("handles 30-day months", () => {
    const period = getParPeriodDates("2026-P08");

    expect(period.end).toBe("2026-04-30");
    expect(period.days).toHaveLength(15);
  });

  it("handles 31-day months", () => {
    const period = getParPeriodDates("2026-P20");

    expect(period.end).toBe("2026-10-31");
    expect(period.days).toHaveLength(16);
    expect(period.label).toBe("Oct 16–31, 2026");
  });

  it("excludes weekday holidays", () => {
    const normal = getParPeriodDates("2026-P20");
    const withHoliday = getParPeriodDates("2026-P20", ["2026-10-19"]);

    expect(withHoliday.workingDays).not.toContain("2026-10-19");
    expect(withHoliday.workingDays.length).toBe(normal.workingDays.length - 1);
  });

  it("does not double-count weekend holidays", () => {
    const normal = getParPeriodDates("2026-P20");
    const withHoliday = getParPeriodDates("2026-P20", ["2026-10-17"]);

    expect(withHoliday.workingDays).toEqual(normal.workingDays);
  });

  it("handles year rollover in both directions", () => {
    expect(nextPeriodId("2026-P24")).toBe("2027-P01");
    expect(previousPeriodId("2027-P01")).toBe("2026-P24");
  });

  it("parses valid IDs", () => {
    expect(parsePeriodId("2026-P20")).toEqual({
      year: 2026,
      number: 20,
    });
  });

  it("rejects invalid IDs", () => {
    expect(() => parsePeriodId("2026-P25")).toThrow();
    expect(() => parsePeriodId("2026-20")).toThrow();
    expect(() => parsePeriodId("2026-P00")).toThrow();
    expect(() => parsePeriodId("2026-P1")).toThrow();
  });
});
