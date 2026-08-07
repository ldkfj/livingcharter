import { beforeEach, describe, expect, it, vi } from "vitest";
import { genlayerClient } from "../lib/genlayerClient";
import { contractService } from "./contractService";

const ADDRESS = "0x1111111111111111111111111111111111111111";

const readContractSpy = vi.spyOn(genlayerClient, "readContract");

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
  });

  it.each(malformedReadCases)(
    "surfaces a Data-shape error for malformed raw JSON from $name",
    async ({ invoke }) => {
      readContractSpy.mockResolvedValue("{}" as never);

      await expect(invoke()).rejects.toThrow("Data-shape error");
    },
  );

  it("returns the contract-reported balance losslessly without a second RPC read", async () => {
    readContractSpy.mockResolvedValue(
      JSON.stringify({
        balance_wei: "900719925474099312345",
        charter_address: ADDRESS,
        appeal_window_seconds: 300,
        member_cooldown_seconds: 60,
        request_count: 0,
        precedent_count: 0,
      }) as never,
    );

    await expect(contractService.getTreasuryState(ADDRESS)).resolves.toMatchObject({
      balance_wei: 900719925474099312345n,
    });
    expect(readContractSpy).toHaveBeenCalledTimes(1);
  });
});
