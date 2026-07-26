/**
 * Client-side validation helpers for LivingCharter contract intake guards.
 * Mirrors contract guards in charter.py and treasury.py with E_* error code hints.
 */

export function parseGenToWei(genStr: string): bigint {
  if (!genStr || typeof genStr !== "string") {
    throw new Error("Invalid GEN amount string.");
  }
  const clean = genStr.trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error("GEN amount must be a valid positive decimal number.");
  }

  const parts = clean.split(".");
  const wholePart = parts[0] || "0";
  let fracPart = parts[1] || "";

  if (fracPart.length > 18) {
    throw new Error("GEN amount cannot have more than 18 decimal places.");
  }

  fracPart = fracPart.padEnd(18, "0");

  const wholeWei = BigInt(wholePart) * 10n ** 18n;
  const fracWei = BigInt(fracPart);

  return wholeWei + fracWei;
}

export function validateGenAmount(genStr: string): string | null {
  try {
    const wei = parseGenToWei(genStr);
    if (wei <= 0n) {
      return "E_INVALID_AMOUNT: Amount must be greater than 0 GEN.";
    }
    return null;
  } catch (err: any) {
    return `E_INVALID_AMOUNT: ${err?.message || "Invalid amount"}`;
  }
}

export function validatePurpose(purpose: string): string | null {
  if (!purpose || purpose.trim().length < 10) {
    return "E_PURPOSE_TOO_SHORT: Purpose statement must be at least 10 characters.";
  }
  if (purpose.length > 600) {
    return "E_PURPOSE_TOO_LONG: Purpose statement cannot exceed 600 characters.";
  }
  return null;
}

export function validateEvidenceUrls(urls: string[]): string | null {
  const activeUrls = urls.map((u) => u.trim()).filter((u) => u.length > 0);
  if (activeUrls.length < 1 || activeUrls.length > 3) {
    return "E_INVALID_EVIDENCE_COUNT: Must provide between 1 and 3 evidence URLs.";
  }

  for (const url of activeUrls) {
    if (url.length > 300) {
      return "E_URL_TOO_LONG: Evidence URL exceeds 300 characters limit.";
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return "E_INVALID_URL_SCHEME: Evidence URL must begin with http:// or https://.";
    }
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) {
        return "E_INVALID_URL_CREDENTIALS: URL must not contain embedded user credentials ('@' symbol in host).";
      }
    } catch {
      return "E_INVALID_URL_FORMAT: Evidence URL format is invalid.";
    }
  }

  return null;
}

export function validateAppealArgument(arg: string): string | null {
  if (!arg || arg.trim().length < 20) {
    return "E_APPEAL_ARGUMENT_TOO_SHORT: Appeal argument must be at least 20 characters.";
  }
  if (arg.length > 1000) {
    return "E_APPEAL_ARGUMENT_TOO_LONG: Appeal argument cannot exceed 1000 characters.";
  }
  return null;
}

export function validateRationale(rationale: string): string | null {
  if (!rationale || rationale.trim().length === 0) {
    return "E_RATIONALE_REQUIRED: Amendment rationale is required.";
  }
  if (rationale.length > 500) {
    return "E_RATIONALE_TOO_LONG: Rationale cannot exceed 500 characters.";
  }
  return null;
}

export function validateNewText(text: string): string | null {
  if (!text || text.trim().length < 20) {
    return "E_INVALID_ARTICLE_LENGTH: Article text must be at least 20 characters.";
  }
  if (text.length > 2000) {
    return "E_INVALID_ARTICLE_LENGTH: Article text cannot exceed 2000 characters.";
  }
  return null;
}

export function validateAddressHex(addr: string): string | null {
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr.trim())) {
    return "E_INVALID_MEMBER_ADDRESS: Must be a valid 0x-prefixed 40-character hex address.";
  }
  return null;
}
