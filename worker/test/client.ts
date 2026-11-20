import { env, exports } from "cloudflare:workers";
import { importJWK, SignJWT } from "jose";

export const CAREGIVER = "parent@example.com";

/** Signs an Access token the way Cloudflare Access would. Override claims to test rejections. */
export async function accessToken(
  claims: { email?: string; aud?: string; iss?: string; expiresIn?: string } = {},
): Promise<string> {
  const jwk = JSON.parse(env.TEST_PRIVATE_JWK);
  const key = await importJWK(jwk, "RS256");
  return new SignJWT({ email: claims.email ?? CAREGIVER })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(claims.iss ?? env.ACCESS_TEAM_DOMAIN)
    .setAudience(claims.aud ?? env.ACCESS_AUD)
    .setIssuedAt()
    .setExpirationTime(claims.expiresIn ?? "1h")
    .sign(key);
}

/**
 * Sends a request to the Worker, signed in as `CAREGIVER` unless `token` is given or `null`.
 * `body` is sent as JSON.
 */
export async function api(
  method: string,
  path: string,
  options: { body?: unknown; token?: string | null; host?: string } = {},
): Promise<Response> {
  const headers = new Headers();
  const token = options.token === undefined ? await accessToken() : options.token;
  if (token !== null) headers.set("Cf-Access-Jwt-Assertion", token);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  return exports.default.fetch(
    new Request(`https://${options.host ?? "eoe.example.com"}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
}
