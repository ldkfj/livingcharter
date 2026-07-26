import { describe, expect, it } from "vitest";
import {
  parseGenToWei,
  validateGenAmount,
  validatePurpose,
  validateEvidenceUrls,
  validateAppealArgument,
  validateRationale,
  validateNewText,
  validateAddressHex,
} from "../lib/validators";
import { formatWeiToGen } from "../lib/formatters";

describe("parseGenToWei and formatWeiToGen round-trip", () => {
  it("converts whole GEN amounts accurately", () => {
    expect(parseGenToWei("1")).toBe(10n ** 18n);
    expect(parseGenToWei("10")).toBe(10n * 10n ** 18n);
    expect(formatWeiToGen(10n ** 18n)).toBe("1.000000");
  });

  it("converts fractional GEN amounts accurately", () => {
    expect(parseGenToWei("0.1")).toBe(100000000000000000n);
    expect(parseGenToWei("0.05")).toBe(50000000000000000n);
    expect(formatWeiToGen(100000000000000000n)).toBe("0.100000");
    expect(formatWeiToGen(50000000000000000n)).toBe("0.050000");
  });

  it("round-trips decimal GEN strings without float rounding loss", () => {
    const input = "1.500000";
    const wei = parseGenToWei(input);
    expect(formatWeiToGen(wei)).toBe(input);
  });

  it("rejects invalid amount strings and >18 decimals", () => {
    expect(() => parseGenToWei("-1")).toThrow();
    expect(() => parseGenToWei("abc")).toThrow();
    expect(() => parseGenToWei("0.1234567890123456789")).toThrow("more than 18 decimal places");
  });
});

describe("validateGenAmount", () => {
  it("accepts positive GEN amounts", () => {
    expect(validateGenAmount("0.1")).toBeNull();
    expect(validateGenAmount("1.5")).toBeNull();
  });

  it("rejects zero or negative amounts with E_INVALID_AMOUNT", () => {
    expect(validateGenAmount("0")).toContain("E_INVALID_AMOUNT");
    expect(validateGenAmount("invalid")).toContain("E_INVALID_AMOUNT");
  });
});

describe("validatePurpose", () => {
  it("accepts purpose statements between 10 and 600 chars", () => {
    expect(validatePurpose("Reimbursement for conference workshop ticket.")).toBeNull();
  });

  it("rejects short or long purpose statements", () => {
    expect(validatePurpose("Too short")).toContain("E_PURPOSE_TOO_SHORT");
    expect(validatePurpose("a".repeat(601))).toContain("E_PURPOSE_TOO_LONG");
  });
});

describe("validateEvidenceUrls", () => {
  it("accepts 1 to 3 valid http/https URLs", () => {
    expect(validateEvidenceUrls(["https://example.com/event"])).toBeNull();
    expect(
      validateEvidenceUrls([
        "https://example.com/event",
        "http://vendor.org/product",
      ])
    ).toBeNull();
  });

  it("rejects 0 or >3 URLs", () => {
    expect(validateEvidenceUrls([])).toContain("E_INVALID_EVIDENCE_COUNT");
    expect(
      validateEvidenceUrls([
        "https://1.com",
        "https://2.com",
        "https://3.com",
        "https://4.com",
      ])
    ).toContain("E_INVALID_EVIDENCE_COUNT");
  });

  it("rejects non-http schemes, long URLs, and embedded user credentials", () => {
    expect(validateEvidenceUrls(["ftp://example.com/file"])).toContain("E_INVALID_URL_SCHEME");
    expect(validateEvidenceUrls(["https://admin:pass@example.com/file"])).toContain("E_INVALID_URL_CREDENTIALS");
    expect(validateEvidenceUrls(["https://" + "a".repeat(300) + ".com"])).toContain("E_URL_TOO_LONG");
  });
});

describe("validateAppealArgument", () => {
  it("accepts argument between 20 and 1000 chars", () => {
    expect(validateAppealArgument("The initial ruling misapplied Article 2 regarding hardware caps.")).toBeNull();
  });

  it("rejects short or long arguments", () => {
    expect(validateAppealArgument("Too short")).toContain("E_APPEAL_ARGUMENT_TOO_SHORT");
    expect(validateAppealArgument("a".repeat(1001))).toContain("E_APPEAL_ARGUMENT_TOO_LONG");
  });
});

describe("validateRationale", () => {
  it("accepts rationale up to 500 chars", () => {
    expect(validateRationale("Clarify workshop reimbursement eligibility.")).toBeNull();
  });

  it("rejects empty or >500 char rationale", () => {
    expect(validateRationale("")).toContain("E_RATIONALE_REQUIRED");
    expect(validateRationale("a".repeat(501))).toContain("E_RATIONALE_TOO_LONG");
  });
});

describe("validateNewText", () => {
  it("accepts article text between 20 and 2000 chars", () => {
    expect(validateNewText("New ratified article text for LivingCharter.")).toBeNull();
  });

  it("rejects text outside 20–2000 range", () => {
    expect(validateNewText("Too short")).toContain("E_INVALID_ARTICLE_LENGTH");
    expect(validateNewText("a".repeat(2001))).toContain("E_INVALID_ARTICLE_LENGTH");
  });
});

describe("validateAddressHex", () => {
  it("accepts 0x-prefixed 40-hex character EVM address", () => {
    expect(validateAddressHex("0x0D22C5298ad1437DB715A543B485588a8e0fc9DB")).toBeNull();
  });

  it("rejects invalid hex addresses", () => {
    expect(validateAddressHex("0xinvalid")).toContain("E_INVALID_MEMBER_ADDRESS");
    expect(validateAddressHex("12345")).toContain("E_INVALID_MEMBER_ADDRESS");
  });
});
