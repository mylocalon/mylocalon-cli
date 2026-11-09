import { hostname } from "node:os";
import { jwtClaims } from "../auth.js";
import { DEFAULTS, redact, type ConfigStore } from "../config.js";
import { deviceLogin, openBrowser } from "../device.js";
import { bold, cyan, dim, green, out } from "../ui.js";

export interface LoginArgs {
  token?: string;
  apiKey?: string;
  platform?: string;
  gateway?: string;
  browser?: boolean;
}

/**
 * Default: browser device flow (PLATFORM.md §4) → API key saved locally.
 * `--api-key` stores an existing key; `--token` stores a raw Gateway JWT
 * (development without a Platform).
 */
export async function login(store: ConfigStore, a: LoginArgs, fetchFn: typeof fetch = fetch): Promise<number> {
  const cfg = store.load();
  if (a.platform) cfg.platformUrl = a.platform;
  if (a.gateway) cfg.gatewayUrl = a.gateway;
  const platformUrl = cfg.platformUrl ?? DEFAULTS.platformUrl;

  let { token, apiKey } = a;
  if (!token && !apiKey) {
    apiKey = await deviceLogin({
      platformUrl,
      clientName: `mylocalon CLI on ${hostname()}`,
      fetchFn,
      onCode: (s) => {
        out(`\n  Confirm this code in your browser:  ${bold(s.userCode)}\n`);
        out(`  ${cyan(s.verificationUriComplete)}`);
        out(dim("\n  Waiting for approval… (Ctrl+C to cancel)"));
        if (a.browser !== false) openBrowser(s.verificationUriComplete);
      },
    });
  }

  delete cfg.token;
  delete cfg.apiKey;
  if (apiKey) cfg.apiKey = apiKey;
  if (token) {
    if (!jwtClaims(token)?.sub) {
      out("That does not look like a mylocalon JWT.");
      return 1;
    }
    cfg.token = token;
  }
  store.save(cfg);

  out(`\n${green("✓")} Logged in ${dim(`(${apiKey ? "api key " + redact(apiKey) : "token " + redact(token)})`)}`);
  out(`  Saved to ${bold(store.path)} (mode 600)`);
  out(`  Platform: ${platformUrl}`);
  if (cfg.gatewayUrl) out(`  Gateway:  ${cfg.gatewayUrl}`);
  return 0;
}
