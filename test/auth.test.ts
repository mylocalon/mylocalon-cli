import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError, jwtClaims, tokenProvider } from "../src/auth.js";

const jwt = (claims: object) =>
  `${Buffer.from('{"alg":"EdDSA"}').toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

afterEach(() => vi.unstubAllEnvs());

describe("tokenProvider", () => {
  it("exchanges an API key for a JWT at the platform", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ token: "jwt-from-platform" }), { status: 200 }));
    const p = tokenProvider({ apiKey: "mlk_live_k", platformUrl: "http://localhost:3001" }, fetchFn as typeof fetch);
    await expect(p()).resolves.toBe("jwt-from-platform");
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:3001/api/v1/tokens", {
      method: "POST",
      headers: { authorization: "Bearer mlk_live_k" },
    });
  });

  it("revoked key → AuthError asking to re-login", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 401 }));
    await expect(tokenProvider({ apiKey: "k" }, fetchFn as typeof fetch)()).rejects.toThrow(/login/);
  });

  it("expired pasted JWT is rejected locally", async () => {
    const tok = jwt({ sub: "u", exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(tokenProvider({ token: tok })()).rejects.toBeInstanceOf(AuthError);
  });

  it("valid pasted JWT is returned", async () => {
    const tok = jwt({ sub: "u", exp: Math.floor(Date.now() / 1000) + 600 });
    await expect(tokenProvider({ token: tok })()).resolves.toBe(tok);
  });

  it("MYLOCALON_TOKEN env wins", async () => {
    vi.stubEnv("MYLOCALON_TOKEN", "env-jwt");
    await expect(tokenProvider({ apiKey: "k" })()).resolves.toBe("env-jwt");
  });

  it("not logged in", () => {
    expect(() => tokenProvider({})).toThrow(/login/);
  });

  it("errors never contain the secret", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 500 }));
    const e = await tokenProvider({ apiKey: "mlk_live_supersecret" }, fetchFn as typeof fetch)().catch((x) => x);
    expect(String(e.message)).not.toContain("supersecret");
  });
});

describe("jwtClaims", () => {
  it("decodes payload", () => expect(jwtClaims(jwt({ sub: "usr_1" }))?.sub).toBe("usr_1"));
  it("garbage → undefined", () => expect(jwtClaims("nope")).toBeUndefined());
});
