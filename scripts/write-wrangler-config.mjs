// Writes the deploy values captured by setup-cloudflare.sh into wrangler.jsonc.
// Usage: DATABASE_ID=… ACCESS_TEAM_DOMAIN=… [ACCESS_AUD=…] node scripts/write-wrangler-config.mjs wrangler.jsonc
// ACCESS_AUD is optional: it only exists once Access is turned on, after the first deploy.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] ?? "wrangler.jsonc";
const { DATABASE_ID, ACCESS_TEAM_DOMAIN, ACCESS_AUD } = process.env;
for (const [name, value] of Object.entries({ DATABASE_ID, ACCESS_TEAM_DOMAIN })) {
  if (!value) throw new Error(`${name} is required`);
}

let config = readFileSync(path, "utf8");

/** Replaces the string value of `"key": "…"`, failing loudly if the key is missing. */
function setString(key, value) {
  const pattern = new RegExp(`("${key}":\\s*)"[^"]*"`);
  if (!pattern.test(config)) throw new Error(`${key} not found in ${path}`);
  config = config.replace(pattern, `$1${JSON.stringify(value)}`);
}

setString("database_id", DATABASE_ID);
setString("ACCESS_TEAM_DOMAIN", ACCESS_TEAM_DOMAIN);
if (ACCESS_AUD) setString("ACCESS_AUD", ACCESS_AUD);

writeFileSync(path, config);
