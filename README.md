# ShieldGate

ShieldGate is a working demo of an enterprise "AI governance" system — the kind of thing a
company would put in place to keep track of how its employees are using AI chat tools (ChatGPT,
Claude, Gemini, and similar), without simply banning them. It was built as a response to a
specific case study brief (see [`Case Study.md`](./Case%20Study.md)), and this README explains,
in plain language, what problem it solves and then walks you — assuming you have **no
programming background and none of the required software installed** — through getting it
running on your own computer from a completely empty starting point.

If you just want the short pitch: employees are pasting company data into AI chatbots faster
than anyone can write policy for it. ShieldGate sits between the employee's browser and the AI
chat tool, decides in real time whether what's being sent is safe to send, logs everything in a
tamper-evident way for auditors, and gives a compliance team a dashboard to see and manage all
of it — without ever storing the actual sensitive text anywhere.

---

## Part 1 — What problem is this solving?

### The case study, in plain language

[`Case Study.md`](./Case%20Study.md) describes a real, current problem: employees have started
using AI assistants for coding, writing, analysis, and customer communication faster than their
company's IT, legal, and compliance teams can write rules for it. The case study cites survey
data showing that nearly half of employees use AI tools their employer never approved, and that
even senior executives knowingly tolerate this because the productivity gain is too valuable to
slow down. When something does go wrong, breaches involving AI tools cost noticeably more than
ordinary data breaches, mostly because nobody can tell after the fact what data went where.

The case study also points at something less obvious: **an AI tool's availability isn't
guaranteed to stay constant.** It cites a real example — in June 2026 the U.S. government briefly
ordered Anthropic to suspend worldwide access to two of its newest models (Claude Fable 5 and
Claude Mythos 5) after a jailbreak was found that could make the model produce exploit code —
before lifting the restriction weeks later. A governance system has to cope with a tool's risk
status changing overnight, not just with data classification.

The brief asks for a system covering three challenges, and suggests four concrete example
features. Rather than paraphrase further, here is exactly what in this repository answers each
one:

### The three key challenges

**1. Getting employees to actually comply, willingly, not just writing a policy document.**
Outright bans just push AI usage further out of sight. ShieldGate's answer is to make the
*approved* path the *easiest* path:
- The browser extension (`apps/extension/`) intercepts a prompt **before** it's sent and checks
  it against policy in real time, right inside the AI tool's own page — no separate portal to
  remember to check.
- If a tool isn't approved yet, the same block panel that stops the risky send also offers a
  one-click **"Request access"** button, which files a real approval request — no ticketing
  system, no leaving the browser.
- That request runs through a genuine two-reviewer approval workflow (manager, then admin) in
  `apps/backend/src/shieldgate/approvals/engine.py`, visible to reviewers as a live queue on the
  dashboard's `/approvals` page, with an SLA countdown so requests can't quietly stall.
- The first time a prompt is blocked for someone, they see a one-time plain-language "here's why,
  here's what to do instead" coaching message rather than a bare error.

**2. Protecting the data itself.**
- Every prompt is checked against a **data category × tool tier** policy matrix (`policy/engine.py`)
  instead of a single "banned/allowed" flag per tool — the same tool can be fine for public
  information and blocked for confidential data.
- Detection happens in two layers: a fast, deterministic regex layer (`classify/patterns.py`) that
  catches structured sensitive data (card numbers, ID/passport numbers, API keys, emails,
  phone numbers) with **zero network calls**, and an optional local-inference layer (`classify/providers.py`,
  `classify/ollama.py`) for ambiguous free text, which runs entirely on infrastructure you
  control — no third-party AI API is ever contacted for classification. See
  [Optional: turn on local AI classification](#part-4--optional-turn-on-local-ai-classification-ollama).
- If something is blocked, the employee can click **"Send redacted version"**: the masked text is
  re-checked and only released if the redacted version itself comes back clean.
- Every decision — allowed, warned, blocked — is written to an **append-only, hash-chained audit
  log** (`audit/chain.py`). Nobody, including the backend itself, can quietly edit or delete a past
  entry without breaking the chain, and the dashboard's `/audit` page has a one-click "verify
  chain" button. Only a masked excerpt is ever stored — the raw prompt/response text is never
  persisted anywhere, by design.

**3. Transparency, ethics, and redress.**
- **Decision Registry:** any internal system that uses AI to make a decision about a person (the
  demo uses a fake "AI Ticket Triage" system) can register that decision. The affected person gets
  a reference code and can visit a public page — `/lookup`, the one page in this whole project
  that requires no login — to see a plain-language explanation and file an appeal, which an admin
  then resolves. This is a direct implementation of "someone affected by an AI-assisted decision
  should be able to find out AI was involved and ask for it to be reconsidered."
- **Provenance:** copying an AI-assisted reply automatically appends a disclosure footer
  (`AI-assisted · {tool} · {timestamp} · PV-…`), and the dashboard's `/provenance` page can verify
  a pasted passage against the original hash later.
- **Prohibited-Use Policy Engine:** a small, deliberately **hardcoded and non-configurable** list
  of things AI is never allowed to be used for here — covert employee monitoring, undisclosed
  profiling, social scoring, biometric ID without consent — auto-rejects a request at intake. There
  is intentionally no admin setting that can loosen this list.
- **Continuity Monitor** — this is the part that directly answers the case study's Fable 5 /
  Mythos 5 story. An admin can mark any registered tool `advisory` or `suspended` (vendor outage,
  safety incident, regulatory order) on the `/tools` page. The extension picks this up and
  instantly enforces the tool as the lowest risk tier and offers a fallback tool — without waiting
  for a redeploy, and without changing that tool's own normal registered risk rating once it's
  reinstated.

### The four example use cases

| Case study asks for… | What implements it |
|---|---|
| Monitor AI model risk (bias & data leakage) | Prompt-side regex/local-inference classifier (leakage) **and** response-side output scanning for credential leaks, exploit-shaped code, and bias-correlated language (`classify/output.py`), surfaced on the dashboard's `/output-risk` panel |
| Approval workflow for AI tool usage | Two-reviewer (manager → admin) approval FSM, in-flow "Request access", live `/approvals` queue with SLA countdown |
| Dashboard to track AI usage across departments | Next.js dashboard (`apps/dashboard/`) with role-scoped views (admin/manager/employee, enforced at the database level, not just the UI) and a usage-by-department panel |
| Suggested policies / automated checks for sensitive data | The category × tier Policy Matrix plus the two-layer classifier described above |

The system also goes a little beyond what was explicitly asked for: shadow AI discovery from
CSV-imported SSO/IdP sign-in logs (catching AI usage outside the browser, e.g. mobile apps or IDE
plugins), a regulatory "horizon scan" panel, and a print-ready executive report. None of that is
required reading to understand the core answer above.

### What the three pieces are

| Piece | What it is | Where it lives |
|---|---|---|
| Browser extension | A Chrome (Manifest V3) extension that watches AI chat pages and intercepts prompts/responses | `apps/extension/` |
| Backend | A FastAPI service that is the single source of truth for classification, policy, approvals, and the audit log | `apps/backend/` |
| Dashboard | A Next.js compliance dashboard for admins/managers/employees | `apps/dashboard/` |

All three talk to a local [Supabase](https://supabase.com/) stack (Postgres + auth), which you'll
set up in Part 2 below. Nothing in this project talks to a real production database or a real
third-party AI account — everything you're about to install runs entirely on your own machine.

---

## Part 2 — Complete setup guide (starting from a completely empty computer)

This part assumes you've never used a terminal, never installed a "package manager," and don't
have Docker, Supabase, or Ollama. It's written for Windows (PowerShell), since that's the most
common case; a short note is added wherever macOS/Linux differs.

### A few words before you start

- A **terminal** (also called a "command line" or, on Windows, "PowerShell") is a text-based
  window where you type commands instead of clicking icons. You'll open one and leave it running
  for most of this guide. Search "PowerShell" in the Windows Start menu to open one.
- Every gray code block below is something you **type into that terminal and press Enter**. Do
  them one at a time, in order, and wait for each one to finish (the cursor stops blinking / you
  get a new prompt line) before running the next.
- Several steps say "open a **new** terminal window." That's not optional — some installers change
  settings that only take effect in a terminal you open *after* installing them.
- If a command prints something you don't understand but doesn't say "error" or "failed," that's
  usually fine. If it does say error/failed, re-read the step — the fix is almost always "you
  skipped a previous step" or "you need a new terminal window."
- This project uses a few technical words repeatedly. Quick definitions: a **repository** ("repo")
  is just the project's folder of files; a **dependency** is a piece of code this project needs
  that someone else wrote, which gets downloaded rather than typed by hand; an **environment
  variable** (or a `.env` file, which is just a text file full of them) is a setting read at
  startup instead of being hardcoded; `localhost`/`127.0.0.1` both mean "this same computer" — so
  `http://127.0.0.1:8000` means "a website being served by a program running right here."

### Step 1 — Install Git

Git is what downloads/manages the project's source code, and Windows's Git installer also gives
you **Git Bash**, a small Unix-like terminal you'll need later for two helper scripts.

1. Go to <https://git-scm.com/download/win> and download the installer.
2. Run it, and click "Next" through every screen, keeping the defaults — the defaults are fine.
3. Open a **new** PowerShell window and confirm it worked:
   ```powershell
   git --version
   ```
   You should see something like `git version 2.4x.x`.

*(macOS: `brew install git`, or just run `git --version` once — macOS offers to install it for
you. Linux: `sudo apt install git` or your distro's equivalent.)*

### Step 2 — Get the project onto your computer

If you haven't already, get this project's folder onto your computer (for example, by cloning it
from wherever you were given access to it, or unzipping a folder someone sent you named
`ShieldGate`). Once you have it, open a PowerShell window and move into it:

```powershell
cd path\to\ShieldGate
```

Every command in the rest of this guide assumes your terminal is sitting inside this folder.

### Step 3 — Install Node.js (JavaScript runtime)

Both the extension and the dashboard are written in TypeScript/JavaScript, which needs Node.js
installed to run.

1. Go to <https://nodejs.org/en/download> and download the Windows installer for a **24.x**
   release.
2. Run the installer, keeping the defaults.
3. Open a **new** PowerShell window and confirm:
   ```powershell
   node -v
   npm -v
   ```

*(macOS: `brew install node@24`. Linux: use [nvm](https://github.com/nvm-sh/nvm) or your distro's
Node 24 package.)*

### Step 4 — Turn on pnpm (the package manager this project uses)

This project doesn't use plain `npm` to install its JavaScript dependencies — it uses `pnpm`, and
pins an exact version. Node ships a tool called Corepack that can install and pin it for you.

```powershell
corepack enable
corepack prepare pnpm@9.10.0 --activate
```

Open a **new** PowerShell window, then confirm:

```powershell
pnpm -v
```

You should see `9.10.0`. If `corepack` says it isn't recognized, run `npm install -g corepack`
first and repeat the two commands above.

### Step 5 — Install uv (Python package manager)

The backend is written in Python and uses a tool called [`uv`](https://docs.astral.sh/uv/) to
manage it. You do **not** need to separately install Python yourself — `uv` will automatically
download the exact Python version this project needs (3.12) the first time it's needed, into its
own private location, without touching any Python you may or may not already have.

In PowerShell:

```powershell
irm https://astral.sh/uv/install.ps1 | iex
```

Open a **new** PowerShell window, then confirm:

```powershell
uv --version
```

*(macOS/Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`.)*

### Step 6 — Install Docker Desktop

The project's database (Postgres) and authentication service run locally inside **Docker
containers** — small, self-contained environments that behave the same on every computer. Docker
Desktop is the app that runs them.

1. Go to <https://www.docker.com/products/docker-desktop/> and download Docker Desktop for
   Windows.
2. Run the installer. If it asks to enable "WSL 2," accept — this is a Windows feature Docker
   needs, and the installer sets it up for you. It may ask to restart your computer; do so if
   asked.
3. After it restarts, launch **Docker Desktop** from the Start menu. You can skip/close any
   sign-up prompt — a free account isn't required for local use. Wait until the whale icon in your
   system tray (bottom-right, near the clock) stops animating — Docker Desktop needs to say it's
   running before anything below will work.
4. Confirm it from PowerShell:
   ```powershell
   docker --version
   docker run hello-world
   ```
   The second command downloads a tiny test image and prints a "Hello from Docker!" message if
   everything is working.

*(macOS: download Docker Desktop for Mac from the same page. Linux: install Docker Engine per
your distro's instructions; Docker Desktop isn't required there.)*

You do **not** need to separately install the Supabase CLI — it's already listed as one of this
project's own dependencies and will be installed automatically in the next step, usable as
`pnpm exec supabase ...`.

### Step 7 — Install the project's own dependencies

Now that all the underlying tools exist, install everything this specific project needs. Run
these three commands from the project's root folder, in order (each depends on the previous one
finishing):

```powershell
pnpm install
uv --directory apps/backend sync
pnpm gen:policy
```

- `pnpm install` downloads every JavaScript dependency for the extension, dashboard, mock chat
  page, and shared packages (including the Supabase CLI itself).
- `uv --directory apps/backend sync` downloads every Python dependency for the backend into a
  private virtual environment under `apps/backend/`, downloading Python 3.12 first if it isn't
  already available to `uv`.
- `pnpm gen:policy` generates a set of shared type definitions from
  `packages/policy/src/index.ts` into the backend's Python models, so the extension and backend
  always agree on the exact shape of the data they exchange.

None of these three commands need Docker running yet — they only touch files on your own disk.

### Step 8 — Start the local database (Supabase)

Now start the local Postgres + authentication stack. This uses the Docker containers you just
confirmed are working, so make sure Docker Desktop is still open and running.

```powershell
pnpm exec supabase start
```

The very first time you run this, it downloads several Docker images and can take a few minutes
— that's normal, let it finish. When it's done, it prints a block of URLs and keys. Leave this
terminal window open (or note that Supabase now runs as background containers — you don't need to
keep watching it) and keep the printed output visible for the next step, or re-print it any time
with:

```powershell
pnpm exec supabase status
```

From that output, find the line that starts with `anon key:` — you'll need the long string after
it in the next step.

### Step 9 — Fill in the two configuration files

Each of the backend and the dashboard reads its settings from a small text file that isn't
checked into the project (since it can contain machine-specific values). Copy the provided
examples:

```powershell
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

The backend's `apps/backend/.env` works exactly as copied — no edits needed for the default setup
(it defaults to `CLASSIFIER_PROVIDER=regex-only`, meaning no AI model and no network call is
involved in classifying prompts; see [Part 4](#part-4--optional-turn-on-local-ai-classification-ollama)
if you want to change that later).

Open `apps/dashboard/.env.local` in any text editor (Notepad is fine) and replace
`REPLACE_WITH_supabase_status_anon_key` with the `anon key` value you copied in Step 8, then save.
The other two lines in that file are already correct for a local setup and don't need changes.

### Step 10 — Load the database schema and demo data

With Supabase running and the config files filled in, create all of ShieldGate's tables and load
its seed data (three demo accounts, the tool registry, the policy matrix):

```powershell
pnpm exec supabase db reset
```

Then add a couple weeks of realistic historical audit events so the dashboard's charts and feeds
aren't empty the first time you look at them (safe to run more than once — it does nothing if
audit events already exist):

```powershell
uv --directory apps/backend run python -m shieldgate.demo_seed
```

### Step 11 — Start the three running pieces

Each of these keeps running in its own terminal window, so open **three separate PowerShell
windows**, `cd` each one into the project folder, and run one command per window:

```powershell
# window 1 — the backend
uv --directory apps/backend run uvicorn shieldgate.main:app --port 8000
```

```powershell
# window 2 — the mock AI chat page (a stand-in "ChatGPT-like" page for the demo)
pnpm --filter mock-ai dev
```

```powershell
# window 3 — the compliance dashboard
pnpm --filter dashboard dev
```

If Windows Firewall pops up asking to allow network access for any of these, click **Allow** —
it's asking on behalf of your own machine talking to itself over `localhost`.

Once all three are running, next time you can start them together with one command from the
project root instead of three separate windows:

```powershell
.\scripts\dev.ps1
```

(macOS/Linux: `bash scripts/dev.sh`.) Note this script assumes `supabase` is already reachable —
if it complains that `supabase` isn't found, either use the three-window method above with
`pnpm exec supabase start` first, or install the Supabase CLI globally per
[Supabase's own instructions](https://supabase.com/docs/guides/local-development/cli/getting-started)
so a bare `supabase` command works too.

### Step 12 — Build and load the browser extension

The extension has to be "loaded unpacked" into Chrome — it isn't installed from the Chrome Web
Store for this demo.

```powershell
pnpm --filter extension build
```

Then in Chrome:

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the folder `apps/extension/.output/chrome-mv3` (select that
   exact folder, not a parent folder or a zip file).
4. The ShieldGate extension icon should now appear in your extensions list. Click its icon, open
   the options page, and confirm `backendUrl` is `http://127.0.0.1:8000` and `employeeToken` is
   `sg-emp-demo-001` — both are already the correct built-in defaults for everything you just set
   up, so you shouldn't need to change anything here.

### Step 13 — Confirm everything is working

- Visit <http://127.0.0.1:8000/api/v1/health> in a browser — it should return JSON with
  `"classifier_reachable"` and similar fields, meaning the backend is up.
- Visit <http://localhost:5175> — the "Mock AI Chat" page — and confirm you see a ShieldGate
  banner and a tier badge somewhere on the page (that's the extension announcing itself).
- Visit <http://localhost:3000/login> and click any of the three quick-switch demo accounts
  (Admin / Manager / Employee — all use the password `shieldgate-demo` behind the scenes, no
  typing required) to confirm the dashboard loads.
- Optionally, visit <http://127.0.0.1:54323> — this is **Supabase Studio**, a web-based database
  browser that comes with the local stack, if you ever want to look at the raw tables directly.

If all four load, the whole stack is running. Head to Part 3 for a guided tour of what to actually
try.

### If something goes wrong

- **`supabase start` fails or hangs** — Docker Desktop almost certainly isn't running. Open the
  Docker Desktop app and wait for it to say it's running, then try again.
- **A command says it's "not recognized"** — you likely installed something in Step 3–6 but are
  still in an old terminal window from before the install. Close all terminal windows and open a
  fresh one.
- **Something complains a port is already in use (`8000`, `3000`, `5175`, or `54321`–`54324`)** —
  another copy of that same service is probably still running from an earlier attempt; close that
  terminal window (or find and stop the process) before starting a new one.
- **The dashboard loads but login does nothing, or the page shows a Supabase/anon-key error** —
  double check `apps/dashboard/.env.local` has the real `anon key` from `pnpm exec supabase
  status` and not the placeholder text, then stop and restart the dashboard's terminal window.
- **Chrome says the extension's manifest is missing or unreadable** — you selected the wrong
  folder in Step 12; it must be `apps/extension/.output/chrome-mv3` exactly.
- **`uv sync` seems to hang the first time** — it's downloading a private copy of Python 3.12 in
  the background; this only happens once and needs an internet connection.

---

## Part 3 — A guided tour (see the whole point in five minutes)

With all three servers running and the extension loaded, this walks through the same governance
loop described in Part 1, so you can see each case-study challenge actually working.

1. **The money path (data protection).** On the Mock AI Chat page (<http://localhost:5175>), type
   `please charge 4532-0151-1283-0366 today` and send it. ShieldGate blocks it before it ever
   reaches the chat: a panel explains in plain language that this looks like a payment card
   number, and shows a masked version (`4532-****-****-0366`) — the real number never enters the
   conversation. Log into the dashboard as **Admin** (<http://localhost:3000/login>) and open
   `/incidents` — the blocked event appears in the live feed within a couple of seconds.
2. **Willing compliance.** Send the same card number again, but this time click **"Send redacted
   version"** — the masked text is re-checked and sent, and the transcript never shows the raw
   number. Send it a third time and click **"Request access"** instead — you'll get a confirmation
   with an SLA due date. Approve it as Manager, then as Admin, on the dashboard's `/approvals`
   page, and watch the status move from `triaged` → `under_review` → `approved`.
3. **Output/response scanning.** Type `show me the exploit` into the mock chat. The canned reply
   contains exploit-shaped code, and a warning ribbon appears above it *before* you'd think to
   copy it — this is the response-side check the case study calls out directly (a jailbroken model
   producing exploit code isn't caught by only scanning what the employee typed).
4. **Provenance.** Click "Copy" on any assistant reply — a toast confirms a disclosure footer was
   attached. Paste that text into the dashboard's `/provenance` page to verify it matches the
   original record.
5. **Decision Registry and redress.** From a terminal with Git Bash (installed alongside Git in
   Step 1), run:
   ```bash
   bash scripts/register-demo-decision.sh
   ```
   This simulates a fictional "AI Ticket Triage" system registering a decision it made about
   someone, and prints a `DR-…` reference. Open `/lookup` (no login needed — this is the one
   public page in the whole project) and enter that reference to see the plain-language
   explanation and file an appeal, which returns an `AP-…` reference an admin can resolve.
6. **Continuity.** On the dashboard's `/tools` page, mark any tool `suspended`, then reload the
   mock chat page — it now enforces that tool at the lowest risk tier and suggests a fallback,
   exactly like the case study's Fable 5/Mythos 5 suspension scenario, without anyone redeploying
   anything.
7. Browse `/shadow` (imported candidate tools from sign-in logs), `/horizon` (regulatory watch
   items), `/audit` (search, CSV export, and the hash-chain verify button), and
   `/reports/executive` (a print-ready summary) for the remaining governance panels.

(Note: clicking "Edit prompt" on a block panel just dismisses it without sending anything — it
never sends the prompt itself.)

---

## Part 4 — Optional: turn on local AI classification (Ollama)

Everything above already works completely without this section — the default classifier
(`CLASSIFIER_PROVIDER=regex-only`) uses deterministic pattern matching only, with no AI model and
no network call involved at all. This section is only for readers who want to see the second,
smarter classification layer that handles ambiguous free text a plain regex can't catch (e.g. "the
Q3 layoffs list" without any obvious card number/ID pattern in it).

This layer runs on [Ollama](https://ollama.com/), a tool that runs an AI model entirely on your
own computer — no account, no API key, and no third-party company ever receives your text.

1. Download and install Ollama for Windows from <https://ollama.com/download>.
2. In a terminal, pull the model this project is configured for:
   ```powershell
   ollama pull gemma4:12b
   ```
   This is a multi-gigabyte download and needs a reasonably capable machine (16GB+ RAM
   recommended) — expect it to take a while depending on your connection.
3. Ollama runs automatically as a background service afterward, listening on
   `http://127.0.0.1:11434`.
4. Open `apps/backend/.env` and change:
   ```
   CLASSIFIER_PROVIDER=regex-only
   ```
   to:
   ```
   CLASSIFIER_PROVIDER=ollama
   ```
5. Restart the backend's terminal window (stop it with Ctrl+C, run the `uvicorn` command from
   Step 11 again). Visit <http://127.0.0.1:8000/api/v1/health> and confirm `classifier_reachable`
   is `true`.

Two things worth knowing before you flip this on: this layer only ever activates when the regex
layer finds nothing *and* the text looks document-shaped (200+ characters or 3+ line breaks) — the
common case still resolves locally and instantly either way. And an internal accuracy check
(`apps/backend/tests/test_classifier_eval.py`, run 2026-07-22) found 3 false blocks on clean text
using `gemma4:12b`, short of a "zero false blocks" bar — which is exactly why `regex-only` ships as
the default rather than this. If the configured Ollama host isn't reachable when the backend
starts, it silently runs as `regex-only` for its whole session instead of failing — check the
`/health` endpoint if you're ever unsure which mode is actually active.

---

## Everyday commands (for when you're back and don't need the full walkthrough)

```bash
pnpm typecheck                                     # TypeScript across extension/dashboard/packages
pnpm lint                                           # eslint across the whole workspace
uv --directory apps/backend run ruff check .        # Python lint
pnpm gen:policy                                     # regenerate shared types after editing packages/policy
bash scripts/check-policy-fresh.sh                  # fails if gen:policy output would differ from committed
uv --directory apps/backend run pytest -v           # backend tests (needs supabase start + db reset first)
pnpm --filter extension --filter @shieldgate/policy test   # TS unit tests, no Supabase needed
pnpm --filter system-tests test                     # Playwright, needs all four services running
```

## Where to read more

- [`Case Study.md`](./Case%20Study.md) — the original brief this project answers.
