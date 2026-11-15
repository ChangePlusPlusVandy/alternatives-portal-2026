import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderVprPdf, type VprInput } from "./vpr";

// 1x1 transparent PNG
const PNG_1X1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

const line = (amount: number) => ({
  grant: "Grant A",
  program: "100",
  subProgram: "10",
  glCode: "51030",
  amount,
});

function makeInput(overrides: Partial<VprInput> = {}): VprInput {
  return {
    invoiceDate: "2026-11-01",
    vendor: {
      name: "Test Vendor",
      remittanceAddress: "1 Test St, Testville, TN 00000",
      isNew: true,
      w9Attached: false,
      giveCheckToSubmitter: false,
    },
    submittedBy: "Test Employee",
    invoiceNumber: "INV-0001",
    description: "Test supplies",
    totalInvoiceAmount: 100,
    coding: [line(100)],
    codedBy: "Test Coder",
    codingApprovedBy: "Test Approver",
    ...overrides,
  };
}

async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("renderVprPdf", () => {
  it("renders one page for one coding line", async () => {
    expect(await pageCount(await renderVprPdf(makeInput()))).toBe(1);
  });

  it("renders one page for three coding lines", async () => {
    const bytes = await renderVprPdf(
      makeInput({
        totalInvoiceAmount: 100,
        coding: [line(50), line(30.5), line(19.5)],
      }),
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it("renders one page for the maximum of six lines", async () => {
    const bytes = await renderVprPdf(
      makeInput({ totalInvoiceAmount: 60, coding: Array(6).fill(line(10)) }),
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it("throws when coding amounts don't sum to the total", async () => {
    await expect(
      renderVprPdf(makeInput({ coding: [line(99.99)] })),
    ).rejects.toThrow(/99\.99.*100\.00/);
  });

  it("allows floating-point noise (0.1 + 0.2 = 0.3)", async () => {
    const bytes = await renderVprPdf(
      makeInput({ totalInvoiceAmount: 0.3, coding: [line(0.1), line(0.2)] }),
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it("throws on no coding lines or too many", async () => {
    await expect(renderVprPdf(makeInput({ coding: [] }))).rejects.toThrow(
      /at least one/,
    );
    await expect(
      renderVprPdf(
        makeInput({ totalInvoiceAmount: 70, coding: Array(7).fill(line(10)) }),
      ),
    ).rejects.toThrow(/at most 6/);
  });

  it("throws on a non-finite amount", async () => {
    await expect(
      renderVprPdf(makeInput({ totalInvoiceAmount: NaN })),
    ).rejects.toThrow(/number/);
    await expect(
      renderVprPdf(makeInput({ coding: [line(Infinity)] })),
    ).rejects.toThrow(/number/);
  });

  it("renders unsigned, partly signed and fully signed", async () => {
    const sig = { png: PNG_1X1, signedAt: "2026-11-02" };
    const unsigned = await renderVprPdf(makeInput());
    const manager = await renderVprPdf(
      makeInput({ signatures: { manager: sig } }),
    );
    const both = await renderVprPdf(
      makeInput({ signatures: { manager: sig, director: sig } }),
    );
    for (const bytes of [unsigned, manager, both]) {
      expect(await pageCount(bytes)).toBe(1);
    }
    expect(both.length).toBeGreaterThan(unsigned.length);
  });

  it("renders optional vendor fields and very long text", async () => {
    const bytes = await renderVprPdf(
      makeInput({
        description: "Very long description ".repeat(30),
        vendor: {
          ...makeInput().vendor,
          phone: "555-0100",
          email: "vendor@example.test",
          accountNumber: "000123",
          isNew: false,
          w9Attached: true,
          giveCheckToSubmitter: true,
        },
      }),
    );
    expect(await pageCount(bytes)).toBe(1);
  });
});
