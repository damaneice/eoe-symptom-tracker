import { describe, expect, it } from "vitest";
import { accessToken, api } from "./test/client";

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
