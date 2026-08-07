import { describe, expect, it } from "vitest";
import type { RequestInfo, RulingInfo } from "../types/contract";
import {
  getAmendmentActionGates,
  getPayoutAction,
} from "./actionGates";

const initialRuling: RulingInfo = {
  decision: 1,
  decision_name: "APPROVE",
  approved_amount_wei: 80n,
  cited_article_ids: [1],
  charter_version: 1,
  reason: "Approved under the active charter.",
  precedent_seq: 1,
};

function requestFixture(
  overrides: Partial<RequestInfo> = {},
): RequestInfo {
  return {
    id: 1,
    requester: "0x1111111111111111111111111111111111111111",
    amount_wei: 100n,
    purpose: "A sufficiently long request purpose.",
    evidence_urls: ["https://example.com"],
    state: 1,
    state_name: "RULED",
    created_at: 1,
    ruled_at: 2,
    appeal_deadline: 100,
    retries: 0,
    appealed: false,
    appellant: "",
    appeal_argument: "",
    paid: false,
    reserved_amount_wei: 100n,
    reservation_active: true,
    initial_ruling: initialRuling,
    appeal_ruling: null,
    ...overrides,
  };
}

describe("amendment action gates", () => {
  it("allows voting in PROPOSED and VOTING before the deadline", () => {
    expect(
      getAmendmentActionGates(
        { state: 0, yes: 0, no: 0, deadline: 100 },
        3,
        50,
        true,
      ),
    ).toEqual({ canVote: true, canFinalize: false, canCancel: true });

    expect(
      getAmendmentActionGates(
        { state: 1, yes: 1, no: 0, deadline: 100 },
        3,
        50,
        false,
      ).canVote,
    ).toBe(true);
  });

  it("finalizes VOTING on deadline or strict majority and PROPOSED only on deadline", () => {
    expect(
      getAmendmentActionGates(
        { state: 1, yes: 2, no: 0, deadline: 100 },
        3,
        50,
        false,
      ).canFinalize,
    ).toBe(true);
    expect(
      getAmendmentActionGates(
        { state: 1, yes: 1, no: 1, deadline: 100 },
        3,
        100,
        false,
      ).canFinalize,
    ).toBe(true);
    expect(
      getAmendmentActionGates(
        { state: 0, yes: 0, no: 0, deadline: 100 },
        3,
        99,
        false,
      ).canFinalize,
    ).toBe(false);
    expect(
      getAmendmentActionGates(
        { state: 0, yes: 0, no: 0, deadline: 100 },
        3,
        100,
        false,
      ).canFinalize,
    ).toBe(true);
  });
});

describe("payout action gate", () => {
  it("uses the initial ruling for FINAL_RULED when no appeal ruling exists", () => {
    expect(
      getPayoutAction(
        requestFixture({ state: 3, state_name: "FINAL_RULED" }),
        50,
      ),
    ).toEqual({ eligible: true, effectiveApprovedWei: 80n });
  });

  it("lets the appeal ruling override the initial ruling", () => {
    const appealRuling = {
      ...initialRuling,
      approved_amount_wei: 40n,
      precedent_seq: 2,
    };
    expect(
      getPayoutAction(
        requestFixture({
          state: 3,
          state_name: "FINAL_RULED",
          appeal_ruling: appealRuling,
        }),
        50,
      ),
    ).toEqual({ eligible: true, effectiveApprovedWei: 40n });
  });

  it("allows a zero-value ruling to close an eligible request", () => {
    expect(
      getPayoutAction(
        requestFixture({
          appeal_deadline: 100,
          initial_ruling: {
            ...initialRuling,
            decision: 3,
            decision_name: "DENY",
            approved_amount_wei: 0n,
          },
        }),
        100,
      ),
    ).toEqual({ eligible: true, effectiveApprovedWei: 0n });
  });

  it("blocks RULED payout before the appeal deadline and all paid requests", () => {
    expect(getPayoutAction(requestFixture(), 99).eligible).toBe(false);
    expect(
      getPayoutAction(
        requestFixture({
          state: 3,
          state_name: "FINAL_RULED",
          paid: true,
        }),
        1,
      ).eligible,
    ).toBe(false);
  });
});
