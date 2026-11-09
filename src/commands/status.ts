import { jwtClaims } from "../auth.js";
import { DEFAULTS, redact, type ConfigStore } from "../config.js";
import { out } from "../ui.js";

export function status(store: ConfigStore): number {
  const cfg = store.load();
  out(`config:    ${store.path}`);
  out(`gateway:   ${cfg.gatewayUrl ?? DEFAULTS.gatewayUrl}`);
  out(`platform:  ${cfg.platformUrl ?? DEFAULTS.platformUrl}`);
  if (cfg.apiKey) out(`api key:   ${redact(cfg.apiKey)}`);
  if (cfg.token) {
    const c = jwtClaims(cfg.token);
    const exp = c?.exp ? new Date(c.exp * 1000) : undefined;
    out(`token:     ${redact(cfg.token)} user=${c?.sub ?? "?"} ${exp ? `expires ${exp.toISOString()}${exp < new Date() ? " (EXPIRED)" : ""}` : ""}`);
  }
  if (!cfg.apiKey && !cfg.token) out("auth:      not logged in");
  return 0;
}
