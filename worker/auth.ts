import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

/** Settings that aren't in wrangler.jsonc: both are only ever set locally or in tests. */
export interface AuthEnv {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  /** Access's public keys as JSON. Tests set this so the Worker doesn't fetch the real ones. */
  ACCESS_JWKS?: string;
  /** Stands in for a signed-in caregiver, but only on localhost. Set it in `.dev.vars`. */
  DEV_USER_EMAIL?: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

let remoteKeys: { teamDomain: string; getKey: JWTVerifyGetKey } | undefined;

function keysFor(env: AuthEnv): JWTVerifyGetKey {
  if (env.ACCESS_JWKS) return createLocalJWKSet(JSON.parse(env.ACCESS_JWKS));
  if (remoteKeys?.teamDomain !== env.ACCESS_TEAM_DOMAIN) {
    const url = new URL("/cdn-cgi/access/certs", env.ACCESS_TEAM_DOMAIN);
    remoteKeys = { teamDomain: env.ACCESS_TEAM_DOMAIN, getKey: createRemoteJWKSet(url) };
  }
  return remoteKeys.getKey;
}

/**
 * Returns the signed-in caregiver's email from the Cloudflare Access token, or null when the
 * request isn't signed in. Access already blocks other people; this stops anyone reaching the
 * Worker some other way.
 */
export async function signedInEmail(request: Request, env: AuthEnv): Promise<string | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");

  if (!token) {
    const host = new URL(request.url).hostname;
    if (env.DEV_USER_EMAIL && LOCAL_HOSTS.has(host)) return env.DEV_USER_EMAIL;
    console.warn("Sign-in rejected: no Access token (is Access turned on for this Worker?)");
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, keysFor(env), {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    });
    return typeof payload.email === "string" ? payload.email : null;
  } catch (error) {
    console.warn("Sign-in rejected:", describeRejection(token, error));
    return null;
  }
}

/**
 * Why a token was rejected, for the logs. Includes the token's issuer and audience, which
 * identify the Access team and application (they're not secret), so a wrong ACCESS_AUD or
 * ACCESS_TEAM_DOMAIN can be fixed from the logs. Never logs the token or the email.
 */
function describeRejection(token: string, error: unknown): Record<string, unknown> {
  const reason =
    error instanceof Error ? ((error as { code?: string }).code ?? error.message) : "unknown";
  try {
    const { iss, aud } = decodeJwt(token);
    return { reason, tokenIssuer: iss, tokenAudience: aud };
  } catch {
    return { reason: "malformed token" };
  }
}
