import { describe, expect, it, vi } from "vitest";
import { deviceLogin, DeviceFlowError } from "../src/device.js";

const start = {
  deviceCode: "dc_xxxxxxxxxxxxxxxxxxxxxxxx",
  userCode: "BCDF-GHJK",
  verificationUri: "http://p/device",
  verificationUriComplete: "http://p/device?code=BCDF-GHJK",
  interval: 1,
  expiresIn: 600,
};

function fakeFetch(pollResponses: Response[]) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/device/start")) return new Response(JSON.stringify(start), { status: 201 });
    return pollResponses.shift() ?? new Response("{}", { status: 500 });
  });
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("deviceLogin", () => {
  it("polls until approved and returns the API key", async () => {
    const f = fakeFetch([json({ status: "pending" }), new Response("", { status: 429 }), json({ status: "approved", apiKey: "mlk_live_k" })]);
    const sleeps: number[] = [];
    const onCode = vi.fn();
    const key = await deviceLogin({
      platformUrl: "http://p",
      clientName: "test",
      onCode,
      fetchFn: f as unknown as typeof fetch,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(key).toBe("mlk_live_k");
    expect(onCode).toHaveBeenCalledWith(start);
    expect(sleeps).toEqual([1000, 1000, 2000]); // backs off after 429
    expect(f.mock.calls[1]?.[0]).toBe("http://p/api/v1/device/poll");
  });

  it("surfaces denial", async () => {
    const f = fakeFetch([json({ error: { code: "ACCESS_DENIED", message: "login was denied in the browser" } }, 403)]);
    await expect(
      deviceLogin({ platformUrl: "http://p", clientName: "t", onCode: () => {}, fetchFn: f as unknown as typeof fetch, sleep: async () => {} }),
    ).rejects.toThrow("denied");
  });

  it("platform unreachable → clear error", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      deviceLogin({ platformUrl: "http://p", clientName: "t", onCode: () => {}, fetchFn: f as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(DeviceFlowError);
  });
});
