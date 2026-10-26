# Spec: Alternatives Portal

What we're building, why, and the business rules behind it. This is the source of truth for scope. Work items live in Linear. If something isn't here, add it (via PR) before building it.

Everything below was confirmed in the recorded half of the scoping meeting with Alternatives, except where marked:

- _(recall)_: the client said it in the second half of the meeting, which wasn't recorded. From the EM's memory. Treat as confirmed, but double-check anything that matters.
- _(notes)_: from the original handoff notes. Not confirmed with the client.
- _(assumption)_: our inference. Nobody said it.

Open questions are at the end of each section.

---

## 1. Goals and priorities

1. **PAR.** Get every PAR signed on time, every period, with a record funders will accept. Alternatives is being audited now and expects a finding on PARs. Needed as soon as possible.
2. **Procurement.** Move the whole supply-ordering pipeline into the app, from request to signed order, with more automation than today. Most grants end December 31, which is when ordering peaks. Miss that and the next window is late March or April.
3. **Resources.** One place for staff information, which lives scattered across Google Drive today. Useful, not urgent.

## 2. Who uses it

About 73 staff. Every one has a Google Workspace work email and will sign in with it.

| Role       | Who                    | Main jobs                                                                    |
| ---------- | ---------------------- | ---------------------------------------------------------------------------- |
| Employee   | All staff              | Enter hours, sign own PARs, request supplies, find resources                 |
| Supervisor | Team leads             | Co-sign team PARs, sign supply requests                                      |
| Admin      | Operations and finance | Manage grants, allocations, users, and resources; track PARs; process orders |

Roles are not fixed yet. The three above are a starting point.

Open: headcount per role (client is sending it); whether finance is a separate role from admin; who reviews supply requests (see 4.2).

---

## 3. PAR tool

### 3.1 Terms

- **PAR (Personnel Activity Report).** One employee's work time for one PAR period, split across grants, signed. Funders require it as proof of where grant money went, and they audit it.
- **Grant.** Money from one funder for one purpose. About 33 are active.
- **Funder.** The foundation or agency behind a grant.
- **PAR period.** Semi-monthly: the 1st–15th and the 16th–last day of the month. 24 a year.
- **Pay period.** Biweekly. It does not line up with PAR periods; one pay period often spans two. The app never reports by pay period.
- **Allocation.** The percent of an employee's time budgeted to each grant, e.g. 10% / 10% / 80%. The finance director sets it by hand from what each grant contract promises (e.g. "serve 100 youth this year" becomes "2 hours a week"). Allocations change, but should hold for at least a quarter.
- **Grant cap.** _(notes)_ Paylocity limits how many grants one person can be allocated to. The notes give 6 as an example. The real number is unconfirmed.
- **Paylocity.** Alternatives' HR and payroll system. Most staff are exempt and don't enter hours there. Only PTO is tracked. So hours can't be pulled from Paylocity today.
- **Signature.** Must look like a wet signature: drawn with a mouse, finger, or stylus. A typed name or a checkbox does not count.

### 3.2 How it works today

1. Each employee gets a blank spreadsheet and the list of grants they're on.
2. They fill in hours per grant per day for the period, then sign and date it.
3. They send it to their supervisor, who signs and dates it.
4. Finance collects the signed copies.

The problem: employees submit late or not at all. That is the audit finding.

The form is a grid:

- Top: employee name, job title, period end date.
- Columns: each day of the period.
- Rows: one per grant, then rows for uncompensated time such as PTO.
- Cells: hours. A day's total should not exceed 8.
- Bottom: employee signature and date, supervisor signature and date.

Anonymized copies are in `docs/samples/`.

### 3.3 What we're building

1. Admin sets each employee's grants and percentages.
2. The app emails each employee when their PAR is due.
3. The employee enters the total hours they worked that period. Not per day.
4. The app spreads those hours across days and grants (rules in 3.4) and shows the finished PAR.
5. The employee signs. Their supervisor signs.
6. Admin sees every PAR for the period, who hasn't signed, sends reminders, and downloads PDFs.

Output format: mirror the current spreadsheet. Finance is checking whether funders require the exact layout. Plan: build the exact mirror and a cleaner version, let them choose.

Later, not now: pull hours from Paylocity if staff start entering time there.

### 3.4 Rules for splitting hours

1. **Period totals match the allocation.** For each grant, hours in the period = total hours × that grant's percent.
2. **Daily hours vary.** The auditors rejected the same split every day: "nobody works consistently the same amount of time per grant." A 10% grant on an 8-hour day must not be 1.6 hours every day. Some days more, some less, some zero.
3. **Daily cap.** All grants on one day total at most 8 hours.
4. **It adds up.** Split hours sum back to the total the employee entered, exactly.
5. **Per day only.** Hours are stored and reported per day, then rolled up into PAR periods. Never by pay period.

### 3.5 Worked example

Allocation: Grant A 10%, Grant B 10%, Grant C 80%.
Period: October 16–31, 2026. 11 working days. The employee enters 88 hours.

Period totals: A = 8.8, B = 8.8, C = 70.4.

A valid grid, first three days shown:

|           | Fri 16 | Mon 19 | Tue 20 | …   | Total |
| --------- | -----: | -----: | -----: | --- | ----: |
| Grant A   |      0 |    4.8 |    0.8 | …   |   8.8 |
| Grant B   |    2.4 |      0 |    1.6 | …   |   8.8 |
| Grant C   |    5.6 |    3.2 |    5.6 | …   |  70.4 |
| Day total |      8 |      8 |      8 | …   |    88 |

Invalid: 0.8 / 0.8 / 6.4 on every day. The totals match, but nothing varies.

### 3.6 Edge cases to test

- Month lengths: 28, 29, 30, 31. The second period ends on the last day.
- Allocations that don't sum to 100%.
- An allocation that changes mid-period.
- An employee who starts or leaves mid-period.
- Totals that aren't a multiple of 8, or that exceed 8 per working day.
- Rounding: the grid sums back to the entered total exactly.
- More grants than the cap allows.

### 3.7 Open questions

- Do funders require the exact current layout? Finance is checking.
- Is 8 hours a hard daily cap? Can hours land on weekends?
- Does the employee enter PTO separately, and does it appear on the PAR?
- Is the supervisor signature required by funders, or just current practice?
- Grant cap: is it real, and what is the number?
- How to handle an allocation that changes mid-period.
- Rounding precision: tenths of an hour, or finer?
- When exactly is a PAR late?

---

## 4. Procurement

### 4.1 Terms

Every order carries three codes. They are Alternatives' own and don't change by vendor.

- **Class.** Two digits. The department, e.g. 13 is operations.
- **Contract.** Three digits. The grant the purchase is charged to, e.g. 128.
- **GL code.** Five digits. The general ledger account, i.e. the kind of expense. 51-030 is supplies. Parking or entertainment would be different codes.

And the forms:

- **Supply order form.** The paper form an employee fills out and a supervisor signs. The client is sending a blank copy; it will go in `docs/samples/`.
- **Supply order request form.** The online form the signed paper form is uploaded to. Its responses land in a spreadsheet. _(assumption)_ Probably a Google Form and a Google Sheet.
- **VPR.** _(recall)_ The form the director fills out and signs after reviewing a request. Once it is signed, the order is placed.
- **Master support form.** _(notes)_ The admin's combined view of every submitted order, with product numbers, used to place the purchases.
- **Product number.** _(notes)_ The vendor's SKU for an item. Admin-only.

### 4.2 How it works today

1. Employee fills out the supply order form: date, program, name, vendor (e.g. Amazon), a link to each item, quantity, and the three codes.
2. Their supervisor signs it.
3. Employee or supervisor uploads the signed form to the request form, re-entering name, department, codes, vendor, and when they need it.
4. Operations gets a notification. The response lands in the spreadsheet.
5. _(recall)_ The director, or another reviewer, reviews the request.
6. _(recall)_ The director fills out and signs the VPR. The order is placed.
7. _(recall)_ The order form, the signed VPR, and the vendor invoice are combined into one PDF. Exact contents need confirming.

Where that PDF goes is open (see 4.4).

_(notes)_ The handoff notes describe the flow differently: the supervisor fills out the order form, it rolls into the master support form, and an admin reviews it with product numbers. The notes ask that the employee-facing form show only item descriptions, with product numbers kept admin-side. The meeting showed employees pasting vendor links instead. _(assumption)_ These conflict. Confirm with the client before building the item picker.

### 4.3 What we're building

All seven steps of 4.2 move into the app:

1. Employee submits a request: items, quantity, vendor, the three codes.
2. Supervisor signs it in the app.
3. A reviewer approves it. Who that is: open.
4. Director fills out and signs the VPR in the app. That is the signal to place the order.
5. The vendor invoice is attached. The app produces the combined PDF: order form, signed VPR, invoice.
6. Admin sees every order and where it is in the flow.

How items are picked (description-only catalog, vendor links, or both) waits on the conflict above.

### 4.4 Open questions

- _(recall, unsure)_ Does the combined PDF go to the funder?
- Exactly what goes in the combined PDF? Best guess: order form, VPR, invoice.
- What does VPR stand for?
- Catalog with admin-only product numbers, free-form vendor links, or both?
- Who reviews requests before the director signs? A role, specific people, or the director alone?
- Budget limits per order or per grant?
- How many orders a month?

---

## 5. Resources

- _(recall)_ All staff information lives in Google Drive today. They want a better central place and a better way to share information.
- _(recall)_ The director gave us free rein on how to build it.
- _(notes)_ A page of internal links, forms, and documents, grouped by category, that admins can edit.

Open: what moves out of Drive and what just gets linked; who edits it; whether it's the app's home page.

---

## 6. Cross-cutting

- Sign in with Google Workspace. Every employee has an account.
- Alternatives wants the app on its own domain eventually. Their IT vendor controls DNS and is on site Thursdays. Contact to come.
- _(notes)_ Works on phones as well as desktop.
- _(notes)_ Non-technical staff do routine admin without a developer.

Open: who maintains the app after handoff.

## 7. Out of scope

- Paylocity integration. Possible later.
- Any payroll calculation. Paylocity stays the source of truth for pay.
- Buying from vendors inside the app.

## 8. Changelog

| Date       | Change                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-08 | Initial draft from handoff notes                                                                                                                                                                    |
| 2026-10-25 | Rewritten from the recorded half of the scoping meeting. Folded in DOMAIN.md. Dropped requirement IDs and statuses; Linear tracks work items                                                        |
| 2026-10-25 | Added the unrecorded half of the meeting from the EM's recall, the handoff notes on procurement and the grant cap, and labeled our assumptions. Confirmed the VPR and put the combined PDF in scope |
