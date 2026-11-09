import type { Config } from "./config.js";
import { DEFAULTS } from "./config.js";

export class AuthError extends Error {
  override name = "AuthError";
  /** Tells the SDK not to keep reconnecting. */
  readonly fatal = true;
}

/** Decodes JWT claims without verifying (the Gateway verifies). */
export function jwtClaims(token: string): { exp?: number; sub?: string } | undefined {
  const part = token.split(".")[1];
  if (!part) return undefined;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Builds a tokenProvider for the SDK. With an API key, every call exchanges
 * it at POST /api/v1/tokens for a fresh short-lived JWT; with a pasted JWT it
 * returns that (failing early if it has expired).
 */
export function tokenProvider(cfg: Config, fetchFn: typeof fetch = fetch): () => Promise<string> {
  const envToken = process.env["MYLOCALON_TOKEN"];
  if (envToken) return async () => envToken;

  if (cfg.apiKey) {
    const url = new URL("/api/v1/tokens", cfg.platformUrl ?? DEFAULTS.platformUrl).toString();
    return async () => {
      let res: Response;
      try {
        res = await fetchFn(url, { method: "POST", headers: { authorization: `Bearer ${cfg.apiKey}` } });
      } catch (e) {
        throw new AuthError(`could not reach the platform at ${url}: ${(e as Error).message}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new AuthError("API key was rejected (revoked?). Run `mylocalon login` again.");
      }
      if (!res.ok) throw new AuthError(`token exchange failed: HTTP ${res.status}`);
      const body = (await res.json()) as { token?: string };
      if (!body.token) throw new AuthError("token exchange returned no token");
      return body.token;
    };
  }

  if (cfg.token) {
    const token = cfg.token;
    return async () => {
      const exp = jwtClaims(token)?.exp;
      if (exp && exp * 1000 < Date.now()) {
        throw new AuthError("your saved token has expired. Run `mylocalon login` again.");
      }
      return token;
    };
  }

  throw new AuthError("not logged in. Run `mylocalon login` first.");
}
