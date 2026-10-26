# CLAUDE.md

Instructions for AI coding agents working in this repo. Humans: start with `README.md`.

> **Keep this file current.** If you change a convention, command, folder, or decision, update this file in the same PR.

## What this project is

An internal web app for **Alternatives**, a youth-services nonprofit, built by Change++ at Vanderbilt. Three tools in one app, in priority order:

1. **PAR tool**: builds each employee's semi-monthly Personnel Activity Report from their reported hours and grant allocations, collects employee and supervisor signatures, and tracks who hasn't signed. Funders audit these.
2. **Procurement**: replaces the paper supply order form and the spreadsheet behind it.
3. **Resources**: a central page of internal links, forms, and documents.

- **What to build, and what the words mean:** `docs/SPEC.md`. Read the relevant section before touching PAR or procurement logic. Grant and payroll terms are easy to get subtly wrong.
- **Work items:** Linear. Branches, commits, and PRs reference the issue key (e.g. `ALT-6`).
- **The real forms:** `docs/samples/`. Anonymized copies of what the app replaces.

## Stack

| Layer                        | Choice                                     |
| ---------------------------- | ------------------------------------------ |
| Framework                    | Next.js (App Router) + TypeScript (strict) |
| Database, auth, file storage | Supabase (Postgres + Row Level Security)   |
| UI                           | Tailwind CSS + shadcn/ui                   |
| Validation                   | zod                                        |
| Tests                        | Vitest                                     |
| Hosting                      | Vercel                                     |

Not chosen yet: form handling, signature capture, PDF generation, email. Ask before adding a package for any of these.

## Commands

```bash
npm run dev           # local dev server at http://localhost:3000
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only, used in CI)
npm run typecheck     # next typegen, then tsc --noEmit
npm test              # Vitest
npm run build         # production build
```

Before saying a task is done, run `lint`, `typecheck`, and `test`. CI runs these on every PR and merging is blocked if they fail.

## Project structure

```
src/
  app/                  # routes (App Router). One folder per tool:
    par/
    procurement/
    resources/
  components/
    ui/                 # shadcn/ui components. Don't hand-edit; re-add via the shadcn CLI
    <feature>/          # components used by one tool only
  lib/
    supabase/           # Supabase clients (server + browser). The only place clients are created
    par/                # PAR business logic (period math, hour splitting). Pure functions + tests
    procurement/        # procurement business logic
    validation/         # zod schemas shared by forms and server actions
supabase/
  migrations/           # SQL migrations, append-only
docs/
  SPEC.md               # goals, business rules, glossary, open questions
  samples/              # anonymized real forms
```

Only `src/app`, `src/components/ui`, and `src/lib` exist so far. Create the rest when you need it.

## Architecture

- **Server-first.** Pages are React Server Components by default. Add `"use client"` only for interactivity (forms, signature pad).
- **Mutations go through Server Actions.** Validate every input with a zod schema from `lib/validation/` before touching the database.
- **Business logic lives in `lib/`, not in components.** Anything involving hours, dates, periods, or percentages is a pure function in `lib/par/` with unit tests.
- **Security lives in the database.** Every table has Row Level Security. Hiding a button in the UI is not access control.

### Roles

| Role         | Can                                                                               |
| ------------ | --------------------------------------------------------------------------------- |
| `employee`   | enter own hours, sign own PARs, request supplies, view resources                  |
| `supervisor` | everything employee can, plus co-sign their team's PARs and supply requests       |
| `admin`      | everything, including grants, allocations, users, all PARs, all orders, resources |

Roles are stored on the user's profile row and enforced with RLS policies. The list of roles is not final; see `docs/SPEC.md` section 2.

### Data model (draft)

- **PAR:** `profiles` (user + role + supervisor), `grants`, `allocations` (profile × grant × percent, with effective dates), `pars` (one per person per period: reported total hours, status, signature image paths, signed timestamps), `par_lines` (par × grant × day × hours: the generated grid)
- **Procurement:** `orders` (requester, vendor, class, contract, GL code, status), `order_items` (link, quantity)
- **Resources:** `resources` (title, url or file path, category)

The grid is stored per day per grant so a signed PAR can be reproduced exactly. Never store or report hours by pay period. See `docs/SPEC.md` for why.

## Rules for agents

### Scope

- Do **only** what the task asks. No drive-by refactors, renames, or "while I'm here" fixes. Mention them in your summary instead.
- Prefer the **smallest change** that works. Fewer files and fewer lines beat clever abstractions.
- No speculative code: no options, flags, or generic helpers "for later."
- No commented-out code, no leftover `console.log`, no TODOs without a Linear key.

### Reuse before you create

- Search the codebase before writing a new component, hook, util, or type. Extend what exists.
- Use shadcn/ui components before writing custom UI.
- Use existing zod schemas and types. Don't redefine shapes that already exist.

### Dependencies

- **Do not add npm packages without asking.** Say what it's for and why the existing stack can't do it.

### Database

- Schema changes are **new migration files** in `supabase/migrations/`. **Never edit a migration that has been merged.**
- Every new table gets RLS enabled plus policies for each role in the same migration.
- Never run commands against the remote/production database.

### Data and secrets (this repo is public)

- Never read, print, or edit `.env` / `.env.local`. Use `.env.example` for variable names.
- Never commit real names, emails, hours, grants, or any data from Alternatives. Test data must be obviously fake ("Test Employee", "Grant A").
- Never hardcode keys or URLs. Use env vars.

### Tests

- Any logic touching hours, dates, PAR periods, allocations, or money **must** have Vitest tests, including the edge cases listed in `docs/SPEC.md`.
- Don't delete or weaken a failing test to make it pass. Fix the code or ask.

### When unsure

- If the spec is silent, or the point is listed as an open question in `docs/SPEC.md`, **stop and ask**. Don't invent business rules. This is by far the most important thing. If there is any sliver of doubt please ask questions.

## Workflow

1. **Understand.** Read the Linear issue and the relevant `docs/SPEC.md` section.
2. **Plan.** For anything touching more than one file, write a short plan first (use plan mode) and get it approved.
3. **Implement** the smallest version that meets the requirement.
4. **Verify.** Run `lint`, `typecheck`, `test`. Fix everything.
5. **Summarize.** What changed, which Linear issue it covers, anything skipped or worth flagging.

### Git

- Branch from `main`. Format `type/issue-key-short-description`: `feat/alt-6-signature-pad`, `fix/alt-14-order-total`, `docs/alt-2-spec-update`.
- Commit messages: Conventional Commits with the issue key, e.g. `feat(par): add signature pad (ALT-6)`.
- One task per PR. PRs are squash-merged into `main`, which is protected. Never push to `main` directly, never force-push.

## Decisions log

Settled choices. Don't re-argue these without a new reason; add a row when you make a new one.

| Date    | Decision                                                                    | Why                                                                                                                             |
| ------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10 | Custom web app instead of low-code (Power Apps / AppSheet)                  | Student devs get real engineering experience; Change++ supports it                                                              |
| 2026-10 | Next.js + Supabase + Vercel                                                 | Mainstream, well-documented, free tiers, easy for new devs and agents                                                           |
| 2026-10 | Public repo                                                                 | Rulesets and secret scanning are free on public repos. No client data in the repo, ever                                         |
| 2026-10 | Squash merge only, linear history on `main`                                 | One clean commit per PR; easy to read and revert                                                                                |
| 2026-10 | Employees enter their period total in the app. No Paylocity integration yet | Most staff are exempt and don't log hours in Paylocity, so there is nothing to import. Revisit if that changes                  |
| 2026-10 | Store the PAR grid per day per grant                                        | The PAR is a daily grid, pay periods (biweekly) and PAR periods (semi-monthly) don't align, and auditors require daily variance |
| 2026-10 | Sign in with Google Workspace                                               | Every employee has a Google work email                                                                                          |
