import { parseArgs } from "node:util";

export type Command =
  | { name: "http"; target: string; subdomain?: string; gateway?: string; json: boolean }
  | { name: "login"; token?: string; apiKey?: string; platform?: string; gateway?: string; browser: boolean }
  | { name: "logout" }
  | { name: "status" }
  | { name: "version" }
  | { name: "help"; error?: string };

/** `3000` → http://localhost:3000; `https://localhost:8443` passes through. */
export function parseTarget(arg: string): string {
  if (/^\d+$/.test(arg)) {
    const port = Number(arg);
    if (port < 1 || port > 65535) throw new Error(`invalid port ${arg}`);
    return `http://localhost:${port}`;
  }
  if (/^[\w.-]+:\d+$/.test(arg)) return `http://${arg}`;
  const u = new URL(arg);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("target must be http(s)");
  return u.origin;
}

export function parse(argv: string[]): Command {
  const [cmd, ...rest] = argv;
  try {
    switch (cmd) {
      case "http": {
        const { values, positionals } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: {
            subdomain: { type: "string", short: "s" },
            gateway: { type: "string" },
            json: { type: "boolean", default: false },
          },
        });
        if (positionals.length !== 1) return { name: "help", error: "usage: mylocalon http <port|url> [--subdomain name]" };
        return {
          name: "http",
          target: parseTarget(positionals[0]!),
          json: values.json ?? false,
          ...(values.subdomain ? { subdomain: values.subdomain } : {}),
          ...(values.gateway ? { gateway: values.gateway } : {}),
        };
      }
      case "login": {
        const { values } = parseArgs({
          args: rest,
          options: {
            token: { type: "string" },
            "api-key": { type: "string" },
            platform: { type: "string" },
            gateway: { type: "string" },
            "no-browser": { type: "boolean", default: false },
          },
        });
        return {
          name: "login",
          browser: !values["no-browser"],
          ...(values.token ? { token: values.token } : {}),
          ...(values["api-key"] ? { apiKey: values["api-key"] } : {}),
          ...(values.platform ? { platform: values.platform } : {}),
          ...(values.gateway ? { gateway: values.gateway } : {}),
        };
      }
      case "logout":
      case "status":
        return { name: cmd };
      case "version":
      case "--version":
      case "-v":
        return { name: "version" };
      case undefined:
      case "help":
      case "--help":
      case "-h":
        return { name: "help" };
      default:
        return { name: "help", error: `unknown command: ${cmd}` };
    }
  } catch (e) {
    return { name: "help", error: (e as Error).message };
  }
}

export const HELP = `mylocalon — expose a local app on a public URL

Usage:
  mylocalon http <port|url> [--subdomain <name>] [--gateway <wss-url>] [--json]
  mylocalon login [--platform <url>] [--gateway <wss-url>] [--no-browser]
  mylocalon login --api-key <key> | --token <jwt>
  mylocalon status
  mylocalon logout
  mylocalon version

Examples:
  mylocalon login                       # opens your browser to approve this device
  mylocalon http 3000
  mylocalon http https://localhost:8443 --subdomain myapp

Env:
  MYLOCALON_TOKEN       use this JWT instead of the saved credentials
  MYLOCALON_CONFIG_DIR  config directory (default ~/.mylocalon)
`;
