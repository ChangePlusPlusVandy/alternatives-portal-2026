/**
 * Max hours per working day. To be confirmed with the client (including
 * weekend work). ALT-13 should import this rather than define its own copy.
 */
export const MAX_HOURS_PER_WORKING_DAY = 8;

export type HoursProblemCode =
  "not-a-number" | "zero-or-less" | "over-cap" | "not-tenths";

export interface HoursProblem {
  code: HoursProblemCode;
  message: string;
}

// Tolerance for floating-point noise (0.1 + 0.2 is 0.30000000000000004).
const EPSILON = 1e-9;

/**
 * Check the one number the employee enters: total hours worked in the period.
 * Returns a list of problems; an empty list means the value is valid.
 *
 * `workingDays` comes from getParPeriodDates. Throws if it is not a
 * non-negative number, since that is a bug in the caller, not user input.
 * Does not handle PTO or per-day entry.
 */
export function validatePeriodHours(
  totalHours: number,
  workingDays: number,
): HoursProblem[] {
  if (!Number.isFinite(workingDays) || workingDays < 0) {
    throw new RangeError(
      `workingDays must be a non-negative number, got ${workingDays}`,
    );
  }

  if (typeof totalHours !== "number" || !Number.isFinite(totalHours)) {
    return [
      { code: "not-a-number", message: "Enter the total hours as a number." },
    ];
  }

  const problems: HoursProblem[] = [];

  if (totalHours <= 0) {
    problems.push({
      code: "zero-or-less",
      message: "Hours must be more than 0.",
    });
  }

  const cap = MAX_HOURS_PER_WORKING_DAY * workingDays;
  if (totalHours - cap > EPSILON) {
    const message =
      workingDays === 0
        ? "This period has no working days, so no hours can be entered."
        : `That's more than ${MAX_HOURS_PER_WORKING_DAY} hours a day for ${workingDays} working ${
            workingDays === 1 ? "day" : "days"
          } (${cap}).`;
    problems.push({ code: "over-cap", message });
  }

  // Multiple of 0.1: compare after scaling to tenths, with tolerance for float noise.
  const tenths = totalHours * 10;
  if (Math.abs(tenths - Math.round(tenths)) > EPSILON) {
    problems.push({
      code: "not-tenths",
      message: "Use whole hours or tenths of an hour, like 7 or 7.3.",
    });
  }

  return problems;
}
