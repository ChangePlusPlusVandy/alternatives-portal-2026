import { EncryptedPDFError, PDFDocument } from "pdf-lib";

/** One input file. `name` is only used to make error messages useful. */
export interface MergeInput {
  name: string;
  data: Uint8Array | ArrayBuffer;
}

/** Thrown when an input can't be merged. `fileName` says which one. */
export class MergePdfError extends Error {
  readonly fileName: string;
  readonly index: number;

  constructor(
    fileName: string,
    index: number,
    reason: string,
    options?: { cause?: unknown },
  ) {
    super(
      `Could not merge "${fileName}" (file ${index + 1}): ${reason}`,
      options,
    );
    this.name = "MergePdfError";
    this.fileName = fileName;
    this.index = index;
  }
}

type FileKind = "pdf" | "png" | "jpg" | "unknown";

// US Letter, in PDF points. Used as the page for image inputs.
const LETTER = { width: 612, height: 792 };
const IMAGE_MARGIN = 36;

function detectKind(b: Uint8Array): FileKind {
  if (
    b.length >= 4 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  )
    return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "jpg";
  // The spec allows "%PDF-" anywhere in the first 1024 bytes.
  const head = String.fromCharCode(...b.subarray(0, Math.min(1024, b.length)));
  if (head.includes("%PDF-")) return "pdf";
  return "unknown";
}

// Real encrypted PDFs always carry an /Encrypt entry in their trailer, so we
// also look for it in the raw bytes in case pdf-lib reports the problem
// as a generic parse error instead of EncryptedPDFError.
function looksEncrypted(bytes: Uint8Array): boolean {
  let text = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return /\/Encrypt\b/.test(text);
}

async function appendPdf(
  out: PDFDocument,
  bytes: Uint8Array,
  name: string,
  index: number,
) {
  let src: PDFDocument;
  let indices: number[];
  try {
    src = await PDFDocument.load(bytes); // throws EncryptedPDFError if encrypted
    // pdf-lib can "successfully" load garbage, then fail here, so keep this inside the try.
    indices = src.getPageIndices();
  } catch (err) {
    if (err instanceof EncryptedPDFError || looksEncrypted(bytes)) {
      throw new MergePdfError(
        name,
        index,
        "the PDF is password-protected or encrypted. Remove the protection and try again.",
        { cause: err },
      );
    }
    throw new MergePdfError(name, index, "the PDF is corrupt or unreadable.", {
      cause: err,
    });
  }

  if (indices.length === 0) {
    throw new MergePdfError(name, index, "the PDF has no pages.");
  }

  try {
    // copyPages keeps each page's MediaBox, rotation and content as-is.
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
  } catch (err) {
    throw new MergePdfError(name, index, "its pages could not be copied.", {
      cause: err,
    });
  }
}

async function appendImage(
  out: PDFDocument,
  bytes: Uint8Array,
  kind: "png" | "jpg",
  name: string,
  index: number,
) {
  try {
    const img =
      kind === "png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);

    // Letter page, oriented to match the image.
    const landscape = img.width > img.height;
    const pageW = landscape ? LETTER.height : LETTER.width;
    const pageH = landscape ? LETTER.width : LETTER.height;

    // Shrink to fit inside the margins; never enlarge small images.
    const scale = Math.min(
      1,
      (pageW - 2 * IMAGE_MARGIN) / img.width,
      (pageH - 2 * IMAGE_MARGIN) / img.height,
    );
    const w = img.width * scale;
    const h = img.height * scale;

    const page = out.addPage([pageW, pageH]);
    page.drawImage(img, {
      x: (pageW - w) / 2,
      y: (pageH - h) / 2,
      width: w,
      height: h,
    });
  } catch (err) {
    throw new MergePdfError(
      name,
      index,
      `the ${kind.toUpperCase()} image is corrupt or unreadable.`,
      {
        cause: err,
      },
    );
  }
}

/**
 * Merge PDFs (and, as a bonus, JPG/PNG images) into one PDF, in the order given.
 * Each PDF page keeps its original size. Each image becomes one Letter page.
 *
 * Throws MergePdfError (with `fileName`) if any input is corrupt, encrypted,
 * empty, or not a supported type.
 */
export async function mergePdfs(files: MergeInput[]): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error("mergePdfs needs at least one file.");
  }

  const out = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const { name, data } = files[i];
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const kind = detectKind(bytes);

    if (kind === "pdf") await appendPdf(out, bytes, name, i);
    else if (kind === "png" || kind === "jpg")
      await appendImage(out, bytes, kind, name, i);
    else throw new MergePdfError(name, i, "not a PDF, JPG or PNG file.");
  }

  return out.save();
}
