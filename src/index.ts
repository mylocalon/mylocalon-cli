#!/usr/bin/env node
import { AuthError } from "./auth.js";
import { HELP, parse } from "./args.js";
import { http } from "./commands/http.js";
import { login } from "./commands/login.js";
import { status } from "./commands/status.js";
import { ConfigPermissionError, ConfigStore } from "./config.js";
import { DeviceFlowError } from "./device.js";
import { err, green, out, red } from "./ui.js";
import { VERSION } from "./version.js";

async function main(argv: string[]): Promise<number> {
  const cmd = parse(argv);
  const store = new ConfigStore();
  switch (cmd.name) {
    case "help":
      if (cmd.error) err(red(cmd.error) + "\n");
      out(HELP);
      return cmd.error ? 2 : 0;
    case "version":
      out(VERSION);
      return 0;
    case "login":
      return login(store, cmd);
    case "logout":
      store.clear();
      out(`${green("✓")} Logged out`);
      return 0;
    case "status":
      return status(store);
    case "http":
      return http(store, cmd);
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: Error) => {
    if (e instanceof AuthError || e instanceof ConfigPermissionError || e instanceof DeviceFlowError) err(`${red("✗")} ${e.message}`);
    else err(`${red("✗")} unexpected error: ${e.stack ?? e.message}`);
    process.exit(1);
  },
);
