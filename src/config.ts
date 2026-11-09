import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Persisted CLI config (~/.mylocalon/config.json, mode 0600 — SECURITY.md §2). */
export interface Config {
  /** Platform base URL for API key → JWT exchange. */
  platformUrl?: string;
  /** Gateway WSS endpoint. */
  gatewayUrl?: string;
  /** Long-lived API key (preferred). */
  apiKey?: string;
  /** A Gateway JWT pasted directly (dev, before the Platform exists). */
  token?: string;
}

export const DEFAULTS = {
  platformUrl: "https://mylocalon.com",
  gatewayUrl: "wss://gateway.mylocalon.com/tunnel",
} as const;

export class ConfigPermissionError extends Error {
  override name = "ConfigPermissionError";
}

export class ConfigStore {
  readonly dir: string;
  readonly path: string;

  constructor(dir = process.env["MYLOCALON_CONFIG_DIR"] ?? join(homedir(), ".mylocalon")) {
    this.dir = dir;
    this.path = join(dir, "config.json");
  }

  load(): Config {
    if (!existsSync(this.path)) return {};
    const mode = statSync(this.path).mode & 0o777;
    if (process.platform !== "win32" && (mode & 0o077) !== 0) {
      throw new ConfigPermissionError(
        `${this.path} has permissions ${mode.toString(8)}; it holds secrets and must be 600.\n  fix: chmod 600 ${this.path}`,
      );
    }
    return JSON.parse(readFileSync(this.path, "utf8")) as Config;
  }

  save(cfg: Config): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    writeFileSync(this.path, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
    chmodSync(this.path, 0o600); // writeFileSync's mode only applies on create
  }

  clear(): void {
    rmSync(this.path, { force: true });
  }
}

/** Show only a non-secret prefix of a credential. */
export function redact(secret: string | undefined): string {
  if (!secret) return "(none)";
  return secret.length <= 12 ? "****" : `${secret.slice(0, 8)}…(${secret.length} chars)`;
}
