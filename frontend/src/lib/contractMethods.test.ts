import { describe, expect, it } from "vitest";
import {
  FRONTEND_CONTRACT_CALLS,
  type ContractMethodKind,
  type LivingCharterContract,
} from "./contractMethods";

interface PublicContractMethod {
  methodName: string;
  argCount: number;
  kind: ContractMethodKind;
}

/**
 * Checked-in schema inventory derived from every @gl.public.write(.payable)
 * and @gl.public.view method in contracts/charter.py and contracts/treasury.py.
 */
const CONTRACT_PUBLIC_METHODS: Record<
  LivingCharterContract,
  PublicContractMethod[]
> = {
  charter: [
    { methodName: "bootstrap", argCount: 1, kind: "write" },
    { methodName: "propose_amendment", argCount: 5, kind: "write" },
    { methodName: "vote", argCount: 2, kind: "write" },
    { methodName: "finalize_amendment", argCount: 1, kind: "write" },
    { methodName: "cancel_amendment", argCount: 1, kind: "write" },
    { methodName: "get_charter_bundle", argCount: 0, kind: "view" },
    { methodName: "get_article", argCount: 1, kind: "view" },
    { methodName: "get_amendment", argCount: 1, kind: "view" },
    { methodName: "get_member", argCount: 1, kind: "view" },
    { methodName: "get_counts", argCount: 0, kind: "view" },
  ],
  treasury: [
    { methodName: "fund", argCount: 0, kind: "write" },
    { methodName: "submit_request", argCount: 5, kind: "write" },
    { methodName: "adjudicate_request", argCount: 1, kind: "write" },
    { methodName: "appeal_ruling", argCount: 2, kind: "write" },
    { methodName: "execute_payout", argCount: 1, kind: "write" },
    { methodName: "get_request", argCount: 1, kind: "view" },
    { methodName: "get_request_count", argCount: 0, kind: "view" },
    { methodName: "get_precedents", argCount: 2, kind: "view" },
    { methodName: "get_precedent_count", argCount: 0, kind: "view" },
    { methodName: "get_treasury_state", argCount: 0, kind: "view" },
  ],
};

describe("frontend contract method schema conformance", () => {
  it.each(["charter", "treasury"] as const)(
    "matches every frontend %s call to a checked-in public method and arg count",
    (contract) => {
      const schema = CONTRACT_PUBLIC_METHODS[contract];
      const calls = Object.values(FRONTEND_CONTRACT_CALLS[contract]);

      for (const call of calls) {
        expect(schema).toContainEqual(call);
      }
    },
  );

  it("contains no duplicate public method declarations", () => {
    for (const methods of Object.values(CONTRACT_PUBLIC_METHODS)) {
      expect(new Set(methods.map((method) => method.methodName)).size).toBe(
        methods.length,
      );
    }
  });
});
