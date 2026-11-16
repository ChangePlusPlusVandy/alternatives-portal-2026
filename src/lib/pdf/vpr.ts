import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

export interface VprSignature {
  png: Uint8Array;
  signedAt: string;
}

export interface VprInput {
  invoiceDate: string;
  vendor: {
    name: string;
    remittanceAddress: string;
    phone?: string;
    email?: string;
    accountNumber?: string;
    isNew: boolean;
    w9Attached: boolean;
    giveCheckToSubmitter: boolean;
  };
  submittedBy: string;
  invoiceNumber: string;
  description: string;
  totalInvoiceAmount: number;
  coding: {
    grant: string;
    program: string;
    subProgram: string;
    glCode: string;
    amount: number;
  }[];
  codedBy: string;
  codingApprovedBy: string;
  signatures?: { manager?: VprSignature; director?: VprSignature };
}

/** How many coding rows fit on the one-page form (the blank xlsx has six). */
export const VPR_MAX_CODING_LINES = 6;

// US Letter, in PDF points.
const PAGE = { width: 612, height: 792 };
const SIG_BOX = { width: 200, height: 60 };
const ATTESTATION =
  "By signing you attest the the expenses coded to the grant are necessary, reasonable, and allowable under the grant agreement.";

// Horizontal layout, matching the sample: labels end at LABEL_X, values sit on
// lines from LABEL_X + GAP to LINE_END. Tables run TABLE_LEFT to TABLE_RIGHT.
const LABEL_X = 166;
const GAP = 4;
const LINE_START = LABEL_X + GAP;
const LINE_END = 467;
const TABLE_LEFT = 50;
const TABLE_RIGHT = 518;

const BLACK = rgb(0, 0, 0);

const toCents = (n: number) => Math.round(n * 100);
const money = (n: number) => n.toFixed(2);

function validate(input: VprInput) {
  const { coding, totalInvoiceAmount } = input;
  if (!Number.isFinite(totalInvoiceAmount)) {
    throw new RangeError("totalInvoiceAmount must be a number.");
  }
  if (coding.length === 0) {
    throw new RangeError("A VPR needs at least one coding line.");
  }
  if (coding.length > VPR_MAX_CODING_LINES) {
    throw new RangeError(
      `A VPR holds at most ${VPR_MAX_CODING_LINES} coding lines, got ${coding.length}.`,
    );
  }
  for (const line of coding) {
    if (!Number.isFinite(line.amount)) {
      throw new RangeError("Every coding amount must be a number.");
    }
  }
  const codedCents = coding.reduce((sum, l) => sum + toCents(l.amount), 0);
  if (codedCents !== toCents(totalInvoiceAmount)) {
    throw new RangeError(
      `Coding amounts add up to ${money(codedCents / 100)} but the total invoice amount is ${money(totalInvoiceAmount)}.`,
    );
  }
}

/**
 * Render the Vendor Payment Request (VPR) as a one-page Letter PDF.
 * Pure: no database, no I/O. Throws RangeError if the coding amounts don't
 * sum to the total invoice amount, or if there are no or too many coding lines.
 * An unsigned signature spot is a blank line.
 */
export async function renderVprPdf(input: VprInput): Promise<Uint8Array> {
  validate(input);

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Work in "distance from top" so the code reads like the form.
  const y = (fromTop: number) => PAGE.height - fromTop;

  // Draw text in the box [x, x + width], shrinking (then truncating) to fit.
  const text = (
    s: string,
    x: number,
    fromTop: number,
    width: number,
    opts: {
      font?: PDFFont;
      size?: number;
      align?: "left" | "right" | "center";
    } = {},
  ) => {
    const f = opts.font ?? font;
    let size = opts.size ?? 10;
    while (size > 6 && f.widthOfTextAtSize(s, size) > width) size -= 0.5;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(out, size) > width) {
      out = out.slice(0, -2) + "-";
    }
    const w = f.widthOfTextAtSize(out, size);
    const dx =
      opts.align === "right"
        ? width - w
        : opts.align === "center"
          ? (width - w) / 2
          : 0;
    page.drawText(out, {
      x: x + dx,
      y: y(fromTop),
      size,
      font: f,
      color: BLACK,
    });
  };

  const hLine = (x1: number, x2: number, fromTop: number, thickness = 0.75) =>
    page.drawLine({
      start: { x: x1, y: y(fromTop) },
      end: { x: x2, y: y(fromTop) },
      thickness,
      color: BLACK,
    });

  const vLine = (x: number, top: number, bottom: number) =>
    page.drawLine({
      start: { x, y: y(top) },
      end: { x, y: y(bottom) },
      thickness: 0.75,
      color: BLACK,
    });

  // "Label:" right-aligned against LABEL_X.
  const label = (s: string, fromTop: number, endX = LABEL_X) =>
    text(s, endX - 150, fromTop, 150, { align: "right" });

  // A value sitting on an underline.
  const valueLine = (
    value: string | undefined,
    x1: number,
    x2: number,
    fromTop: number,
  ) => {
    hLine(x1, x2, fromTop + 3);
    if (value) text(value, x1 + 2, fromTop, x2 - x1 - 4);
  };

  // A short blank line with an X above it when checked, and its label to the right.
  const check = (
    s: string,
    checked: boolean,
    x1: number,
    x2: number,
    fromTop: number,
  ) => {
    hLine(x1, x2, fromTop + 3);
    if (checked)
      text("X", x1, fromTop, x2 - x1, { font: bold, align: "center" });
    text(s, x2 + 8, fromTop, 130);
  };

  const { vendor } = input;

  // Title
  text("Vendor Payment Request", 54, 100, 300, { size: 20 });

  // Header fields
  label("Invoice Date:", 150);
  valueLine(input.invoiceDate, LINE_START, LINE_END, 150);
  label("Vendor:", 169);
  valueLine(vendor.name, LINE_START, LINE_END, 169);
  label("Remittance Address:", 188);
  valueLine(vendor.remittanceAddress, LINE_START, LINE_END, 188);
  label("Phone:", 207);
  valueLine(vendor.phone, LINE_START, LINE_END, 207);
  label("Website/Email Address:", 245);
  valueLine(vendor.email, LINE_START, 285, 245);
  label("Account #:", 245, 345);
  valueLine(vendor.accountNumber, 349, LINE_END, 245);

  // Checkboxes
  check("New vendor", vendor.isNew, LINE_START, 202, 275);
  check("W-9 Attached", vendor.w9Attached, LINE_START, 202, 292);
  check("Give check to submitter", vendor.giveCheckToSubmitter, 300, 345, 275);

  label("Submitted by:", 322);
  valueLine(input.submittedBy, LINE_START, LINE_END, 322);

  // Invoice table: headings row, then values row.
  const invCols = [
    { title: "Invoice Number", x: TABLE_LEFT, w: 117 },
    { title: "Description", x: TABLE_LEFT + 117, w: 224 },
    { title: "Total Invoice Amount", x: TABLE_LEFT + 341, w: 127 },
  ];
  const invTop = 340;
  const invHeadH = 18;
  const invRowH = 22;
  page.drawRectangle({
    x: TABLE_LEFT,
    y: y(invTop + invHeadH + invRowH),
    width: TABLE_RIGHT - TABLE_LEFT,
    height: invHeadH + invRowH,
    borderWidth: 0.75,
    borderColor: BLACK,
  });
  hLine(TABLE_LEFT, TABLE_RIGHT, invTop + invHeadH);
  invCols.forEach((c, i) => {
    if (i > 0) vLine(c.x, invTop, invTop + invHeadH + invRowH);
    text(c.title, c.x + 3, invTop + 13, c.w - 6, {
      font: bold,
      align: "center",
    });
  });
  const invValueTop = invTop + invHeadH + 15;
  text(input.invoiceNumber, invCols[0].x + 3, invValueTop, invCols[0].w - 6);
  text(input.description, invCols[1].x + 3, invValueTop, invCols[1].w - 6);
  text(
    money(input.totalInvoiceAmount),
    invCols[2].x + 3,
    invValueTop,
    invCols[2].w - 6,
    { align: "right" },
  );

  // Coding table. Coded by / Approved by are columns, filled on the first row.
  const cols = [
    { title: "Grant", x: TABLE_LEFT, w: 100 },
    { title: "Program", x: TABLE_LEFT + 100, w: 50 },
    { title: "Sub-prog", x: TABLE_LEFT + 150, w: 50 },
    { title: "G/L", x: TABLE_LEFT + 200, w: 50 },
    { title: "Amount", x: TABLE_LEFT + 250, w: 70 },
    { title: "Coded by", x: TABLE_LEFT + 320, w: 74 },
    { title: "Coding Approved by", x: TABLE_LEFT + 394, w: 74 },
  ];
  const codeTop = 398;
  const headH = 22;
  const rowH = 17;
  const bottom = codeTop + headH + VPR_MAX_CODING_LINES * rowH;
  page.drawRectangle({
    x: TABLE_LEFT,
    y: y(bottom),
    width: TABLE_RIGHT - TABLE_LEFT,
    height: bottom - codeTop,
    borderWidth: 0.75,
    borderColor: BLACK,
  });
  hLine(TABLE_LEFT, TABLE_RIGHT, codeTop + headH);
  for (let i = 1; i < VPR_MAX_CODING_LINES; i++) {
    hLine(TABLE_LEFT, TABLE_RIGHT, codeTop + headH + i * rowH, 0.4);
  }
  cols.forEach((c, i) => {
    if (i > 0) vLine(c.x, codeTop, bottom);
    text(c.title, c.x + 3, codeTop + 14, c.w - 6, {
      font: bold,
      align: "center",
    });
  });
  input.coding.forEach((l, i) => {
    const top = codeTop + headH + i * rowH + 12;
    const cells = [l.grant, l.program, l.subProgram, l.glCode, money(l.amount)];
    cells.forEach((v, j) => {
      text(v, cols[j].x + 3, top, cols[j].w - 6, {
        align: j === 4 ? "right" : "center",
      });
    });
  });
  const firstRowTop = codeTop + headH + 12;
  text(input.codedBy, cols[5].x + 3, firstRowTop, cols[5].w - 6, {
    align: "center",
  });
  text(input.codingApprovedBy, cols[6].x + 3, firstRowTop, cols[6].w - 6, {
    align: "center",
  });

  // Total, with a double underline like the sample.
  const totalTop = bottom + 16;
  text("Total", cols[3].x, totalTop, cols[3].w, { align: "center" });
  text(
    money(input.totalInvoiceAmount),
    cols[4].x + 3,
    totalTop,
    cols[4].w - 6,
    {
      align: "right",
    },
  );
  hLine(cols[4].x, cols[4].x + cols[4].w, totalTop + 3);
  hLine(cols[4].x, cols[4].x + cols[4].w, totalTop + 5);

  // Attestation, wrapped to two lines.
  const maxLine = 400;
  const words = ATTESTATION.split(" ");
  const lines: string[] = [""];
  for (const w of words) {
    const next = lines[lines.length - 1]
      ? `${lines[lines.length - 1]} ${w}`
      : w;
    if (
      italic.widthOfTextAtSize(next, 10) > maxLine &&
      lines[lines.length - 1]
    ) {
      lines.push(w);
    } else {
      lines[lines.length - 1] = next;
    }
  }
  lines.forEach((l, i) =>
    text(l, 54, totalTop + 52 + i * 14, maxLine + 20, { font: italic }),
  );

  // Signatures: label, line, signature image above the line, date at the right.
  const signature = async (
    labelText: string,
    sig: VprSignature | undefined,
    fromTop: number,
  ) => {
    label(labelText, fromTop);
    hLine(LINE_START, LINE_END, fromTop + 3);
    if (!sig) return;
    const img = await doc.embedPng(sig.png);
    const scale = Math.min(
      1,
      SIG_BOX.width / img.width,
      SIG_BOX.height / img.height,
    );
    page.drawImage(img, {
      x: LINE_START + 4,
      y: y(fromTop + 3),
      width: img.width * scale,
      height: img.height * scale,
    });
    text(sig.signedAt, 380, fromTop, LINE_END - 380, { align: "right" });
  };
  await signature("Manager:", input.signatures?.manager, 664);
  await signature("Director:", input.signatures?.director, 734);

  return doc.save();
}
