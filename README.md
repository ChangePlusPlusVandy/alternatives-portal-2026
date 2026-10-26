# Alternatives Portal

An internal web app for **Alternatives**, a youth-services nonprofit, built by [Change++](https://changeplusplus.org) at Vanderbilt.

Three tools, in priority order:

| Tool            | What it does                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **PAR**         | Builds each employee's semi-monthly Personnel Activity Report, collects signatures, tracks who hasn't signed |
| **Procurement** | Replaces the paper supply order form and the spreadsheet behind it                                           |
| **Resources**   | One page of internal links, forms, and documents                                                             |

What we're building and why: [`docs/SPEC.md`](docs/SPEC.md). Work items: Linear.

---

## Contents

1. [How this project works](#1-how-this-project-works)
2. [Tech stack](#2-tech-stack)
3. [One-time setup](#3-one-time-setup)
4. [Running the app](#4-running-the-app)
5. [Working with Claude Code](#5-working-with-claude-code)
6. [Your first contribution](#6-your-first-contribution)
7. [Git cheat sheet](#7-git-cheat-sheet)
8. [Rules](#8-rules)
9. [Project docs](#9-project-docs)
10. [Getting help](#10-getting-help)

---

## 1. How this project works

Two people run the project. The **PM** talks to the client and owns the requirements. The **EM** runs the engineering.

You'll build most of this by directing **Claude Code**, not by typing every line. Your job:

1. Read the Linear issue and the matching part of `docs/SPEC.md`.
2. Tell Claude exactly what to build.
3. Review what it wrote. Read the diff, run the app, click through it.
4. Open a pull request. A teammate reviews it.

You own every line you submit, even if Claude wrote it. If you don't understand something, ask Claude to explain it before you commit.

`CLAUDE.md` tells Claude how we work. You don't need to repeat it in your prompts.

---

## 2. Tech stack

You don't need to know these on day one.

| Tool             | What it does here                                     | Docs                                                                                            |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Next.js**      | The web framework: pages, routing, server code        | [nextjs.org/learn](https://nextjs.org/learn)                                                    |
| **TypeScript**   | JavaScript with types. Catches bugs before you run it | [typescriptlang.org](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html) |
| **Supabase**     | Database, login, file storage                         | [supabase.com/docs](https://supabase.com/docs)                                                  |
| **Tailwind CSS** | Styling with class names like `p-4 text-sm`           | [tailwindcss.com](https://tailwindcss.com/docs)                                                 |
| **shadcn/ui**    | Prebuilt components: buttons, forms, tables           | [ui.shadcn.com](https://ui.shadcn.com)                                                          |
| **zod**          | Checks that data has the right shape                  | [zod.dev](https://zod.dev)                                                                      |
| **Vitest**       | Runs tests                                            | [vitest.dev](https://vitest.dev)                                                                |
| **Vercel**       | Hosts the app                                         | [vercel.com/docs](https://vercel.com/docs)                                                      |

---

## 3. One-time setup

### 3.1 Install

1. **Node.js 24** from [nodejs.org](https://nodejs.org) or with [nvm](https://github.com/nvm-sh/nvm). Check: `node --version`.
2. **Claude Code**: follow the [setup guide](https://code.claude.com/docs/en/setup), then sign in.
3. An editor. [VS Code](https://code.visualstudio.com) if you don't have a preference.

### 3.2 Get the code

```bash
git clone https://github.com/ChangePlusPlusVandy/alternatives-portal-2026.git
cd alternatives-portal-2026
npm install
```

### 3.3 Secrets

The app needs keys that are never committed.

```bash
cp .env.example .env.local
```

Ask the EM for the values. `.env.local` is ignored by git. Don't commit it, paste it in Slack, or put it in a screenshot.

---

## 4. Running the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It reloads when you save. Stop with `Ctrl+C`.

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start the dev server                             |
| `npm run lint`      | Find code problems                               |
| `npm run format`    | Auto-format every file                           |
| `npm run typecheck` | Check types                                      |
| `npm test`          | Run tests                                        |
| `npm run build`     | Production build. Catches errors dev mode misses |

Run `lint`, `typecheck`, and `test` before opening a PR. CI runs them and blocks the merge if they fail.

---

## 5. Working with Claude Code

### Start a session

From the repo folder:

```bash
claude
```

Claude reads `CLAUDE.md` on its own.

### Write good prompts

Name the issue, point to the spec, ask for a plan.

Good:

> Implement ALT-6: the signature pad on the PAR page. Read the PAR section of docs/SPEC.md first. Plan before you write code.

Bad:

> make the signature thing

Tips:

- **Plan first.** `Shift+Tab` switches to plan mode. Claude proposes a plan and touches no files. Read it, push back, then approve.
- **One task per session.** Run `/clear` when you switch tasks.
- **Small steps.** One piece at a time. Check it works, then the next.
- **Ask it to explain.** "Explain what this function does and why" is a great prompt.
- **If it loops,** press `Esc`, describe the problem differently, or ask the EM.

Skills and MCP servers: try whatever helps you. Install them at the user level (`~/.claude/`) so they don't affect teammates. Share what works.

### Review everything

Claude can be confidently wrong. Before you commit:

- Read the full diff.
- Run the app and click through what changed.
- Check it didn't touch files unrelated to your task.

---

## 6. Your first contribution

Claude can run every git step below for you: branch, commit, push, open the PR. Just ask. You still read the diff before anything is committed.

1. **Pick an issue** in Linear. Assign yourself and move it to In Progress. Note the key, e.g. `ALT-6`.
2. **Update `main`:**
   ```bash
   git checkout main
   git pull
   ```
3. **Branch:**
   ```bash
   git checkout -b feat/alt-6-signature-pad
   ```
4. **Do the work** with Claude Code. Commit as you go:
   ```bash
   git commit -m "feat(par): add signature pad (ALT-6)"
   ```
5. **Push:**
   ```bash
   git push -u origin feat/alt-6-signature-pad
   ```
6. **Open a pull request** on GitHub and fill in the template. Put the Linear key in the title. Add screenshots for UI changes.
7. **Checks and review.** Fix anything CI flags. A GitHub Action also leaves an automatic Claude review on every PR. Treat it like a teammate's comments. Then wait for a human approval.
8. **Squash and merge.** Delete the branch.
9. **Clean up:**
   ```bash
   git checkout main
   git pull
   ```

`main` is protected. Every change needs a PR, an approval, and green checks.

### Naming

| Thing    | Format                                 | Example                                |
| -------- | -------------------------------------- | -------------------------------------- |
| Branch   | `type/issue-key-short-description`     | `feat/alt-6-signature-pad`             |
| Commit   | `type(area): what changed (ISSUE-KEY)` | `feat(par): add signature pad (ALT-6)` |
| PR title | Same as the commit                     | `feat(par): add signature pad (ALT-6)` |

Types: `feat` new feature, `fix` bug fix, `chore` setup or dependencies, `docs` documentation.

Areas: `par`, `procurement`, `resources`. Leave it out if the change isn't about one tool.

The issue key in the branch name is what links the branch to Linear.

---

## 7. Git cheat sheet

Only the parts people get stuck on.

| I want to…                                  | Command                                                             |
| ------------------------------------------- | ------------------------------------------------------------------- |
| Get the latest `main` into my branch        | `git checkout main && git pull && git checkout - && git merge main` |
| Throw away my uncommitted changes to a file | `git restore <file>`                                                |
| Set work aside without committing           | `git stash`, then `git stash pop` to bring it back                  |
| Fix the last commit message                 | `git commit --amend`, only if you haven't pushed yet                |

Stuck in a weird git state? **Stop and ask** before running anything with `--force`, `reset --hard`, or `rm`.

---

## 8. Rules

- **This repo is public.** Never commit real names, emails, hours, grant details, or anything else from Alternatives. Test data must be obviously fake.
- **Never commit secrets.** If you do by accident, tell the EM right away. The key has to be rotated.
- **Don't add npm packages** without asking the EM.
- **One task per PR.** Small PRs get reviewed faster.

---

## 9. Project docs

| File                             | Read it when                                                 |
| -------------------------------- | ------------------------------------------------------------ |
| [`docs/SPEC.md`](docs/SPEC.md)   | You need to know what to build, or what a term means         |
| [`docs/samples/`](docs/samples/) | You want to see the real forms the app replaces              |
| [`CLAUDE.md`](CLAUDE.md)         | You want to know what Claude has been told about how we work |

---

## 10. Getting help

| Question                   | Ask                                                    |
| -------------------------- | ------------------------------------------------------ |
| Setup, code, git, Claude   | The EM, or the team channel                            |
| What a requirement means   | The PM. Don't guess. Requirements come from the client |
| Claude did something weird | The team channel. Share the prompt and what happened   |
