/** The grantId used for paid time off. Counts in `pto` and `total`, not in `worked`. */
export const PTO_GRANT_ID = "PTO";

export interface ParLine {
  /** Calendar date, e.g. "2026-10-16". Used only as a grouping key. */
  date: string;
  grantId: string;
  hours: number;
}

export interface ParSummary {
  /** grantId -> hours in the period. Includes PTO. */
  byGrant: Record<string, number>;
  /** date -> hours that day across all grants plus PTO. */
  byDay: Record<string, number>;
  /** Every grant except PTO. */
  worked: number;
  pto: number;
  /** worked + pto */
  total: number;
}

/** Round to one decimal so 0.1 + 0.2 gives 0.3, not 0.30000000000000004. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Sum PAR rows by grant and by day. Pure: does not modify `rows`.
 *
 * Throws if any row has negative (or non-finite) hours. Does NOT check the
 * 8-hour cap or the allocation split; that is the allocation generator's job.
 */
export function summarizeParLines(rows: ParLine[]): ParSummary {
  const byGrant: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let worked = 0;
  let pto = 0;

  rows.forEach((row, i) => {
    const { date, grantId, hours } = row;
    if (!Number.isFinite(hours)) {
      throw new Error(
        `Row ${i} (${date}, ${grantId}) has invalid hours: ${hours}`,
      );
    }
    if (hours < 0) {
      throw new Error(
        `Row ${i} (${date}, ${grantId}) has negative hours: ${hours}`,
      );
    }

    byGrant[grantId] = (byGrant[grantId] ?? 0) + hours;
    byDay[date] = (byDay[date] ?? 0) + hours;
    if (grantId === PTO_GRANT_ID) pto += hours;
    else worked += hours;
  });

  // Round once, at the end, so error doesn't build up row by row.
  for (const key of Object.keys(byGrant)) byGrant[key] = round1(byGrant[key]);
  for (const key of Object.keys(byDay)) byDay[key] = round1(byDay[key]);

  const roundedWorked = round1(worked);
  const roundedPto = round1(pto);

  return {
    byGrant,
    byDay,
    worked: roundedWorked,
    pto: roundedPto,
    // Built from the rounded parts, so total always equals worked + pto as printed.
    total: round1(roundedWorked + roundedPto),
  };
}
