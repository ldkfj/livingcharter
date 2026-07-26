export interface EnvConfig {
  charterAddress: string;
  treasuryAddress: string;
}

export interface EnvError {
  variable: string;
  value: string | undefined;
  reason: string;
}

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const PLACEHOLDER_PATTERNS = ["1234567890", "placeholder", "<", ">"];
const ALL_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function validateAddress(varName: string, val: string | undefined): EnvError | null {
  if (!val || val.trim() === "") {
    return {
      variable: varName,
      value: val,
      reason: "Environment variable is missing or empty.",
    };
  }

  const cleanVal = val.trim();

  if (cleanVal === ALL_ZERO_ADDRESS) {
    return {
      variable: varName,
      value: cleanVal,
      reason: "All-zero address is not permitted.",
    };
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (cleanVal.toLowerCase().includes(pattern.toLowerCase())) {
      return {
        variable: varName,
        value: cleanVal,
        reason: `Value contains obvious placeholder pattern "${pattern}".`,
      };
    }
  }

  if (!ADDRESS_REGEX.test(cleanVal)) {
    return {
      variable: varName,
      value: cleanVal,
      reason: "Value is not a valid 0x-prefixed 40-character hex EVM/GenLayer address.",
    };
  }

  return null;
}

export function getEnvConfig(): { config: EnvConfig | null; errors: EnvError[] } {
  const rawCharter = import.meta.env.VITE_CHARTER_ADDRESS;
  const rawTreasury = import.meta.env.VITE_TREASURY_ADDRESS;

  const errors: EnvError[] = [];

  const charterErr = validateAddress("VITE_CHARTER_ADDRESS", rawCharter);
  if (charterErr) errors.push(charterErr);

  const treasuryErr = validateAddress("VITE_TREASURY_ADDRESS", rawTreasury);
  if (treasuryErr) errors.push(treasuryErr);

  if (errors.length > 0 || !rawCharter || !rawTreasury) {
    return { config: null, errors };
  }

  return {
    config: {
      charterAddress: rawCharter.trim(),
      treasuryAddress: rawTreasury.trim(),
    },
    errors: [],
  };
}
