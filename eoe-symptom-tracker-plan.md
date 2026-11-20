# Plan: EoE Symptom Tracker (new repo)

## Goal
Build a small web app that a parent or caregiver can open on any phone or computer to:
1. log Dupixent doses and see when the next one is due,
2. log daily EoE symptoms in about 30 seconds,
3. record endoscopy and biopsy results (eos/hpf),
4. see how long it takes symptoms to improve compared with the baseline,
5. print a one-page summary for her GI doctor.

The app is for one patient and one or two caregivers. It is a record to bring to appointments, not medical advice.

## Repo
- New repo: `damaneice/eoe-symptom-tracker`, private. It is not under CommonLit.
- Use Node v24 with an `.nvmrc`, following the same convention as `damaneice/geospatial-data-pipeline`.

## Reference prototype
A working single-page prototype already exists as a Claude artifact. It is private to the repo owner:
https://claude.ai/artifact/94oUcK19hGk6BcJyR1fdYT

A Claude session can read its source with the Artifact tool (`action: "read"`). Treat it as the spec for the UI, the scoring and the chart. Port its behavior, not its storage layer or its CSS. No data is imported from it.

## Stack (everything on Cloudflare)
One Cloudflare Worker serves both the built frontend and a small JSON API. Data lives in one D1 database. There is no other service.

| Concern | Choice | Why |
|---|---|---|
| Frontend | Vite + SolidJS + TypeScript, plain Solid with no SolidStart | About 7KB with no virtual DOM. Signals give the live score and derived metrics without hand-written re-render code |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | Mobile-first utilities, built-in dark mode and breakpoints, and no config file |
| API | The same Worker, with routes under `/api/*` and no framework (or Hono if routing gets messy) | About a dozen endpoints. Static assets are served by Workers Static Assets |
| Database | Cloudflare D1 (SQLite), with migrations via `wrangler d1 migrations` | Free tier, syncs across devices, no server to run |
| Auth | Cloudflare Access (Zero Trust free plan) with email one-time PIN, plus an allowlist of 2–3 caregiver emails | No login code in the app. Adding a caregiver means adding an email to the Access policy |
| Build + dev | `@cloudflare/vite-plugin`, so `npm run dev` runs the frontend, the Worker and a local D1 together | One command, one deploy |
| Hosting | A subdomain of a domain on the Cloudflare account, behind Access. `workers.dev` and preview URLs are turned off | HTTPS URL that opens from anywhere |
| Deploys | GitHub Actions on every push to `main`: lint, test, apply D1 migrations, then `wrangler deploy`. No preview deploys | One workflow and one API token secret |
| Install on phone | PWA manifest and icons, with no service worker at first | "Add to Home Screen" opens it like an app |
| Charts | Hand-drawn SVG, as in the prototype | Only one chart is needed, so no chart library |
| Tests | Vitest for domain logic, `@cloudflare/vitest-plugin` for the API against a local D1 | Scoring, week math and merging are the risky parts |

### How auth works
- Only caregivers use the app, each with their own email on the Access allowlist. The patient does not log in.
- Access sits in front of the whole hostname. Anyone not on the allowlist never reaches the Worker.
- Set the Access session length to **1 month**, so caregivers aren't typing an emailed PIN every day.
- The Worker still verifies the `Cf-Access-Jwt-Assertion` header (team domain + AUD tag, via `jose`) on every `/api/*` request, and rejects requests without a valid token. This is defense in depth on top of turning off `workers_dev` and preview URLs in `wrangler.jsonc`.
- The user's email from the token is saved as `updated_by` / `created_by` / `author`. There are no user, household or member tables.
- In local dev, a `DEV_USER_EMAIL` variable in `.dev.vars` stands in for the Access token, but only for requests to `localhost`, so setting it by mistake in production can't skip sign-in.
- API tests sign their own tokens with a throwaway key. An optional `ACCESS_JWKS` variable supplies the matching public key, so the Worker doesn't fetch Access's real keys. Production leaves it unset.

## Data model (D1 / SQLite)
One patient per deployment, so there are no tenant keys. All dates are local `YYYY-MM-DD` strings chosen by the browser. The server never works out "today".
```
settings     id = 1 (single row), patient_name, first_dose TEXT NULL (YYYY-MM-DD),
             interval_days INTEGER (7|14), dose_mg INTEGER
daily_logs   date TEXT PK, swallow 0-3, chest 0-3, abdo 0-3, vomit INTEGER,
             impaction 0/1, eating 0/1, sleep 0/1, overall 0-10 NULL,
             updated_by TEXT, updated_at TEXT
day_notes    id INTEGER PK, date TEXT, text TEXT, author TEXT, created_at TEXT
doses        id INTEGER PK, date TEXT, mg INTEGER, interval_days INTEGER,
             site TEXT, side_effect TEXT, note TEXT, created_by TEXT
scopes       id INTEGER PK, date TEXT, peak_eos_hpf INTEGER,
             proximal_eos_hpf INTEGER NULL, mid_eos_hpf INTEGER NULL,
             distal_eos_hpf INTEGER NULL, findings TEXT
```

### Rules
- **Daily logs merge by field.** The form starts with every symptom at 0, so a new day is always complete and "logged" just means a row exists. Saving sends only the fields that changed. The server inserts the row with defaults if it's missing, then updates only the fields it was sent. This way two caregivers logging different parts of the same day don't overwrite each other.
- **Notes never overwrite.** Each caregiver adds their own `day_notes` row, and the day shows all of them with author and time.
- **Each dose saves its own interval.** `interval_days` is copied from settings when a dose is logged. Each gap is judged by the longer of its two doses' intervals, and "next due" uses the latest dose's interval. Switching between weekly and every 2 weeks, in either direction, isn't flagged as a missed dose.
- **Deletes are permanent** after a confirm dialog that names the record, for example "Delete dose on Nov 12 (300mg, left thigh)?". D1 Time Travel is the safety net.
- **Validation** is small hand-written functions in `src/domain/`, used by both the forms and the Worker, and unit-tested. No validation library.

## API
All routes return JSON and require a valid Access token.
```
GET    /api/state              settings + all logs, notes, doses and scopes (small enough to load at once)
PUT    /api/settings
PATCH  /api/logs/:date         merge only the sent fields; creates the day with defaults if missing
DELETE /api/logs/:date
POST   /api/notes              DELETE /api/notes/:id
POST   /api/doses              DELETE /api/doses/:id
POST   /api/scopes             DELETE /api/scopes/:id
```
The frontend loads `/api/state` once into a single Solid `createStore`. Every derived metric is a `createMemo` over the domain functions, so it recomputes only when the data it reads changes. **Saving waits for the server:** the button shows "Saving…", and the store updates only after the API confirms. If the call fails, an error is shown and the form keeps its values. There's no instant update or rollback. The screens are components switched by the URL hash, so there's no router library.

Solid gotchas to follow: don't destructure props, use `<For>` and `<Show>` instead of `.map()` and `&&`, and remember that a component body runs only once.

## Scoring (keep identical to the prototype)
- Symptom score from 0 to 17, where lower is better. It is the sum of:
  - swallow (0–3), chest (0–3) and abdo (0–3),
  - vomiting count, capped at 3,
  - 3 points for a food impaction,
  - 1 point for eating trouble,
  - 1 point for disrupted sleep.
- Swallowing scale: 0 none, 1 slow or careful eating, 2 needed a drink to get food down, 3 food got stuck.
- Overall day rating (0–10) is stored separately and is not part of the score.

## Derived metrics (pure functions, unit tested)
These live in `src/domain/`.
- **Treatment start:** `settings.first_dose`, or the earliest dose if that is not set.
- **Week number:** `floor(daysSince(start)/7) + 1`. Days before the start are week 0. With no treatment start at all, weeks count from the first logged day.
- **Baseline:** the average score of the first calendar week with **at least 3 logged days**.
  - If any of those days fall before the first dose, label it **"since treatment started"**.
  - Otherwise, label it **"since tracking started"**. This is the expected case if logging begins after treatment has started.
  - Every metric that compares against the baseline uses the same label.
- **Weekly stats:** average score, days logged, bad days (score of 6 or more), impactions and average day rating.
- **Last-7-days change:** percent change against the baseline. A drop of 10% or more is shown as good, a rise of 10% or more as bad.
- **Best week:** the lowest weekly average among weeks with at least 3 days logged.
- **"Halved from baseline":** the first week with at least 3 days logged and an average at or below half the baseline, with the baseline's label, for example "halved since tracking started, week 6". This is the headline answer to "how long until it improves".
- **Next dose due:** last dose date plus that dose's `interval_days`. Show "due" on that date and "overdue" after it. Flag gaps longer than the interval plus 2 days, using the longer of the two doses' intervals.
- **Injection site rotation:** left thigh → right thigh → left abdomen → right abdomen → left upper arm → right upper arm.
- **Biopsy labels**, based on peak eos/hpf: 6 or fewer is the remission range, under 15 is responding, 15 or more is active.

## Screens
1. **Header**, always visible: treatment week and day, next dose due (with "due today" and "overdue" shown prominently), and change against the baseline with its label.
2. **Daily log** (the default view): a date picker that defaults to the phone's today and loads that day's entry if one exists, segmented 0–3 buttons, a vomiting stepper, three toggles, an overall rating from 0 to 10 and a live score. Below the form are the day's notes, each with author and time, and an "add note" box. Below that, a list of recent days with Edit buttons.
3. **Progress:** a chart with daily dots, the weekly average line, a dashed baseline, dose ticks and biopsy markers labeled with peak eos/hpf. A range toggle above it offers **12 weeks** (the default), **6 months** and **all**. "All" hides the daily dots and shows only the weekly line, the baseline and biopsy markers. Below the chart: stat tiles and a week-by-week table.
4. **Doses:** a form for date, mg (pre-filled from settings), site (pre-filled with the next site in the rotation) and side effect (none, injection-site reaction, eye redness, cold sore, joint pain, other), plus a note. Below it, the dose history with gap flags.
5. **Endoscopy:** a form for date, peak eos/hpf, optional proximal, mid and distal eos/hpf, and findings, plus a results list.
6. **Setup:** patient name, first dose date (optional), schedule (weekly or every 2 weeks) and usual mg. Caregivers are managed in the Access policy, not in the app.
7. **Summary** (for the doctor): a printable page with the chart, the week-by-week table, doses, biopsies and day notes for a date range. The range defaults to the most recent biopsy (or the start of tracking, if there's none) through today, with an "all time" shortcut. The baseline is always shown for comparison, even when it falls outside the range. The range lives in the URL hash, so it can be bookmarked. Use the browser's print to save it as a PDF, with a print stylesheet that hides navigation and fits the page.

**First use:** if there's no settings row, the app opens Setup first, with patient name, schedule and mg required. After saving, it goes to the daily log. There's no separate onboarding screen.

### Responsive layout
- Mobile-first. It must work at 360–400px wide with no horizontal scrolling and tap targets of at least 44px.
- On phones, navigation is a bottom tab bar for the four main screens (Log, Progress, Doses, More). More holds Endoscopy, Summary and Setup. From 768px up (`md:`), navigation moves to a top bar showing every screen, content is centered with a max width of about 960px, and the Progress view puts the chart and stat tiles side by side.
- The week-by-week table scrolls horizontally inside its own container (`overflow-x-auto`) on narrow screens rather than widening the page.
- Dark mode follows `prefers-color-scheme`.

### Styling with Tailwind
- **Setup:** Tailwind v4 with the `@tailwindcss/vite` plugin. There's no `tailwind.config.js`. One `src/app.css` holds `@import "tailwindcss";` and a `@theme` block.
- **Tokens:** semantic colors in `@theme`, such as `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-good` and `--color-bad`. A `@media (prefers-color-scheme: dark)` block redefines them, so components use `bg-surface text-text` and rarely need `dark:` classes. Add `color-scheme: light dark` so the native date picker and form controls match the theme.
- **Chart:** the SVG uses the same tokens through `fill-*` / `stroke-*` classes or `var(--color-…)`, so it follows dark mode too.
- **Print:** `print:` variants hide navigation and switch the summary to light colors.
- **Repeated controls:** the segmented 0–3 buttons, toggles, stepper, cards and tab bar become small Solid components, so the long class lists live in one place. Use `@apply` sparingly, only for base element styles in `app.css`.
- **Phone details:** `pb-[env(safe-area-inset-bottom)]` on the bottom tab bar so it isn't hidden behind the iPhone home bar, `min-h-11` (44px) on everything tappable, and `text-base` (16px) or larger on inputs so iOS doesn't zoom in on focus.
- **Tooling:** `prettier-plugin-tailwindcss` to keep class order consistent.

## Milestones
1. **Scaffold:** Vite + SolidJS + TS with `vite-plugin-solid`, `@tailwindcss/vite` and `@cloudflare/vite-plugin`, `wrangler.jsonc` with a D1 binding and `workers_dev: false`, ESLint, Prettier, Vitest, `.nvmrc`, and GitHub Actions running lint and tests.
2. **Domain logic:** `src/domain/` with the score, week, baseline (with its label), weekly-stats, next-dose and gap, site-rotation, biopsy-label and validation functions, fully unit-tested. Write the tests first.
3. **D1 + API:** the first migration, the Worker routes including the field-merging `PATCH`, Access JWT verification, and API tests against a local D1.
4. **Screens:** set up the Tailwind theme tokens and shared controls first, then the first-use Setup redirect, then port the prototype's views as Solid components with the responsive layout above. Add day notes.
5. **Summary page:** the date range, print stylesheet and layout.
6. **Deploy:**
   - Create the D1 database and the Access application, with the email allowlist and a 1-month session.
   - Point a subdomain at the Worker.
   - Add the GitHub Actions deploy job: apply migrations, then `wrangler deploy` on push to `main`, with the Cloudflare API token in secrets.
7. **PWA:** manifest and icons. Add an offline service worker only if it turns out to be needed.
8. **After version 1:** a dose-day reminder email, sent by a daily Cron Trigger through Cloudflare Email Routing to the verified caregiver addresses. It needs a timezone setting.
   - An events log (diet changes, medication changes, illness) shown as markers on the chart. It was dropped from version 1 to keep the app small; until then, these go in day notes.

## Privacy
- This is health data about a child or a family member. Keep the repo private, put Access in front of every route, verify the Access token in the Worker as well, and add no analytics.
- Never commit secrets. The Access team domain and AUD tag go in `wrangler.jsonc` vars, since they are not secret. The Cloudflare API token for CI deploys goes in GitHub Actions secrets.
- Backups: D1 Time Travel is built in, keeping 30 days on the paid plan and 7 on free. An occasional `wrangler d1 export` gives a full SQL dump as an extra copy, and it's also how to get the data out.

## Definition of done
- Opening the production URL on a phone, signing in with the email PIN and logging a day works. The entry shows up on a second device.
- Two caregivers can each save different fields and their own notes for the same day without overwriting each other.
- An email not on the allowlist cannot reach the app or the API.
- The layout works on a phone and on a laptop without horizontal scrolling, in light and dark mode.
- The Progress view shows the weekly trend against the labeled baseline and the "halved from baseline" week, with a working range toggle.
- The summary page prints to a clean PDF for a chosen date range.
- Domain and API tests pass in CI, and a push to `main` deploys with migrations applied.
