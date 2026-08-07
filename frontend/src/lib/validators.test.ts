import { describe, expect, it } from "vitest";
import { parseContractJson } from "./genlayerClient";
import {
  validateAmendment,
  validateArticle,
  validateCharterBundle,
  validateCharterCounts,
  validateMember,
  validatePrecedentsPage,
  validateRequest,
  validateScalarCount,
  validateTreasuryState,
} from "./validators";

const ADDRESS = "0x0D22C5298ad1437DB715A543B485588a8e0fc9DB";
const OTHER_ADDRESS = "0xB984B0a79B9BC17C332017B0640Dc82eE6151393";
const LARGE_WEI = 900719925474099312345n;

const validBundle = {
  charter_version: 1,
  articles: [{ id: 1, version: 1, text: "Founding article" }],
};

const validArticle = {
  id: 1,
  text: "Founding article",
  status: 0,
  version: 1,
  updated_by_amendment: 0,
  updated_at: 1_722_000_000,
};

const validAmendment = {
  id: 1,
  kind: 1,
  target_article_id: 1,
  new_text: "Replacement article text",
  target_member: "",
  proposer: ADDRESS,
  rationale: "Clarify the reimbursement rule.",
  state: 1,
  state_name: "VOTING",
  yes: 1,
  no: 0,
  deadline: 1_722_000_300,
  created_at: 1_722_000_000,
};

const validCounts = {
  members: 1,
  articles: 4,
  amendments: 0,
  charter_version: 1,
};

const validRuling = {
  decision: 2,
  decision_name: "PARTIAL",
  approved_amount_wei: LARGE_WEI,
  cited_article_ids: [1, 3],
  charter_version: 1,
  reason: "Only the documented portion is reimbursable.",
  precedent_seq: 1,
};

const validRequest = {
  id: 1,
  requester: ADDRESS,
  amount_wei: LARGE_WEI,
  purpose: "Attend a software development workshop.",
  evidence_urls: ["https://example.com/event"],
  state: 1,
  state_name: "RULED",
  created_at: 1_722_000_000,
  ruled_at: 1_722_000_100,
  appeal_deadline: 1_722_000_400,
  retries: 0,
  appealed: false,
  appellant: OTHER_ADDRESS,
  appeal_argument: "",
  paid: false,
  reserved_amount_wei: LARGE_WEI,
  reservation_active: true,
  initial_ruling: validRuling,
  appeal_ruling: null,
};

const validPrecedent = {
  seq: 1,
  request_id: 1,
  decision: 2,
  decision_name: "PARTIAL",
  requested_wei: LARGE_WEI,
  approved_wei: LARGE_WEI - 1n,
  cited_article_ids: [1, 3],
  charter_version: 1,
  summary: "Partially approved under Articles 1 and 3.",
  created_at: 1_722_000_100,
  is_appeal: false,
};

const validTreasuryState = {
  balance_wei: LARGE_WEI,
  reserved_wei: 1n,
  available_balance_wei: LARGE_WEI - 1n,
  charter_address: ADDRESS,
  appeal_window_seconds: 300,
  member_cooldown_seconds: 60,
  request_count: 1,
  precedent_count: 1,
};

function expectShapeError(action: () => unknown): void {
  expect(action).toThrow(/^Data-shape error:/);
}

describe("lossless contract JSON parsing", () => {
  it("preserves wei values above Number.MAX_SAFE_INTEGER as bigint", () => {
    const parsed = parseContractJson(
      `{"amount_wei":${LARGE_WEI},"id":1,"initial_ruling":{"approved_amount_wei":${LARGE_WEI}}}`,
    ) as {
      amount_wei: bigint;
      id: number;
      initial_ruling: { approved_amount_wei: bigint };
    };

    expect(parsed.amount_wei).toBe(LARGE_WEI);
    expect(parsed.initial_ruling.approved_amount_wei).toBe(LARGE_WEI);
    expect(parsed.id).toBe(1);
  });

  it("rejects unsafe non-wei integers", () => {
    expectShapeError(() => parseContractJson(`{"id":${LARGE_WEI}}`));
  });

  it("rejects malformed JSON instead of returning an unchecked string", () => {
    expect(() => parseContractJson('{"id":')).toThrow(SyntaxError);
  });
});

describe("validateCharterBundle", () => {
  it("accepts the contract bundle shape", () => {
    expect(validateCharterBundle(validBundle)).toEqual(validBundle);
  });

  it("rejects a missing key", () => {
    expectShapeError(() => validateCharterBundle({ charter_version: 1 }));
  });

  it("rejects a wrong field type", () => {
    expectShapeError(() =>
      validateCharterBundle({ ...validBundle, charter_version: "1" }),
    );
  });
});

describe("validateArticle", () => {
  it("accepts the full get_article shape", () => {
    expect(validateArticle(validArticle)).toEqual(validArticle);
  });

  it("rejects a missing key", () => {
    const { text: _text, ...missingText } = validArticle;
    expectShapeError(() => validateArticle(missingText));
  });

  it("rejects a wrong field type", () => {
    expectShapeError(() => validateArticle({ ...validArticle, updated_at: "now" }));
  });

  it("rejects an out-of-range article status", () => {
    expectShapeError(() => validateArticle({ ...validArticle, status: 3 }));
  });
});

describe("validateAmendment", () => {
  it("accepts the exact charter amendment shape", () => {
    expect(validateAmendment(validAmendment)).toEqual(validAmendment);
  });

  it("rejects a missing key", () => {
    const { deadline: _deadline, ...missingDeadline } = validAmendment;
    expectShapeError(() => validateAmendment(missingDeadline));
  });

  it("rejects a wrong field type", () => {
    expectShapeError(() => validateAmendment({ ...validAmendment, yes: "1" }));
  });

  it("rejects out-of-range enums", () => {
    expectShapeError(() => validateAmendment({ ...validAmendment, kind: 5 }));
    expectShapeError(() => validateAmendment({ ...validAmendment, state: 9 }));
  });
});

describe("validateMember", () => {
  it("accepts active and inactive member shapes", () => {
    expect(validateMember({ active: true, joined_at: 1_722_000_000 })).toEqual({
      active: true,
      joined_at: 1_722_000_000,
    });
    expect(validateMember({ active: false })).toEqual({ active: false });
  });

  it("rejects a missing key", () => {
    expectShapeError(() => validateMember({ joined_at: 1_722_000_000 }));
  });

  it("rejects a wrong field type", () => {
    expectShapeError(() => validateMember({ active: "yes" }));
  });
});

describe("validateCharterCounts", () => {
  it("accepts non-negative integer counts", () => {
    expect(validateCharterCounts(validCounts)).toEqual(validCounts);
  });

  it("rejects a missing key", () => {
    const { amendments: _amendments, ...missingAmendments } = validCounts;
    expectShapeError(() => validateCharterCounts(missingAmendments));
  });

  it("rejects a wrong field type", () => {
    expectShapeError(() => validateCharterCounts({ ...validCounts, members: 1.5 }));
  });
});

describe("validateTreasuryState", () => {
  it("accepts bigint balance and configuration fields", () => {
    expect(validateTreasuryState(validTreasuryState)).toEqual(validTreasuryState);
  });

  it("rejects a missing key", () => {
    const { balance_wei: _balance, ...missingBalance } = validTreasuryState;
    expectShapeError(() => validateTreasuryState(missingBalance));
  });

  it("rejects a wrong wei type", () => {
    expectShapeError(() =>
      validateTreasuryState({ ...validTreasuryState, balance_wei: Number(LARGE_WEI) }),
    );
  });

  it("rejects inconsistent reservation accounting", () => {
    expectShapeError(() =>
      validateTreasuryState({ ...validTreasuryState, reserved_wei: LARGE_WEI + 1n }),
    );
    expectShapeError(() =>
      validateTreasuryState({ ...validTreasuryState, available_balance_wei: LARGE_WEI }),
    );
  });
});

describe("validateRequest", () => {
  it("accepts nested rulings and bigint amounts", () => {
    expect(validateRequest(validRequest)).toEqual(validRequest);
  });

  it("rejects a missing key", () => {
    const { purpose: _purpose, ...missingPurpose } = validRequest;
    expectShapeError(() => validateRequest(missingPurpose));
  });

  it("rejects a wrong field type", () => {
    expectShapeError(() => validateRequest({ ...validRequest, paid: "false" }));
  });

  it("rejects an out-of-range request state", () => {
    expectShapeError(() => validateRequest({ ...validRequest, state: 9 }));
  });

  it("rejects inconsistent per-request reservation fields", () => {
    expectShapeError(() =>
      validateRequest({ ...validRequest, reserved_amount_wei: 0n }),
    );
    expectShapeError(() =>
      validateRequest({
        ...validRequest,
        reservation_active: false,
        reserved_amount_wei: validRequest.amount_wei,
      }),
    );
  });

  it("rejects an out-of-range nested decision and non-bigint nested wei", () => {
    expectShapeError(() =>
      validateRequest({
        ...validRequest,
        initial_ruling: { ...validRuling, decision: 4 },
      }),
    );
    expectShapeError(() =>
      validateRequest({
        ...validRequest,
        initial_ruling: { ...validRuling, approved_amount_wei: "1" },
      }),
    );
  });
});

describe("validatePrecedentsPage", () => {
  it("accepts a precedent page with bigint amounts", () => {
    expect(validatePrecedentsPage([validPrecedent])).toEqual([validPrecedent]);
  });

  it("rejects a missing key", () => {
    const { summary: _summary, ...missingSummary } = validPrecedent;
    expectShapeError(() => validatePrecedentsPage([missingSummary]));
  });

  it("rejects a wrong field type", () => {
    expectShapeError(() =>
      validatePrecedentsPage([{ ...validPrecedent, is_appeal: "false" }]),
    );
  });

  it("rejects out-of-range decisions and non-bigint wei", () => {
    expectShapeError(() =>
      validatePrecedentsPage([{ ...validPrecedent, decision: 4 }]),
    );
    expectShapeError(() =>
      validatePrecedentsPage([{ ...validPrecedent, requested_wei: "1" }]),
    );
  });
});

describe("validateScalarCount", () => {
  it("accepts a non-negative integer count", () => {
    expect(validateScalarCount(3, "get_request_count")).toBe(3);
  });

  it("rejects wrong and out-of-range values", () => {
    expectShapeError(() => validateScalarCount("3", "get_request_count"));
    expectShapeError(() => validateScalarCount(-1, "get_precedent_count"));
  });
});
