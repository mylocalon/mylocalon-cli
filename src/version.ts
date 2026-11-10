import { createRequire } from "node:module";

// Single source of truth: the published package.json (one level above dist/).
export const VERSION: string = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
