const tty = process.stdout.isTTY && !process.env["NO_COLOR"];
const c = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);

export const bold = c(1);
export const dim = c(2);
export const red = c(31);
export const green = c(32);
export const yellow = c(33);
export const cyan = c(36);

export function statusColor(status: number): (s: string) => string {
  if (status >= 500) return red;
  if (status >= 400) return yellow;
  return green;
}

export const out = (s = "") => process.stdout.write(s + "\n");
export const err = (s: string) => process.stderr.write(s + "\n");
