/**
 * Formats a 10^18 scaled wei bigint to a GEN decimal string using only bigint arithmetic.
 */
export function formatWeiToGen(weiVal: bigint): string {
  const weiInGen = 10n ** 18n;
  const whole = weiVal / weiInGen;
  const remainder = weiVal % weiInGen;

  // Scale remainder (18 digits) down to 6 decimal digits
  const fracDigits = remainder / 10n ** 12n;
  const fracStr = fracDigits.toString().padStart(6, "0");

  return `${whole.toString()}.${fracStr}`;
}

/**
 * Truncates a hex address (e.g. 0x0D22C5298ad1437DB715A543B485588a8e0fc9DB -> 0x0D22...c9DB)
 */
export function truncateAddress(addr: string | undefined | null): string {
  if (!addr) return "";
  const clean = addr.trim();
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

/**
 * Formats Unix timestamp seconds into a readable UTC date string.
 */
export function formatTimestamp(sec: number | undefined | null): string {
  if (!sec || sec <= 0) return "N/A";
  const date = new Date(sec * 1000);
  return date.toUTCString().replace("GMT", "UTC");
}
