import { chmodSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigPermissionError, ConfigStore, redact } from "../src/config.js";

const fresh = () => new ConfigStore(join(mkdtempSync(join(tmpdir(), "ml-cli-")), ".mylocalon"));

describe("ConfigStore", () => {
  it("round-trips and writes mode 0600", () => {
    const s = fresh();
    expect(s.load()).toEqual({});
    s.save({ apiKey: "mlk_live_secret", gatewayUrl: "ws://localhost:7002/tunnel" });
    expect(statSync(s.path).mode & 0o777).toBe(0o600);
    expect(statSync(s.dir).mode & 0o777).toBe(0o700);
    expect(s.load()).toEqual({ apiKey: "mlk_live_secret", gatewayUrl: "ws://localhost:7002/tunnel" });
  });

  it.skipIf(process.platform === "win32")("refuses group/world-readable config", () => {
    const s = fresh();
    s.save({ token: "x" });
    chmodSync(s.path, 0o644);
    expect(() => s.load()).toThrow(ConfigPermissionError);
  });

  it("re-tightens perms on save", () => {
    const s = fresh();
    s.save({});
    chmodSync(s.path, 0o644);
    s.save({ token: "y" });
    expect(statSync(s.path).mode & 0o777).toBe(0o600);
  });
});

describe("redact", () => {
  it("never reveals the full secret", () => {
    const secret = "mlk_live_abcdefghijklmnopqrstuvwxyz";
    expect(redact(secret)).not.toContain("qrstuvwxyz");
    expect(redact(secret)).toMatch(/^mlk_live…/);
    expect(redact("short")).toBe("****");
    expect(redact(undefined)).toBe("(none)");
  });
});
