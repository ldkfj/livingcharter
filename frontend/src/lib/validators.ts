import {
  AmendmentInfo,
  CharterArticle,
  CharterArticleInfo,
  CharterBundle,
  CharterCounts,
  CharterMember,
  PrecedentInfo,
  RequestInfo,
  RulingInfo,
  TreasuryState,
} from "../types/contract";

type UnknownRecord = Record<string, unknown>;

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function shapeError(view: string, detail: string): never {
  throw new Error(`Data-shape error: ${view} ${detail}`);
}

function expectRecord(value: unknown, view: string, path = "result"): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    shapeError(view, `${path} must be an object.`);
  }
  return value as UnknownRecord;
}

function expectField(record: UnknownRecord, key: string, view: string, path = "result"): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    shapeError(view, `${path}.${key} is missing.`);
  }
  return record[key];
}

function expectString(value: unknown, view: string, path: string): string {
  if (typeof value !== "string") {
    shapeError(view, `${path} must be a string.`);
  }
  return value;
}

function expectAddress(value: unknown, view: string, path: string): string {
  const address = expectString(value, view, path);
  if (!ADDRESS_REGEX.test(address)) {
    shapeError(view, `${path} must be a 0x-prefixed 40-character address.`);
  }
  return address;
}

function expectBoolean(value: unknown, view: string, path: string): boolean {
  if (typeof value !== "boolean") {
    shapeError(view, `${path} must be a boolean.`);
  }
  return value;
}

function expectInteger(
  value: unknown,
  view: string,
  path: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    shapeError(view, `${path} must be an integer in [${minimum}, ${maximum}].`);
  }
  return value;
}

function expectWei(value: unknown, view: string, path: string): bigint {
  if (typeof value !== "bigint" || value < 0n) {
    shapeError(view, `${path} must be a non-negative bigint.`);
  }
  return value;
}

function expectArray(value: unknown, view: string, path: string): unknown[] {
  if (!Array.isArray(value)) {
    shapeError(view, `${path} must be an array.`);
  }
  return value;
}

function expectStringArray(value: unknown, view: string, path: string): string[] {
  return expectArray(value, view, path).map((item, index) =>
    expectString(item, view, `${path}[${index}]`),
  );
}

function expectIntegerArray(value: unknown, view: string, path: string): number[] {
  return expectArray(value, view, path).map((item, index) =>
    expectInteger(item, view, `${path}[${index}]`),
  );
}

function validateBundleArticle(value: unknown, index: number): CharterArticle {
  const view = "get_charter_bundle";
  const path = `result.articles[${index}]`;
  const article = expectRecord(value, view, path);
  return {
    id: expectInteger(expectField(article, "id", view, path), view, `${path}.id`),
    version: expectInteger(
      expectField(article, "version", view, path),
      view,
      `${path}.version`,
    ),
    text: expectString(expectField(article, "text", view, path), view, `${path}.text`),
  };
}

export function validateCharterBundle(value: unknown): CharterBundle {
  const view = "get_charter_bundle";
  const result = expectRecord(value, view);
  const articles = expectArray(expectField(result, "articles", view), view, "result.articles");
  return {
    charter_version: expectInteger(
      expectField(result, "charter_version", view),
      view,
      "result.charter_version",
    ),
    articles: articles.map(validateBundleArticle),
  };
}

export function validateArticle(value: unknown): CharterArticleInfo {
  const view = "get_article";
  const result = expectRecord(value, view);
  return {
    id: expectInteger(expectField(result, "id", view), view, "result.id"),
    text: expectString(expectField(result, "text", view), view, "result.text"),
    status: expectInteger(expectField(result, "status", view), view, "result.status", 0, 2),
    version: expectInteger(expectField(result, "version", view), view, "result.version"),
    updated_by_amendment: expectInteger(
      expectField(result, "updated_by_amendment", view),
      view,
      "result.updated_by_amendment",
    ),
    updated_at: expectInteger(
      expectField(result, "updated_at", view),
      view,
      "result.updated_at",
    ),
  };
}

export function validateAmendment(value: unknown): AmendmentInfo {
  const view = "get_amendment";
  const result = expectRecord(value, view);
  return {
    id: expectInteger(expectField(result, "id", view), view, "result.id"),
    kind: expectInteger(expectField(result, "kind", view), view, "result.kind", 0, 4),
    target_article_id: expectInteger(
      expectField(result, "target_article_id", view),
      view,
      "result.target_article_id",
    ),
    new_text: expectString(expectField(result, "new_text", view), view, "result.new_text"),
    target_member: expectString(
      expectField(result, "target_member", view),
      view,
      "result.target_member",
    ),
    proposer: expectAddress(expectField(result, "proposer", view), view, "result.proposer"),
    rationale: expectString(
      expectField(result, "rationale", view),
      view,
      "result.rationale",
    ),
    state: expectInteger(expectField(result, "state", view), view, "result.state", 0, 8),
    state_name: expectString(
      expectField(result, "state_name", view),
      view,
      "result.state_name",
    ),
    yes: expectInteger(expectField(result, "yes", view), view, "result.yes"),
    no: expectInteger(expectField(result, "no", view), view, "result.no"),
    deadline: expectInteger(
      expectField(result, "deadline", view),
      view,
      "result.deadline",
    ),
    created_at: expectInteger(
      expectField(result, "created_at", view),
      view,
      "result.created_at",
    ),
  };
}

export function validateMember(value: unknown): CharterMember {
  const view = "get_member";
  const result = expectRecord(value, view);
  const active = expectBoolean(expectField(result, "active", view), view, "result.active");
  if (!active) {
    return { active: false };
  }
  return {
    active: true,
    joined_at: expectInteger(
      expectField(result, "joined_at", view),
      view,
      "result.joined_at",
    ),
  };
}

export function validateCharterCounts(value: unknown): CharterCounts {
  const view = "get_counts";
  const result = expectRecord(value, view);
  return {
    members: expectInteger(expectField(result, "members", view), view, "result.members"),
    articles: expectInteger(expectField(result, "articles", view), view, "result.articles"),
    amendments: expectInteger(
      expectField(result, "amendments", view),
      view,
      "result.amendments",
    ),
    charter_version: expectInteger(
      expectField(result, "charter_version", view),
      view,
      "result.charter_version",
    ),
  };
}

function validateRuling(value: unknown, path: string): RulingInfo {
  const view = "get_request";
  const ruling = expectRecord(value, view, path);
  return {
    decision: expectInteger(
      expectField(ruling, "decision", view, path),
      view,
      `${path}.decision`,
      0,
      3,
    ),
    decision_name: expectString(
      expectField(ruling, "decision_name", view, path),
      view,
      `${path}.decision_name`,
    ),
    approved_amount_wei: expectWei(
      expectField(ruling, "approved_amount_wei", view, path),
      view,
      `${path}.approved_amount_wei`,
    ),
    cited_article_ids: expectIntegerArray(
      expectField(ruling, "cited_article_ids", view, path),
      view,
      `${path}.cited_article_ids`,
    ),
    charter_version: expectInteger(
      expectField(ruling, "charter_version", view, path),
      view,
      `${path}.charter_version`,
    ),
    reason: expectString(
      expectField(ruling, "reason", view, path),
      view,
      `${path}.reason`,
    ),
    precedent_seq: expectInteger(
      expectField(ruling, "precedent_seq", view, path),
      view,
      `${path}.precedent_seq`,
    ),
  };
}

function validateNullableRuling(value: unknown, path: string): RulingInfo | null {
  return value === null ? null : validateRuling(value, path);
}

export function validateRequest(value: unknown): RequestInfo {
  const view = "get_request";
  const result = expectRecord(value, view);
  return {
    id: expectInteger(expectField(result, "id", view), view, "result.id"),
    requester: expectAddress(
      expectField(result, "requester", view),
      view,
      "result.requester",
    ),
    amount_wei: expectWei(expectField(result, "amount_wei", view), view, "result.amount_wei"),
    purpose: expectString(expectField(result, "purpose", view), view, "result.purpose"),
    evidence_urls: expectStringArray(
      expectField(result, "evidence_urls", view),
      view,
      "result.evidence_urls",
    ),
    state: expectInteger(expectField(result, "state", view), view, "result.state", 0, 8),
    state_name: expectString(
      expectField(result, "state_name", view),
      view,
      "result.state_name",
    ),
    created_at: expectInteger(
      expectField(result, "created_at", view),
      view,
      "result.created_at",
    ),
    ruled_at: expectInteger(
      expectField(result, "ruled_at", view),
      view,
      "result.ruled_at",
    ),
    appeal_deadline: expectInteger(
      expectField(result, "appeal_deadline", view),
      view,
      "result.appeal_deadline",
    ),
    retries: expectInteger(expectField(result, "retries", view), view, "result.retries"),
    appealed: expectBoolean(expectField(result, "appealed", view), view, "result.appealed"),
    appellant: expectAddress(
      expectField(result, "appellant", view),
      view,
      "result.appellant",
    ),
    appeal_argument: expectString(
      expectField(result, "appeal_argument", view),
      view,
      "result.appeal_argument",
    ),
    paid: expectBoolean(expectField(result, "paid", view), view, "result.paid"),
    initial_ruling: validateNullableRuling(
      expectField(result, "initial_ruling", view),
      "result.initial_ruling",
    ),
    appeal_ruling: validateNullableRuling(
      expectField(result, "appeal_ruling", view),
      "result.appeal_ruling",
    ),
  };
}

export function validatePrecedentsPage(value: unknown): PrecedentInfo[] {
  const view = "get_precedents";
  return expectArray(value, view, "result").map((item, index) => {
    const path = `result[${index}]`;
    const precedent = expectRecord(item, view, path);
    return {
      seq: expectInteger(
        expectField(precedent, "seq", view, path),
        view,
        `${path}.seq`,
      ),
      request_id: expectInteger(
        expectField(precedent, "request_id", view, path),
        view,
        `${path}.request_id`,
      ),
      decision: expectInteger(
        expectField(precedent, "decision", view, path),
        view,
        `${path}.decision`,
        0,
        3,
      ),
      decision_name: expectString(
        expectField(precedent, "decision_name", view, path),
        view,
        `${path}.decision_name`,
      ),
      requested_wei: expectWei(
        expectField(precedent, "requested_wei", view, path),
        view,
        `${path}.requested_wei`,
      ),
      approved_wei: expectWei(
        expectField(precedent, "approved_wei", view, path),
        view,
        `${path}.approved_wei`,
      ),
      cited_article_ids: expectIntegerArray(
        expectField(precedent, "cited_article_ids", view, path),
        view,
        `${path}.cited_article_ids`,
      ),
      charter_version: expectInteger(
        expectField(precedent, "charter_version", view, path),
        view,
        `${path}.charter_version`,
      ),
      summary: expectString(
        expectField(precedent, "summary", view, path),
        view,
        `${path}.summary`,
      ),
      created_at: expectInteger(
        expectField(precedent, "created_at", view, path),
        view,
        `${path}.created_at`,
      ),
      is_appeal: expectBoolean(
        expectField(precedent, "is_appeal", view, path),
        view,
        `${path}.is_appeal`,
      ),
    };
  });
}

export function validateTreasuryState(value: unknown): TreasuryState {
  const view = "get_treasury_state";
  const result = expectRecord(value, view);
  return {
    balance_wei: expectWei(
      expectField(result, "balance_wei", view),
      view,
      "result.balance_wei",
    ),
    charter_address: expectAddress(
      expectField(result, "charter_address", view),
      view,
      "result.charter_address",
    ),
    appeal_window_seconds: expectInteger(
      expectField(result, "appeal_window_seconds", view),
      view,
      "result.appeal_window_seconds",
    ),
    member_cooldown_seconds: expectInteger(
      expectField(result, "member_cooldown_seconds", view),
      view,
      "result.member_cooldown_seconds",
    ),
    request_count: expectInteger(
      expectField(result, "request_count", view),
      view,
      "result.request_count",
    ),
    precedent_count: expectInteger(
      expectField(result, "precedent_count", view),
      view,
      "result.precedent_count",
    ),
  };
}

export function validateScalarCount(value: unknown, view: string): number {
  return expectInteger(value, view, "result");
}


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

export function validateFundAmount(genStr: string): string | null {
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

export function validateRequestAmount(
  genStr: string,
  treasuryBalanceWei: bigint,
): string | null {
  try {
    const wei = parseGenToWei(genStr);
    if (wei <= 0n || wei > treasuryBalanceWei) {
      return "E_INVALID_AMOUNT: Request amount must be greater than 0 and no more than the current Treasury balance.";
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
