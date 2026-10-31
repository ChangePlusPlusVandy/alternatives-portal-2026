import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { MergePdfError, mergePdfs } from "./merge";

const LETTER: [number, number] = [612, 792];
const A4: [number, number] = [595.28, 841.89];

// 1x1 transparent PNG
const PNG_1X1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

async function makePdf(sizes: [number, number][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  sizes.forEach((s) => doc.addPage(s));
  return doc.save();
}

async function pageSizes(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize();
    return [Math.round(width * 100) / 100, Math.round(height * 100) / 100];
  });
}

describe("mergePdfs", () => {
  it("merges 2 files in order", async () => {
    const a = await makePdf([LETTER, LETTER]);
    const b = await makePdf([LETTER]);
    const out = await mergePdfs([
      { name: "approval.pdf", data: a },
      { name: "invoice.pdf", data: b },
    ]);
    expect(await pageSizes(out)).toHaveLength(3);
  });

  it("merges 3 files in the order given", async () => {
    // Distinguish files by page size so order is checkable.
    const a = await makePdf([[200, 300]]);
    const b = await makePdf([
      [210, 310],
      [211, 311],
    ]);
    const c = await makePdf([[220, 320]]);
    const out = await mergePdfs([
      { name: "a.pdf", data: a },
      { name: "b.pdf", data: b },
      { name: "c.pdf", data: c },
    ]);
    expect(await pageSizes(out)).toEqual([
      [200, 300],
      [210, 310],
      [211, 311],
      [220, 320],
    ]);
  });

  it("keeps each page's original size (Letter + A4 mixed)", async () => {
    const letter = await makePdf([LETTER]);
    const a4 = await makePdf([A4, LETTER]);
    const out = await mergePdfs([
      { name: "letter.pdf", data: letter },
      { name: "a4.pdf", data: a4 },
    ]);
    expect(await pageSizes(out)).toEqual([LETTER, A4, LETTER]);
  });

  it("throws an error naming the file when a PDF is encrypted", async () => {
    // pdf-lib can't write encrypted PDFs, so mark a valid one as encrypted
    // by adding an /Encrypt entry to the trailer. For a more realistic
    // fixture: `qpdf --encrypt user owner 256 -- in.pdf encrypted.pdf`.
    const doc = await PDFDocument.create();
    doc.addPage(LETTER);
    doc.context.trailerInfo.Encrypt = doc.context.register(
      doc.context.obj({ Filter: "Standard" }),
    );
    const encrypted = await doc.save();

    const ok = await makePdf([LETTER]);
    const err = await mergePdfs([
      { name: "ok.pdf", data: ok },
      { name: "locked-invoice.pdf", data: encrypted },
    ]).catch((e) => e);

    expect(err).toBeInstanceOf(MergePdfError);
    expect(err.fileName).toBe("locked-invoice.pdf");
    expect(err.message).toContain("locked-invoice.pdf");
    expect(err.message).toMatch(/password|encrypted/i);
  });

  it("throws an error naming the file when a PDF is corrupt", async () => {
    const junk = new TextEncoder().encode("%PDF-1.7\nthis is not really a pdf");
    const err = await mergePdfs([{ name: "broken.pdf", data: junk }]).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(MergePdfError);
    expect(err.message).toContain("broken.pdf");
  });

  it("rejects unsupported file types, naming the file", async () => {
    const txt = new TextEncoder().encode("hello");
    await expect(mergePdfs([{ name: "notes.txt", data: txt }])).rejects.toThrow(
      /notes\.txt/,
    );
  });

  it("rejects an empty list", async () => {
    await expect(mergePdfs([])).rejects.toThrow();
  });

  it("turns a PNG into a page (stretch goal)", async () => {
    const pdf = await makePdf([LETTER]);
    const out = await mergePdfs([
      { name: "form.pdf", data: pdf },
      { name: "screenshot.png", data: PNG_1X1 },
    ]);
    expect(await pageSizes(out)).toEqual([LETTER, LETTER]);
  });
});
