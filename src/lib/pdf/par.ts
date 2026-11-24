import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { getParPeriodDates, type ParPeriodId } from "../par/periods";
import {
  PTO_GRANT_ID,
  summarizeParLines,
  type ParLine,
} from "../par/summarize";

export const PAR_SHORT_ROWS = 6;
export const PAR_LONG_ROWS = 16;

export interface ParPdfSignature {
  png: Uint8Array;
  /** "YYYY-MM-DD" or an ISO timestamp. Printed as MM/DD/YYYY, Chicago time. */
  signedAt: string;
}

export interface ParPdfInput {
  periodId: ParPeriodId;
  employee: { name: string; jobTitle: string };
  grants: {
    grantId: string;
    name: string;
    contract: string;
    percent: number;
  }[];
  /** Allocation generator output. grantId "PTO" is the uncompensated leave row. */
  rows: ParLine[];
  signatures?: { employee?: ParPdfSignature; supervisor?: ParPdfSignature };
}

// US Letter landscape, same as docs/samples/par/par-filled.pdf.
const PAGE_W = 792;
const PAGE_H = 612;
const MARGIN = 20;
const GRAY = rgb(0.85, 0.85, 0.85);
const BLACK = rgb(0, 0, 0);

const LABEL_W = 190;
const INTERNAL_W = 90;
const DAYS_W = 432;
const TOTAL_W = PAGE_W - 2 * MARGIN - LABEL_W - INTERNAL_W - DAYS_W;

const signedAtFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function fmtHours(n: number): string {
  return n.toFixed(1);
}

function fmtPercent(n: number): string {
  return `${Number(n.toFixed(1))}%`;
}

function fmtSignedAt(signedAt: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(signedAt);
  if (dateOnly) return `${dateOnly[2]}/${dateOnly[3]}/${dateOnly[1]}`;
  const d = new Date(signedAt);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid signedAt: ${signedAt}`);
  }
  return signedAtFormatter.format(d);
}

interface Pen {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
}

function text(
  pen: Pen,
  s: string,
  x: number,
  top: number,
  size: number,
  opts: {
    bold?: boolean;
    align?: "left" | "center" | "right";
    w?: number;
  } = {},
) {
  const font = opts.bold ? pen.bold : pen.font;
  const width = font.widthOfTextAtSize(s, size);
  let dx = x;
  if (opts.align === "center") dx = x + ((opts.w ?? 0) - width) / 2;
  if (opts.align === "right") dx = x + (opts.w ?? 0) - width;
  pen.page.drawText(s, {
    x: dx,
    y: PAGE_H - top - size,
    size,
    font,
    color: BLACK,
  });
}

function box(
  pen: Pen,
  x: number,
  top: number,
  w: number,
  h: number,
  fill = false,
) {
  pen.page.drawRectangle({
    x,
    y: PAGE_H - top - h,
    width: w,
    height: h,
    borderColor: BLACK,
    borderWidth: 0.5,
    ...(fill ? { color: GRAY } : {}),
  });
}

function line(pen: Pen, x1: number, x2: number, top: number) {
  pen.page.drawLine({
    start: { x: x1, y: PAGE_H - top },
    end: { x: x2, y: PAGE_H - top },
    thickness: 0.7,
    color: BLACK,
  });
}

async function drawSignature(
  pdf: PDFDocument,
  pen: Pen,
  label: string,
  top: number,
  lineX2: number,
  sig: ParPdfSignature | undefined,
) {
  const dateX = lineX2 + 40;
  line(pen, MARGIN, lineX2, top);
  line(pen, dateX, dateX + 90, top);
  text(pen, label, MARGIN, top + 2, 7);
  text(pen, "Date:", dateX, top + 2, 7);
  if (!sig) return;

  const img = await pdf.embedPng(sig.png);
  // Captured at about 200x60 px; draw at 60% so it fits above the line.
  const scale = Math.min(120 / img.width, 36 / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  pen.page.drawImage(img, {
    x: MARGIN + 4,
    y: PAGE_H - top + 1,
    width: w,
    height: h,
  });
  text(pen, fmtSignedAt(sig.signedAt), dateX + 6, top - 12, 10);
}

/** Draw one PAR as a single-page PDF that mirrors docs/samples/par/par-filled.pdf. */
export async function renderParPdf(input: ParPdfInput): Promise<Uint8Array> {
  const { periodId, employee, grants, rows, signatures } = input;

  if (grants.length > PAR_LONG_ROWS) {
    throw new Error(
      `A PAR holds at most ${PAR_LONG_ROWS} grants, got ${grants.length}`,
    );
  }
  const period = getParPeriodDates(periodId);
  const grantIds = new Set(grants.map((g) => g.grantId));
  const dayIndex = new Map(period.days.map((d, i) => [d, i]));

  const cells = new Map<string, number>();
  for (const r of rows) {
    if (r.grantId !== PTO_GRANT_ID && !grantIds.has(r.grantId)) {
      throw new Error(`Unknown grant: ${r.grantId}`);
    }
    if (!dayIndex.has(r.date)) {
      throw new Error(`Date ${r.date} is outside period ${periodId}`);
    }
    const key = `${r.grantId}|${r.date}`;
    cells.set(key, (cells.get(key) ?? 0) + r.hours);
  }
  const summary = summarizeParLines(rows);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const pen: Pen = {
    page,
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);

  // Header
  for (const [i, s] of [
    "ALTERNATIVES, INC. STAFF",
    "PERSONNEL ACTIVITY REPORT (PAR)",
  ].entries()) {
    const size = 14;
    page.drawText(s, {
      x: (PAGE_W - titleFont.widthOfTextAtSize(s, size)) / 2,
      y: PAGE_H - 16 - size - i * 17,
      size,
      font: titleFont,
      color: BLACK,
    });
  }
  text(pen, "NAME:", MARGIN + 60, 62, 7, {});
  box(pen, MARGIN, 72, 160, 22);
  text(pen, employee.name, MARGIN, 78, 12, {
    bold: true,
    align: "center",
    w: 160,
  });
  text(pen, "PAY PERIOD ENDING DATE:", MARGIN, 104, 8);
  box(pen, MARGIN + 140, 101, 110, 16, true);
  text(
    pen,
    longDateFormatter.format(new Date(`${period.end}T00:00:00Z`)),
    MARGIN + 140,
    105,
    9,
    { bold: true, align: "center", w: 110 },
  );

  // Table
  const grantRows =
    grants.length <= PAR_SHORT_ROWS ? PAR_SHORT_ROWS : PAR_LONG_ROWS;
  const rowH = grantRows === PAR_SHORT_ROWS ? 18 : 14;
  const dayW = DAYS_W / period.days.length;
  const x0 = MARGIN;
  const xInternal = x0 + LABEL_W;
  const xDays = xInternal + INTERNAL_W;
  const xTotal = xDays + DAYS_W;
  let top = 124;

  const drawRow = (
    label: string,
    opts: {
      bold?: boolean;
      fill?: boolean;
      internal?: string;
      mergeDays?: boolean;
    } = {},
  ) => {
    box(pen, x0, top, LABEL_W, rowH, opts.fill);
    box(pen, xInternal, top, INTERNAL_W, rowH, opts.fill);
    if (opts.mergeDays) {
      box(pen, xDays, top, DAYS_W, rowH, opts.fill);
    } else {
      for (let i = 0; i < period.days.length; i++) {
        box(pen, xDays + i * dayW, top, dayW, rowH, opts.fill);
      }
    }
    box(pen, xTotal, top, TOTAL_W, rowH, opts.fill);
    text(pen, label, x0 + 3, top + (rowH - 7.5) / 2, 7.5, {
      bold: opts.bold,
      ...(opts.fill && opts.bold ? { align: "center", w: LABEL_W - 6 } : {}),
    });
    if (opts.internal) {
      text(pen, opts.internal, xInternal, top + (rowH - 7) / 2, 7, {
        bold: true,
        align: "center",
        w: INTERNAL_W,
      });
    }
  };
  const cellText = (s: string, i: number, bold = false) =>
    text(pen, s, xDays + i * dayW, top + (rowH - 8) / 2, 8, {
      bold,
      align: "center",
      w: dayW,
    });
  const totalText = (s: string, bold = false) =>
    text(pen, s, xTotal - 3, top + (rowH - 8.5) / 2, 8.5, {
      bold,
      align: "right",
      w: TOTAL_W,
    });

  drawRow("Reporting Activities", {
    bold: true,
    fill: true,
    mergeDays: true,
  });
  text(pen, "Day of the Month", xDays, top + (rowH - 8) / 2, 8, {
    align: "center",
    w: DAYS_W,
  });
  totalText("Total");
  top += rowH;

  drawRow(employee.jobTitle, {
    bold: true,
    fill: true,
    internal: "Internal Use Only",
  });
  period.days.forEach((d, i) => cellText(String(Number(d.slice(8))), i));
  totalText("Hours");
  top += rowH;

  const dataRow = (grantId: string) => {
    period.days.forEach((d, i) => {
      const v = cells.get(`${grantId}|${d}`);
      if (v !== undefined) cellText(fmtHours(v), i);
    });
    totalText(fmtHours(summary.byGrant[grantId] ?? 0));
  };

  for (let i = 0; i < grantRows; i++) {
    const g = grants[i];
    drawRow(g ? `${g.name} - ${g.contract} (${fmtPercent(g.percent)})` : "");
    if (g) dataRow(g.grantId);
    else totalText(fmtHours(0));
    top += rowH;
  }

  drawRow("Non-Program/Grant Related", { bold: true, fill: true });
  top += rowH;
  drawRow("Compensated Leave (vacation, personal, sick, holiday)");
  totalText(fmtHours(0));
  top += rowH;
  drawRow("Uncompensated Leave");
  dataRow(PTO_GRANT_ID);
  top += rowH;

  // Total hours row (no cell borders, like the sample)
  text(pen, "Total Hours", x0 + 3, top + (rowH - 7.5) / 2, 7.5);
  period.days.forEach((d, i) => cellText(fmtHours(summary.byDay[d] ?? 0), i));
  box(pen, xTotal, top, TOTAL_W, rowH, true);
  totalText(fmtHours(summary.total), true);
  top += rowH;

  // Signatures
  await drawSignature(
    pdf,
    pen,
    "Signature of Employee:",
    top + 42,
    x0 + 240,
    signatures?.employee,
  );
  top += 48;
  await drawSignature(
    pdf,
    pen,
    "Signature of Supervisor:",
    top + 42,
    x0 + 240,
    signatures?.supervisor,
  );
  top += 66;

  // Instructions
  text(pen, "INSTRUCTIONS", x0, top, 7, { bold: true });
  [
    "1. Enter your name in the cell near the top of the page.",
    "2. Enter the number of hours worked (rounded to the nearest half hour) for each of the grant-specific and other activities in the cell for the day in which it was worked. Weekend days should be left blank.",
    "3. After entering the information on the last day of the pay period, print the form, sign and date it, and submit it for your supervisor's signature.",
  ].forEach((s, i) => text(pen, s, x0, top + 10 + i * 9, 6.5));

  return pdf.save();
}
