# EoE Symptom Tracker

A small app for logging Dupixent doses, daily EoE symptoms and biopsy results. It runs on one
Cloudflare Worker with a D1 database. See [the plan](eoe-symptom-tracker-plan.md) for the design.

## Develop

```bash
nvm use
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply eoe-symptom-tracker --local
npm run dev
```

`npm run dev` runs the Solid frontend, the Worker API and a local D1 database together. There's
no Cloudflare Access locally: `DEV_USER_EMAIL` in `.dev.vars` stands in for the signed-in
caregiver, and only on `localhost`. Restart the dev server after changing `.dev.vars`.

Apply migrations again with the same `wrangler d1 migrations apply` command whenever a new file
appears in `migrations/`.

## Check

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs two Vitest projects: `domain` (plain functions in `src/domain/`) and `worker` (the
API, run in the Workers runtime against a fresh local D1 database for each test).

Run `npm run cf-typegen` after changing `wrangler.jsonc` to regenerate `worker-configuration.d.ts`.
