import { describe, expect, it } from "vitest";
import { parse, parseTarget } from "../src/args.js";

describe("parseTarget", () => {
  it.each([
    ["3000", "http://localhost:3000"],
    ["localhost:8080", "http://localhost:8080"],
    ["127.0.0.1:5173", "http://127.0.0.1:5173"],
    ["https://localhost:8443", "https://localhost:8443"],
    ["http://localhost:3000/", "http://localhost:3000"],
  ])("%s → %s", (a, b) => expect(parseTarget(a)).toBe(b));

  it.each(["0", "70000", "ftp://x", "nope"])("rejects %s", (a) => expect(() => parseTarget(a)).toThrow());
});

describe("parse", () => {
  it("http with flags", () => {
    expect(parse(["http", "3000", "--subdomain", "myapp", "--json"])).toEqual({
      name: "http", target: "http://localhost:3000", subdomain: "myapp", json: true,
    });
  });
  it("login flags", () => {
    expect(parse(["login", "--api-key", "mlk_live_x", "--platform", "http://localhost:3001"])).toEqual({
      name: "login", apiKey: "mlk_live_x", platform: "http://localhost:3001", browser: true,
    });
    expect(parse(["login", "--no-browser"])).toEqual({ name: "login", browser: false });
  });
  it("errors become help", () => {
    expect(parse(["http"])).toMatchObject({ name: "help", error: expect.any(String) });
    expect(parse(["frobnicate"])).toMatchObject({ name: "help", error: "unknown command: frobnicate" });
    expect(parse(["http", "3000", "--bogus"])).toMatchObject({ name: "help", error: expect.any(String) });
  });
  it("no args is help", () => expect(parse([])).toEqual({ name: "help" }));
});
