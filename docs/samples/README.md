# Samples

Anonymized copies of the real forms the app replaces. Use them to match layout and wording.

## Layout

One folder per tool, matching `src/app/`. Each file is named `<form>-<blank|filled>.<ext>`, using the form's name from `docs/SPEC.md`.

- **Excel and Word files** are the templates staff fill in. They keep their original format so layout and formulas survive.
- **PDFs** show what the forms look like once filled, exported, signed, and combined. Each page is a flattened image with real values covered and fake ones drawn in, so there is no text to select. Signatures are generated scribbles.

```
samples/
  par/
  procurement/
```

Rows on these forms are not fixed. The PAR comes in a 16-grant-row and a 6-grant-row layout, and the supply order form's item table grows onto a second page when needed.

## PAR

| File                  | What it is                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `par/par-blank.xlsx`  | The workbook each employee fills out, one tab per PAR period. Tabs through July use a long layout with 16 grant rows; tabs from August use a short one with 6. Name, job title, period end date, grants, and hours cleared |
| `par/par-filled.xlsx` | One period filled in with the worked example from `docs/SPEC.md` 3.5. Not signed                                                                                                                                           |
| `par/par-filled.pdf`  | A PAR for March 16–31, 2025 as exported to PDF and signed by the employee and supervisor. Weekdays carry the `docs/SPEC.md` 3.5 numbers; weekends are blank                                                                |

On the real forms each grant row is labeled with the grant name, contract number, and allocation percent, e.g. `Grant A - 101 (10%)`.

## Procurement

| File                                                   | What it is                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `procurement/supply-order-form-blank.docx`             | The supply order form, titled "Office Supply Request Form". The employee fills it out and their supervisor signs                                                                                                                                           |
| `procurement/supply-order-form-filled.docx`            | The same form filled in for an Amazon order. The vendor is picked by highlighting its name; items are pasted product links                                                                                                                                 |
| `procurement/supply-order-form-filled.pdf`             | The same form exported to PDF and signed by the supervisor. Items are a mix of product titles and links                                                                                                                                                    |
| `procurement/vendor-payment-request-blank.xlsx`        | The VPR (Vendor Payment Request). Coded by grant, program, sub-program, and G/L. Signed by manager and director                                                                                                                                            |
| `procurement/vendor-payment-request-packet-filled.pdf` | The combined PDF for one Amazon order, in this order: the director-signed VPR, the Amazon invoice (3 pages), and the supervisor-signed supply order form (2 pages). The supply form here is an older version: vendor marked with an "x" and a price column |
| `procurement/credit-card-charge-request-blank.xlsx`    | Request to pay with the company credit card. One form per transaction; manager and cardholder approve the purchase and coding before it is made. Not in `docs/SPEC.md` yet                                                                                 |
| `procurement/credit-card-charge-request-filled.pdf`    | A scanned, hand-filled copy of an older version of that form, coded by grant, program, sub-program, and GL code, followed by the store receipt. The receipt is a fake stand-in                                                                             |

In the packet, the supply order form's class and contract are the same numbers as the VPR's program and grant.

Product descriptions and prices on the invoice and supply order forms are the real catalog listings. Names, signatures, codes, and account, invoice, order, and bank numbers are fake.

## Adding a sample

This repo is public. Before adding a file:

1. Replace real names, grant names, hours, codes, account and invoice numbers, and signatures with obviously fake values ("Test Employee", "Grant A").
2. Remove file metadata: author, last modified by, file paths, printer settings. In Word or Excel: File → Info → Check for Issues → Inspect Document.
3. For a PDF, flatten each page to an image after covering values. Boxes drawn in a PDF editor usually leave the text underneath in the file.
4. Name it to match the layout above and add a row to the table.
