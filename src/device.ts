import { spawn } from "node:child_process";

export interface DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  interval: number;
  expiresIn: number;
}

export class DeviceFlowError extends Error {
  override name = "DeviceFlowError";
}

/**
 * `mylocalon login` device flow against the Platform: start → user approves
 * in the browser → poll until an API key is issued.
 */
export async function deviceLogin(opts: {
  platformUrl: string;
  clientName: string;
  onCode: (s: DeviceStart) => void;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<string> {
  const f = opts.fetchFn ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const url = (p: string) => new URL(p, opts.platformUrl).toString();
  const post = async (p: string, body: unknown) => {
    try {
      return await f(url(p), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      throw new DeviceFlowError(`could not reach ${opts.platformUrl}: ${(e as Error).message}`);
    }
  };

  const res = await post("/api/v1/device/start", { clientName: opts.clientName });
  if (!res.ok) throw new DeviceFlowError(`login could not start: HTTP ${res.status}`);
  const start = (await res.json()) as DeviceStart;
  opts.onCode(start);

  const deadline = Date.now() + start.expiresIn * 1000;
  let interval = Math.max(1, start.interval) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval);
    const r = await post("/api/v1/device/poll", { deviceCode: start.deviceCode });
    if (r.status === 429) {
      interval += 1000; // slow down
      continue;
    }
    const body = (await r.json().catch(() => ({}))) as { status?: string; apiKey?: string; error?: { message?: string } };
    if (r.ok && body.status === "approved" && body.apiKey) return body.apiKey;
    if (r.ok && body.status === "pending") continue;
    throw new DeviceFlowError(body.error?.message ?? `login failed: HTTP ${r.status}`);
  }
  throw new DeviceFlowError("login timed out; run `mylocalon login` again");
}

/** Best-effort: open a URL in the default browser. */
export function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(cmd as string, args as string[], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    // printing the URL is enough
  }
}
