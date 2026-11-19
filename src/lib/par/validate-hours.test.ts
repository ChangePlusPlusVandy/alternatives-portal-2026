import { describe, expect, it } from "vitest";
import { validatePeriodHours } from "./validate-hours";

const codes = (total: number, days: number) =>
  validatePeriodHours(total, days).map((p) => p.code);

describe("validatePeriodHours", () => {
  it("accepts a valid value", () => {
    expect(validatePeriodHours(70.4, 11)).toEqual([]);
    expect(validatePeriodHours(40, 5)).toEqual([]);
  });

  describe("not-a-number", () => {
    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "rejects %s",
      (v) => {
        expect(codes(v, 11)).toEqual(["not-a-number"]);
      },
    );

    it("rejects a non-number at runtime", () => {
      expect(codes("88" as unknown as number, 11)).toEqual(["not-a-number"]);
    });
  });

  describe("zero-or-less", () => {
    it("rejects 0", () => {
      expect(codes(0, 11)).toEqual(["zero-or-less"]);
    });

    it("rejects a negative value", () => {
      expect(codes(-8, 11)).toEqual(["zero-or-less"]);
    });
  });

  describe("over-cap", () => {
    it("accepts exactly the cap: 88 for 11 days", () => {
      expect(validatePeriodHours(88, 11)).toEqual([]);
    });

    it("rejects just over the cap: 88.1 for 11 days", () => {
      expect(codes(88.1, 11)).toEqual(["over-cap"]);
    });

    it("uses plain words in the message", () => {
      expect(validatePeriodHours(88.1, 11)[0].message).toBe(
        "That's more than 8 hours a day for 11 working days (88).",
      );
    });

    it('says "day" for a single working day', () => {
      expect(validatePeriodHours(9, 1)[0].message).toBe(
        "That's more than 8 hours a day for 1 working day (8).",
      );
    });

    it("still flags a value like 88.04 that is over the cap", () => {
      expect(codes(88.04, 11)).toContain("over-cap");
    });
  });

  describe("not-tenths", () => {
    it("rejects 7.25", () => {
      expect(codes(7.25, 11)).toEqual(["not-tenths"]);
    });

    it("accepts 7.3 and 0.3", () => {
      expect(validatePeriodHours(7.3, 11)).toEqual([]);
      expect(validatePeriodHours(0.3, 11)).toEqual([]);
    });

    it("accepts float noise like 0.1 + 0.2", () => {
      expect(validatePeriodHours(0.1 + 0.2, 11)).toEqual([]);
    });

    it("accepts whole numbers", () => {
      expect(validatePeriodHours(8, 11)).toEqual([]);
    });
  });

  describe("workingDays of 0", () => {
    it("rejects any hours with a clear message", () => {
      const problems = validatePeriodHours(1, 0);
      expect(problems.map((p) => p.code)).toEqual(["over-cap"]);
      expect(problems[0].message).toBe(
        "This period has no working days, so no hours can be entered.",
      );
    });

    it("reports 0 hours as zero-or-less only", () => {
      expect(codes(0, 0)).toEqual(["zero-or-less"]);
    });
  });

  it("reports more than one problem when more than one applies", () => {
    expect(codes(88.25, 11)).toEqual(["over-cap", "not-tenths"]);
    expect(codes(-0.25, 11)).toEqual(["zero-or-less", "not-tenths"]);
  });

  it("throws when workingDays is not a non-negative number", () => {
    expect(() => validatePeriodHours(8, Number.NaN)).toThrow(RangeError);
    expect(() => validatePeriodHours(8, -1)).toThrow(RangeError);
  });
});
