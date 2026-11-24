import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  PAR_LONG_ROWS,
  PAR_SHORT_ROWS,
  renderParPdf,
  type ParPdfInput,
} from "./par";

// 1x1 transparent PNG, enough to prove an image is embedded.
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

const PERIOD = "2026-P20"; // Oct 16-31, 2026: 16 days, Fri Oct 16 .. Sat Oct 31
const employee = { name: "Employee, Test", jobTitle: "Test Job Title" };

function grantsOf(n: number): ParPdfInput["grants"] {
  return Array.from({ length: n }, (_, i) => ({
    grantId: `g${i + 1}`,
    name: `Grant ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? i : ""}`,
    contract: String(101 + i),
    percent: 10,
  }));
}

function rowsOf(n: number): ParPdfInput["rows"] {
  // Every grant gets 1.5h on Fri Oct 16, so no grant cell prints "0.0".
  return grantsOf(n).map((g) => ({
    date: "2026-10-16",
    grantId: g.grantId,
    hours: 1.5,
  }));
}

function input(n: number, extra: Partial<ParPdfInput> = {}): ParPdfInput {
  return {
    periodId: PERIOD,
    employee,
    grants: grantsOf(n),
    rows: rowsOf(n),
    ...extra,
  };
}

/** Decode the hex-encoded text operators from every page's content stream. */
async function pageText(bytes: Uint8Array): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  let out = "";
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const refs =
      contents instanceof PDFRef
        ? [contents]
        : (contents as unknown as { asArray(): PDFRef[] }).asArray();
    for (const ref of refs) {
      const stream = pdf.context.lookup(ref);
      if (stream instanceof PDFRawStream) {
        out += Buffer.from(decodePDFRawStream(stream).decode()).toString(
          "latin1",
        );
      }
    }
  }
  return [...out.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
    .map((m) => Buffer.from(m[1], "hex").toString("latin1"))
    .join("\n");
}

async function zeroCount(n: number): Promise<number> {
  const text = await pageText(await renderParPdf(input(n)));
  return text.split("\n").filter((t) => t === "0.0").length;
}

describe("renderParPdf", () => {
  it.each([1, 3, 6, 7, 16])(
    "renders one landscape Letter page for %i grants",
    async (n) => {
      const pdf = await PDFDocument.load(await renderParPdf(input(n)));
      expect(pdf.getPageCount()).toBe(1);
      expect(pdf.getPage(0).getSize()).toEqual({ width: 792, height: 612 });
    },
  );

  it("uses the 6-row layout for 1 to 6 grants and the 16-row layout for 7 to 16", async () => {
    // Empty grant rows print "0.0" in the total column, so
    // (zeros + grants) is the same for every n in a layout and
    // differs by the row-count difference between layouts.
    const f = async (n: number) => (await zeroCount(n)) + n;
    const short = await f(1);
    expect(await f(3)).toBe(short);
    expect(await f(PAR_SHORT_ROWS)).toBe(short);
    const long = await f(7);
    expect(await f(PAR_LONG_ROWS)).toBe(long);
    expect(long - short).toBe(PAR_LONG_ROWS - PAR_SHORT_ROWS);
  });

  it("throws for more than 16 grants", async () => {
    await expect(renderParPdf(input(17))).rejects.toThrow(/at most 16/);
  });

  it("throws for an unknown grant", async () => {
    await expect(
      renderParPdf(
        input(2, {
          rows: [{ date: "2026-10-16", grantId: "nope", hours: 1 }],
        }),
      ),
    ).rejects.toThrow(/Unknown grant: nope/);
  });

  it("throws for a date outside the period", async () => {
    await expect(
      renderParPdf(
        input(2, {
          rows: [{ date: "2026-10-15", grantId: "g1", hours: 1 }],
        }),
      ),
    ).rejects.toThrow(/outside period/);
  });

  it("prints weekend hours and counts them in the totals", async () => {
    const lines = (
      await pageText(
        await renderParPdf(
          input(1, {
            rows: [
              { date: "2026-10-16", grantId: "g1", hours: 1.5 },
              { date: "2026-10-17", grantId: "g1", hours: 2.5 }, // Saturday
            ],
          }),
        ),
      )
    ).split("\n");
    expect(lines).toContain("2.5"); // Saturday cell and Saturday day total
    expect(lines.filter((l) => l === "2.5").length).toBe(2);
    expect(lines).toContain("4.0"); // grant total and grand total
    expect(lines.filter((l) => l === "4.0").length).toBe(2);
  });

  it("prints labels, one-decimal hours, and totals", async () => {
    const text = await pageText(
      await renderParPdf({
        periodId: PERIOD,
        employee,
        grants: [
          { grantId: "a", name: "Grant A", contract: "101", percent: 10 },
          { grantId: "c", name: "Grant C", contract: "103", percent: 80 },
        ],
        rows: [
          { date: "2026-10-16", grantId: "a", hours: 0 },
          { date: "2026-10-16", grantId: "c", hours: 4.8 },
          { date: "2026-10-19", grantId: "a", hours: 0.1 },
          { date: "2026-10-19", grantId: "c", hours: 0.2 },
          { date: "2026-10-20", grantId: "PTO", hours: 8 },
        ],
      }),
    );
    const lines = text.split("\n");
    expect(lines).toContain("Grant A - 101 (10%)");
    expect(lines).toContain("Grant C - 103 (80%)");
    expect(lines).toContain("PAY PERIOD ENDING DATE:");
    expect(lines).toContain("October 31, 2026");
    expect(lines).toContain("Test Job Title");
    expect(lines).toContain("4.8");
    expect(lines).toContain("0.3"); // 0.1 + 0.2 total for the grant sums, not 0.30000000000000004
    expect(lines).toContain("13.1"); // grand total: 4.8 + 0.1 + 0.2 + 8
    expect(lines).toContain("8.0");
    // A weekday value of 0 prints
    expect(lines.filter((l) => l === "0.0").length).toBeGreaterThan(0);
  });

  it("prints day numbers 16 to 31 and leaves cells with no row blank", async () => {
    const lines = (await pageText(await renderParPdf(input(1)))).split("\n");
    for (let d = 16; d <= 31; d++) expect(lines).toContain(String(d));
    // 1.5 prints in the Fri 16 cell, the grant total, the Fri 16 day total, and the grand total. Nothing prints for days with no row.
    expect(lines.filter((l) => l === "1.5").length).toBe(4);
  });

  it("renders signed and unsigned", async () => {
    const unsigned = await renderParPdf(input(3));
    const signed = await renderParPdf(
      input(3, {
        signatures: {
          employee: { png: PNG, signedAt: "2026-10-31" },
          supervisor: { png: PNG, signedAt: "2026-11-01T01:30:00Z" },
        },
      }),
    );
    const unsignedText = await pageText(unsigned);
    const signedText = await pageText(signed);
    expect(unsignedText).not.toContain("10/31/2026");
    expect(signedText).toContain("10/31/2026");
    // 01:30Z on Nov 1 is still Oct 31 in Chicago
    expect(signedText.match(/10\/31\/2026/g)).toHaveLength(2);
    expect(signed.length).toBeGreaterThan(unsigned.length);
    const doc = await PDFDocument.load(signed);
    const xobjects = doc
      .getPage(0)
      .node.Resources()
      ?.lookup(PDFName.of("XObject"));
    expect(xobjects).toBeDefined();
  });

  it("throws on an unparseable signedAt", async () => {
    await expect(
      renderParPdf(
        input(1, {
          signatures: { employee: { png: PNG, signedAt: "yesterday" } },
        }),
      ),
    ).rejects.toThrow(/Invalid signedAt/);
  });
});
