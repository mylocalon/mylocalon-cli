import { GatewayError, Tunnel, type RequestEvent } from "@mylocalon/sdk-node";
import { tokenProvider } from "../auth.js";
import { DEFAULTS, type ConfigStore } from "../config.js";
import { VERSION } from "../version.js";
import { bold, cyan, dim, err, green, out, red, statusColor, yellow } from "../ui.js";

export interface HttpArgs {
  target: string;
  subdomain?: string;
  gateway?: string;
  json: boolean;
}

const HINTS: Record<string, string> = {
  AUTH_FAILED: "Your token is invalid or expired — run `mylocalon login`.",
  AUTH_REVOKED: "Your credentials were revoked — run `mylocalon login`.",
  SUBDOMAIN_FORBIDDEN: "You don't own that subdomain. Reserve it in the dashboard first.",
  SUBDOMAIN_TAKEN: "That subdomain is already in use by another tunnel.",
  TUNNEL_LIMIT: "You've reached your concurrent tunnel limit. Close another tunnel first.",
  VERSION_UNSUPPORTED: "This CLI is too old for the gateway — please upgrade.",
};

export async function http(store: ConfigStore, a: HttpArgs): Promise<number> {
  const cfg = store.load();
  const gatewayUrl = a.gateway ?? cfg.gatewayUrl ?? DEFAULTS.gatewayUrl;
  const json = (o: object) => out(JSON.stringify({ ts: new Date().toISOString(), ...o }));

  const tunnel = new Tunnel({
    gatewayUrl,
    tokenProvider: tokenProvider(cfg),
    target: a.target,
    ...(a.subdomain ? { subdomain: a.subdomain } : {}),
    client: { name: "mylocalon-cli", version: VERSION },
  });

  tunnel.on("request", (e: RequestEvent) => {
    if (a.json) return json({ event: "request", ...e });
    const status = e.status !== undefined ? statusColor(e.status)(String(e.status)) : red(e.errorCode ?? "ERR");
    out(`${dim(new Date().toLocaleTimeString())}  ${e.method.padEnd(6)} ${e.path}  ${status}  ${dim(`${e.durationMs}ms`)}`);
  });
  tunnel.on("disconnected", () => (a.json ? json({ event: "disconnected" }) : out(yellow("● Connection lost — reconnecting…"))));
  tunnel.on("reconnecting", (n: number) => a.json && json({ event: "reconnecting", attempt: n }));
  tunnel.on("active", (info: { url: string }) => {
    if (tunnel.state === "ACTIVE" && firstUrl && info.url !== firstUrl) {
      a.json ? json({ event: "url_changed", url: info.url }) : out(yellow(`● Reconnected with a NEW url: ${bold(info.url)}`));
    } else if (firstUrl) {
      a.json ? json({ event: "reconnected", url: info.url }) : out(green("● Reconnected"));
    }
  });

  let firstUrl: string | undefined;
  try {
    const info = await tunnel.connect();
    firstUrl = info.url;
    if (a.json) {
      json({ event: "active", ...info, target: a.target });
    } else {
      out();
      out(`  ${green("●")} ${bold("mylocalon tunnel online")}`);
      out();
      out(`  Forwarding  ${cyan(bold(info.url))} ${dim("→")} ${a.target}`);
      out(`  Gateway     ${dim(gatewayUrl)}`);
      out();
      out(dim("  Ctrl+C to stop"));
      out();
    }
  } catch (e) {
    return fail(e as Error, a.json);
  }

  const closed = new Promise<number>((resolve) => {
    tunnel.on("closed", (evt: { reason: string; error?: Error }) => {
      if (evt.reason === "client_close") return resolve(0);
      resolve(evt.error ? fail(evt.error, a.json) : 1);
    });
  });

  let stopping = false;
  const stop = () => {
    if (stopping) process.exit(130); // second Ctrl+C: force quit
    stopping = true;
    if (!a.json) out(dim("\n  Closing tunnel…"));
    void tunnel.close();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return closed;
}

function fail(e: Error, json: boolean): number {
  const code = e instanceof GatewayError ? e.code : undefined;
  if (json) {
    out(JSON.stringify({ event: "error", code, message: e.message }));
  } else {
    err(`${red("✗")} ${e.message}`);
    if (code && HINTS[code]) err(`  ${HINTS[code]}`);
  }
  return 1;
}
