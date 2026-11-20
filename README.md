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

## Deploy

The first deploy is a one-time setup on your Cloudflare account. Run the wizard and follow it:

```bash
bash scripts/setup-cloudflare.sh
```

It signs Wrangler in, creates the D1 database, sets up Cloudflare Access (the sign-in gate)
for the app's address, writes the non-secret values into `wrangler.jsonc`, applies the
migrations, deploys, and adds the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets to
GitHub. Commit the updated `wrangler.jsonc` and `worker-configuration.d.ts` afterwards.

After that, every push to `main` deploys: CI applies any new migrations, then deploys the
Worker. Caregivers are added or removed in the Access policy, not in the app.
