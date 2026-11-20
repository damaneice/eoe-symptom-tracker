import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "./index";
import { accessToken, api } from "./test/client";

/**
 * Calls the Worker as Cloudflare does when Access is turned on for the Worker itself: the
 * signed-in user arrives as `ctx.access`, with no token header on the request.
 */
async function viaWorkerAccess(
  method: string,
  path: string,
  identity: CloudflareAccessIdentity | undefined,
  body?: unknown,
): Promise<Response> {
  const ctx = {
    access: { aud: "worker-level-aud", getIdentity: async () => identity },
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const request = new Request(`https://eoe-symptom-tracker.example.workers.dev${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // A test request has no Cloudflare edge properties (colo, country, …); the Worker doesn't use them.
  return worker.fetch(request as Request<unknown, IncomingRequestCfProperties>, env, ctx);
}

describe("sign-in", () => {
  it("lets a request with a valid Access token through", async () => {
    expect((await api("GET", "/api/health")).status).toBe(200);
  });

  it("rejects a request with no Access token", async () => {
    const res = await api("GET", "/api/health", { token: null });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Not signed in" });
  });

  it("rejects tokens for another application, another team, or that have expired", async () => {
    for (const token of [
      await accessToken({ aud: "some-other-app" }),
      await accessToken({ iss: "https://other-team.cloudflareaccess.com" }),
      await accessToken({ expiresIn: "-1m" }),
      "not-a-jwt",
    ]) {
      expect((await api("GET", "/api/health", { token })).status).toBe(401);
    }
  });

  it("lets the dev email stand in for a token only on localhost", async () => {
    expect((await api("GET", "/api/health", { token: null, host: "localhost:5173" })).status).toBe(
      200,
    );
    expect((await api("GET", "/api/health", { token: null, host: "eoe.example.com" })).status).toBe(
      401,
    );
  });
});

describe("sign-in with Access turned on for the Worker", () => {
  it("accepts the user Cloudflare signed in, and saves their email as the author", async () => {
    const res = await viaWorkerAccess(
      "PATCH",
      "/api/logs/2026-11-20",
      { email: "parent@example.com" },
      {
        vomit: 1,
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ vomit: 1, updatedBy: "parent@example.com" });
  });

  it("rejects a signed-in identity with no email", async () => {
    expect((await viaWorkerAccess("GET", "/api/health", undefined)).status).toBe(401);
    expect((await viaWorkerAccess("GET", "/api/health", { name: "No email" })).status).toBe(401);
  });
});
