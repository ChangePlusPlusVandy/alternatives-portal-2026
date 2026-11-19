import { describe, expect, it } from "vitest";
import { PTO_GRANT_ID, summarizeParLines, type ParLine } from "./summarize";

// SPEC 3.5: Oct 16-31, 2026 has 11 working days. Allocation A 10%, B 10%, C 80%.
const DAYS = [
  "2026-10-16",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-26",
  "2026-10-27",
  "2026-10-28",
  "2026-10-29",
  "2026-10-30",
];

// [A, B, C] per day. The first three days are the grid shown in the SPEC.
const GRID: [number, number, number][] = [
  [0, 2.4, 5.6],
  [4.8, 0, 3.2],
  [0.8, 1.6, 5.6],
  ...Array.from({ length: 8 }, (): [number, number, number] => [0.4, 0.6, 7.0]),
];

function specRows(): ParLine[] {
  return DAYS.flatMap((date, i) => [
    { date, grantId: "grant-a", hours: GRID[i][0] },
    { date, grantId: "grant-b", hours: GRID[i][1] },
    { date, grantId: "grant-c", hours: GRID[i][2] },
  ]);
}

describe("summarizeParLines", () => {
  it("matches the SPEC 3.5 example: 8.8, 8.8, 70.4 and 88", () => {
    const s = summarizeParLines(specRows());
    expect(s.byGrant).toEqual({
      "grant-a": 8.8,
      "grant-b": 8.8,
      "grant-c": 70.4,
    });
    expect(s.worked).toBe(88);
    expect(s.pto).toBe(0);
    expect(s.total).toBe(88);
    expect(Object.keys(s.byDay)).toHaveLength(11);
    expect(Object.values(s.byDay).every((h) => h === 8)).toBe(true);
  });

  it("counts PTO in byGrant, byDay, pto and total, but not worked", () => {
    const s = summarizeParLines([
      { date: "2026-10-16", grantId: "grant-a", hours: 4 },
      { date: "2026-10-16", grantId: PTO_GRANT_ID, hours: 4 },
      { date: "2026-10-19", grantId: PTO_GRANT_ID, hours: 8 },
      { date: "2026-10-20", grantId: "grant-a", hours: 8 },
    ]);
    expect(s.byGrant).toEqual({ "grant-a": 12, PTO: 12 });
    expect(s.byDay).toEqual({
      "2026-10-16": 8,
      "2026-10-19": 8,
      "2026-10-20": 8,
    });
    expect(s.worked).toBe(12);
    expect(s.pto).toBe(12);
    expect(s.total).toBe(24);
  });

  it("rounds float error: 0.1 + 0.2 is 0.3", () => {
    const s = summarizeParLines([
      { date: "2026-10-16", grantId: "grant-a", hours: 0.1 },
      { date: "2026-10-16", grantId: "grant-a", hours: 0.2 },
    ]);
    expect(s.byGrant["grant-a"]).toBe(0.3);
    expect(s.byDay["2026-10-16"]).toBe(0.3);
    expect(s.worked).toBe(0.3);
    expect(s.total).toBe(0.3);
  });

  it("keeps total equal to worked + pto when both are rounded", () => {
    const s = summarizeParLines([
      { date: "2026-10-16", grantId: "grant-a", hours: 0.1 },
      { date: "2026-10-16", grantId: "grant-a", hours: 0.2 },
      { date: "2026-10-19", grantId: PTO_GRANT_ID, hours: 0.7 },
    ]);
    expect(s.total).toBe(1);
    expect(s.total).toBe(Math.round((s.worked + s.pto) * 10) / 10);
  });

  it("returns zeros and empty maps for empty input", () => {
    expect(summarizeParLines([])).toEqual({
      byGrant: {},
      byDay: {},
      worked: 0,
      pto: 0,
      total: 0,
    });
  });

  it("throws on negative hours", () => {
    expect(() =>
      summarizeParLines([
        { date: "2026-10-16", grantId: "grant-a", hours: -1 },
      ]),
    ).toThrow(/negative/i);
  });

  it("throws on non-finite hours instead of returning NaN", () => {
    expect(() =>
      summarizeParLines([
        { date: "2026-10-16", grantId: "grant-a", hours: Number.NaN },
      ]),
    ).toThrow(/invalid/i);
  });

  it("does not modify its input", () => {
    const rows = specRows();
    const copy = structuredClone(rows);
    summarizeParLines(rows);
    expect(rows).toEqual(copy);
  });
});
