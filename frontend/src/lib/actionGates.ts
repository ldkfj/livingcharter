import type { AmendmentInfo, RequestInfo } from "../types/contract";

const AMENDMENT_PROPOSED = 0;
const AMENDMENT_VOTING = 1;
const REQUEST_RULED = 1;
const REQUEST_FINAL_RULED = 3;

export interface AmendmentActionGates {
  canVote: boolean;
  canFinalize: boolean;
  canCancel: boolean;
}

export function getAmendmentActionGates(
  amendment: Pick<AmendmentInfo, "state" | "yes" | "no" | "deadline">,
  memberCount: number,
  nowSeconds: number,
  isProposer: boolean,
): AmendmentActionGates {
  const isProposed = amendment.state === AMENDMENT_PROPOSED;
  const isVoting = amendment.state === AMENDMENT_VOTING;
  const deadlinePassed = nowSeconds >= amendment.deadline;
  const strictMajority = amendment.yes > Math.floor(memberCount / 2);

  return {
    canVote: (isProposed || isVoting) && !deadlinePassed,
    canFinalize:
      (isProposed && deadlinePassed) ||
      (isVoting && (deadlinePassed || strictMajority)),
    canCancel:
      isProposer &&
      isProposed &&
      amendment.yes + amendment.no === 0,
  };
}

export interface PayoutAction {
  eligible: boolean;
  effectiveApprovedWei: bigint;
}

export function getPayoutAction(
  request: Pick<
    RequestInfo,
    | "state"
    | "paid"
    | "appeal_deadline"
    | "initial_ruling"
    | "appeal_ruling"
  >,
  nowSeconds: number,
): PayoutAction {
  const stateEligible =
    request.state === REQUEST_FINAL_RULED ||
    (request.state === REQUEST_RULED &&
      nowSeconds >= request.appeal_deadline);

  return {
    eligible: !request.paid && stateEligible,
    effectiveApprovedWei:
      request.appeal_ruling?.approved_amount_wei ??
      request.initial_ruling?.approved_amount_wei ??
      0n,
  };
}
