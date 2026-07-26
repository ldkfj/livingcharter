import { beforeEach, describe, expect, it, vi } from "vitest";
import { genlayerClient } from "../lib/genlayerClient";
import { contractService } from "./contractService";

const ADDRESS = "0x1111111111111111111111111111111111111111";

const readContractSpy = vi.spyOn(genlayerClient, "readContract");
const getBalanceSpy = vi.spyOn(genlayerClient, "getBalance");

const malformedReadCases: Array<{
  name: string;
  invoke: () => Promise<unknown>;
}> = [
  {
    name: "getCharterBundle",
    invoke: () => contractService.getCharterBundle(ADDRESS),
  },
  {
    name: "getArticle",
    invoke: () => contractService.getArticle(ADDRESS, 1),
  },
  {
    name: "getAmendment",
    invoke: () => contractService.getAmendment(ADDRESS, 1),
  },
  {
    name: "getMember",
    invoke: () => contractService.getMember(ADDRESS, ADDRESS),
  },
  {
    name: "getCharterCounts",
    invoke: () => contractService.getCharterCounts(ADDRESS),
  },
  {
    name: "getTreasuryState",
    invoke: () => contractService.getTreasuryState(ADDRESS),
  },
  {
    name: "getRequestCount",
    invoke: () => contractService.getRequestCount(ADDRESS),
  },
  {
    name: "getRequest",
    invoke: () => contractService.getRequest(ADDRESS, 1),
  },
  {
    name: "getPrecedentCount",
    invoke: () => contractService.getPrecedentCount(ADDRESS),
  },
  {
    name: "getPrecedents",
    invoke: () => contractService.getPrecedents(ADDRESS, 0, 10),
  },
];

describe("contractService validated read boundary", () => {
  beforeEach(() => {
    readContractSpy.mockReset();
    getBalanceSpy.mockReset();
  });

  it.each(malformedReadCases)(
    "surfaces a Data-shape error for malformed raw JSON from $name",
    async ({ invoke }) => {
      readContractSpy.mockResolvedValue("{}" as never);

      await expect(invoke()).rejects.toThrow("Data-shape error");
    },
  );

  it("propagates a balance read failure instead of synthesizing a zero balance", async () => {
    readContractSpy.mockResolvedValue(
      JSON.stringify({
        balance_wei: "1100000000000000000",
        charter_address: ADDRESS,
        appeal_window_seconds: 300,
        member_cooldown_seconds: 60,
        request_count: 0,
        precedent_count: 0,
      }) as never,
    );
    getBalanceSpy.mockRejectedValue(new Error("RPC balance unavailable"));

    await expect(contractService.getTreasuryState(ADDRESS)).rejects.toThrow(
      "RPC balance unavailable",
    );
  });
});
