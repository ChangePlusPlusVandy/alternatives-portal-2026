import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

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
const MARGIN = 54;
const RIGHT = PAGE.width - MARGIN;
const SIG_BOX = { width: 200, height: 60 };
const ATTESTATION =
  "By signing you attest the the expenses coded to the grant are necessary, reasonable, and allowable under the grant agreement.";

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

  // Work in "distance from top" so the code reads like the form.
  const y = (fromTop: number) => PAGE.height - fromTop;
  const black = rgb(0, 0, 0);

  // Draw text, shrinking (then truncating) so it stays inside `maxWidth`.
  const text = (
    s: string,
    x: number,
    fromTop: number,
    maxWidth: number,
    opts: { font?: PDFFont; size?: number; align?: "left" | "right" } = {},
  ) => {
    const f = opts.font ?? font;
    let size = opts.size ?? 10;
    while (size > 6 && f.widthOfTextAtSize(s, size) > maxWidth) size -= 0.5;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(out, size) > maxWidth) {
      out = out.slice(0, -2) + "-";
    }
    const w = f.widthOfTextAtSize(out, size);
    page.drawText(out, {
      x: opts.align === "right" ? x + maxWidth - w : x,
      y: y(fromTop),
      size,
      font: f,
      color: black,
    });
  };

  const line = (x1: number, x2: number, fromTop: number) =>
    page.drawLine({
      start: { x: x1, y: y(fromTop) },
      end: { x: x2, y: y(fromTop) },
      thickness: 0.75,
      color: black,
    });

  // A label followed by a value sitting on an underline.
  const field = (
    label: string,
    value: string | undefined,
    x: number,
    fromTop: number,
    width: number,
  ) => {
    const labelW = bold.widthOfTextAtSize(label, 10) + 6;
    text(label, x, fromTop, width, { font: bold });
    line(x + labelW, x + width, fromTop + 2);
    if (value) text(value, x + labelW + 2, fromTop, width - labelW - 2);
  };

  const checkbox = (
    label: string,
    checked: boolean,
    x: number,
    top: number,
  ) => {
    page.drawRectangle({
      x,
      y: y(top + 1),
      width: 10,
      height: 10,
      borderWidth: 0.75,
      borderColor: black,
    });
    if (checked) text("X", x + 2, top - 1, 8, { font: bold, size: 10 });
    text(label, x + 15, top, 150);
  };

  const { vendor } = input;
  const width = RIGHT - MARGIN;

  // Title
  text("Vendor Payment Request", MARGIN, 72, width, { font: bold, size: 18 });

  // Header fields
  field("Invoice Date:", input.invoiceDate, MARGIN, 108, 250);
  field("Vendor:", vendor.name, MARGIN, 132, width);
  field("Remittance Address:", vendor.remittanceAddress, MARGIN, 156, width);
  field("Phone:", vendor.phone, MARGIN, 180, 250);
  field("Website/Email:", vendor.email, MARGIN, 204, width);
  field("Account #:", vendor.accountNumber, MARGIN, 228, 250);

  checkbox("New vendor", vendor.isNew, 330, 230);
  checkbox("W-9 Attached", vendor.w9Attached, 330, 252);
  checkbox("Give check to submitter", vendor.giveCheckToSubmitter, 330, 274);

  field("Submitted by:", input.submittedBy, MARGIN, 252, 250);

  // Invoice
  field("Invoice Number:", input.invoiceNumber, MARGIN, 312, 250);
  field(
    "Total Invoice Amount:",
    money(input.totalInvoiceAmount),
    330,
    312,
    width - 276,
  );
  field("Description:", input.description, MARGIN, 336, width);

  // Coding table
  const cols = [
    { title: "Grant", x: MARGIN, w: 120 },
    { title: "Program", x: MARGIN + 120, w: 90 },
    { title: "Sub-prog", x: MARGIN + 210, w: 90 },
    { title: "G/L", x: MARGIN + 300, w: 90 },
    { title: "Amount", x: MARGIN + 390, w: width - 390 },
  ];
  const headTop = 372;
  const rowH = 22;
  const tableBottom = headTop + (VPR_MAX_CODING_LINES + 1) * rowH;

  page.drawRectangle({
    x: MARGIN,
    y: y(tableBottom),
    width,
    height: (VPR_MAX_CODING_LINES + 2) * rowH,
    borderWidth: 0.75,
    borderColor: black,
  });
  for (let i = 1; i < VPR_MAX_CODING_LINES + 2; i++) {
    line(MARGIN, RIGHT, headTop - rowH + i * rowH);
  }
  for (const c of cols.slice(1)) {
    page.drawLine({
      start: { x: c.x, y: y(headTop - rowH) },
      end: { x: c.x, y: y(tableBottom) },
      thickness: 0.75,
      color: black,
    });
  }
  for (const c of cols) {
    text(c.title, c.x + 4, headTop - 7, c.w - 8, { font: bold });
  }
  input.coding.forEach((l, i) => {
    const top = headTop + i * rowH + rowH - 7;
    const cells = [l.grant, l.program, l.subProgram, l.glCode, money(l.amount)];
    cells.forEach((v, j) => {
      const c = cols[j];
      text(v, c.x + 4, top, c.w - 8, {
        align: j === 4 ? "right" : "left",
      });
    });
  });
  // Total row (the last row of the table)
  const totalTop = tableBottom - 7;
  text("Total", cols[3].x + 4, totalTop, cols[3].w - 8, { font: bold });
  text(
    money(input.totalInvoiceAmount),
    cols[4].x + 4,
    totalTop,
    cols[4].w - 8,
    {
      font: bold,
      align: "right",
    },
  );

  // Coded by / approved by
  const afterTable = tableBottom + 28;
  field("Coded by:", input.codedBy, MARGIN, afterTable, 250);
  field(
    "Coding Approved by:",
    input.codingApprovedBy,
    330,
    afterTable,
    width - 276,
  );

  // Attestation
  const attTop = afterTable + 36;
  text(ATTESTATION, MARGIN, attTop, width, { size: 9 });

  // Signatures
  const sigTop = attTop + 72;
  await signature(
    doc,
    page,
    "Manager:",
    input.signatures?.manager,
    MARGIN,
    sigTop,
    font,
    bold,
  );
  await signature(
    doc,
    page,
    "Director:",
    input.signatures?.director,
    MARGIN,
    sigTop + 72,
    font,
    bold,
  );

  return doc.save();
}

// A label, a signature image (or blank line), and the date signed.
async function signature(
  doc: PDFDocument,
  page: PDFPage,
  label: string,
  sig: VprSignature | undefined,
  x: number,
  fromTop: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const lineY = PAGE.height - fromTop;
  const lineX = x + 60;
  page.drawText(label, { x, y: lineY, size: 10, font: bold });
  page.drawLine({
    start: { x: lineX, y: lineY - 2 },
    end: { x: lineX + SIG_BOX.width, y: lineY - 2 },
    thickness: 0.75,
  });
  page.drawText("Date:", {
    x: lineX + SIG_BOX.width + 20,
    y: lineY,
    size: 10,
    font: bold,
  });
  page.drawLine({
    start: { x: lineX + SIG_BOX.width + 52, y: lineY - 2 },
    end: { x: RIGHT, y: lineY - 2 },
    thickness: 0.75,
  });
  if (!sig) return;

  const img = await doc.embedPng(sig.png);
  const scale = Math.min(
    1,
    SIG_BOX.width / img.width,
    SIG_BOX.height / img.height,
  );
  page.drawImage(img, {
    x: lineX,
    y: lineY - 2,
    width: img.width * scale,
    height: img.height * scale,
  });
  page.drawText(sig.signedAt, {
    x: lineX + SIG_BOX.width + 56,
    y: lineY,
    size: 10,
    font,
  });
}
