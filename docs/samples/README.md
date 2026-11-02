# Samples

Anonymized copies of the real forms the app replaces. Use them to match layout and wording.

## Layout

One folder per tool, matching `src/app/`. Each file is named `<form>-<blank|filled>.<ext>`, using the form's name from `docs/SPEC.md`. Files keep their original format (Excel or Word) so layout and formulas survive.

```
samples/
  par/
  procurement/
```

## PAR

| File                  | What it is                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `par/par-blank.xlsx`  | The workbook each employee fills out, one tab per PAR period. Tabs through July use a long layout with 16 grant rows; tabs from August use a short one with 6. Name, job title, period end date, grants, and hours cleared |
| `par/par-filled.xlsx` | One period filled in with the worked example from `docs/SPEC.md` 3.5. Not signed                                                                                                                                           |

On the real forms each grant row is labeled with the grant name, contract number, and allocation percent, e.g. `Grant A - 101 (10%)`.

## Procurement

| File                                                | What it is                                                                                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `procurement/supply-order-form-blank.docx`          | The supply order form, titled "Office Supply Request Form". The employee fills it out and their supervisor signs                                                               |
| `procurement/supply-order-form-filled.docx`         | The same form filled in for an Amazon order. The vendor is picked by highlighting its name; items are pasted product links                                                     |
| `procurement/vendor-payment-request-blank.xlsx`     | The VPR (Vendor Payment Request). Coded by grant, program, sub-program, and G/L, not the class, contract, and GL code on the supply order form. Signed by manager and director |
| `procurement/credit-card-charge-request-blank.xlsx` | Request to pay with the company credit card. One form per transaction; manager and cardholder approve the purchase and coding before it is made. Not in `docs/SPEC.md` yet     |

Still wanted: a signed PAR.

## Adding a sample

This repo is public. Before adding a file:

1. Replace real names, grant names, hours, codes, account and invoice numbers, and signatures with obviously fake values ("Test Employee", "Grant A").
2. Remove file metadata: author, last modified by, file paths, printer settings. In Word or Excel: File → Info → Check for Issues → Inspect Document.
3. Name it to match the layout above and add a row to the table.
