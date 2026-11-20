# EoE Symptom Tracker

A small app for logging Dupixent doses, daily EoE symptoms and biopsy results. It runs on one
Cloudflare Worker with a D1 database. See [the plan](eoe-symptom-tracker-plan.md) for the design.

## Develop

```bash
nvm use
npm install
npm run dev
```

`npm run dev` runs the Solid frontend, the Worker API and a local D1 database together.

## Check

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Run `npm run cf-typegen` after changing `wrangler.jsonc` to regenerate `worker-configuration.d.ts`.
