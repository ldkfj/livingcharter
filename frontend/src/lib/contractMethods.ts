export type LivingCharterContract = "charter" | "treasury";
export type ContractMethodKind = "view" | "write";

export interface FrontendContractCall {
  methodName: string;
  argCount: number;
  kind: ContractMethodKind;
}

/**
 * Single source of truth for every Intelligent Contract method called by the
 * frontend. The schema-conformance test checks this registry against the
 * checked-in public method list derived from contracts/*.py.
 */
export const FRONTEND_CONTRACT_CALLS = {
  charter: {
    getCharterBundle: {
      methodName: "get_charter_bundle",
      argCount: 0,
      kind: "view",
    },
    getArticle: {
      methodName: "get_article",
      argCount: 1,
      kind: "view",
    },
    getAmendment: {
      methodName: "get_amendment",
      argCount: 1,
      kind: "view",
    },
    getMember: {
      methodName: "get_member",
      argCount: 1,
      kind: "view",
    },
    getCounts: {
      methodName: "get_counts",
      argCount: 0,
      kind: "view",
    },
    proposeAmendment: {
      methodName: "propose_amendment",
      argCount: 5,
      kind: "write",
    },
    vote: {
      methodName: "vote",
      argCount: 2,
      kind: "write",
    },
    finalizeAmendment: {
      methodName: "finalize_amendment",
      argCount: 1,
      kind: "write",
    },
    cancelAmendment: {
      methodName: "cancel_amendment",
      argCount: 1,
      kind: "write",
    },
  },
  treasury: {
    getTreasuryState: {
      methodName: "get_treasury_state",
      argCount: 0,
      kind: "view",
    },
    getRequestCount: {
      methodName: "get_request_count",
      argCount: 0,
      kind: "view",
    },
    getRequest: {
      methodName: "get_request",
      argCount: 1,
      kind: "view",
    },
    getPrecedentCount: {
      methodName: "get_precedent_count",
      argCount: 0,
      kind: "view",
    },
    getPrecedents: {
      methodName: "get_precedents",
      argCount: 2,
      kind: "view",
    },
    fund: {
      methodName: "fund",
      argCount: 0,
      kind: "write",
    },
    submitRequest: {
      methodName: "submit_request",
      argCount: 5,
      kind: "write",
    },
    adjudicateRequest: {
      methodName: "adjudicate_request",
      argCount: 1,
      kind: "write",
    },
    appealRuling: {
      methodName: "appeal_ruling",
      argCount: 2,
      kind: "write",
    },
    executePayout: {
      methodName: "execute_payout",
      argCount: 1,
      kind: "write",
    },
  },
} as const satisfies Record<
  LivingCharterContract,
  Record<string, FrontendContractCall>
>;
