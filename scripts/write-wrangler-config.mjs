// Writes the deploy values captured by setup-cloudflare.sh into wrangler.jsonc.
// Usage: APP_HOSTNAME=… DATABASE_ID=… ACCESS_TEAM_DOMAIN=… ACCESS_AUD=… node scripts/write-wrangler-config.mjs wrangler.jsonc
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] ?? "wrangler.jsonc";
const { APP_HOSTNAME, DATABASE_ID, ACCESS_TEAM_DOMAIN, ACCESS_AUD } = process.env;
for (const [name, value] of Object.entries({
  APP_HOSTNAME,
  DATABASE_ID,
  ACCESS_TEAM_DOMAIN,
  ACCESS_AUD,
})) {
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
setString("ACCESS_AUD", ACCESS_AUD);

if (/"routes":/.test(config)) {
  setString("pattern", APP_HOSTNAME);
} else {
  config = config.replace(
    /(\n\s*)"assets":/,
    `$1// The app's address. Cloudflare creates its DNS record and certificate.$1"routes": [{ "pattern": ${JSON.stringify(APP_HOSTNAME)}, "custom_domain": true }],$1"assets":`,
  );
}

writeFileSync(path, config);
