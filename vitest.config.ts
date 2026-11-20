import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { exportJWK, generateKeyPair } from "jose";
import { defineConfig } from "vitest/config";

// A throwaway signing key, so API tests can sign their own Access tokens. The Worker reads the
// public half from ACCESS_JWKS instead of fetching Access's real keys.
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const kid = "test-key";
const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256" };
const privateJwk = { ...(await exportJWK(privateKey)), kid, alg: "RS256" };

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: "domain", include: ["src/**/*.test.ts"] },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
                ACCESS_AUD: "test-aud",
                ACCESS_JWKS: JSON.stringify({ keys: [publicJwk] }),
                DEV_USER_EMAIL: "dev@example.com",
                TEST_PRIVATE_JWK: JSON.stringify(privateJwk),
                TEST_MIGRATIONS: await readD1Migrations("./migrations"),
              },
            },
          }),
        ],
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts"],
          setupFiles: ["./worker/test/setup.ts"],
        },
      },
    ],
  },
});
