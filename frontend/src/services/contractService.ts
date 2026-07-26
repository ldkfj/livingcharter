import { readContractJson, genlayerClient } from "../lib/genlayerClient";
import {
  CharterBundle,
  CharterArticle,
  CharterCounts,
  CharterMember,
  TreasuryState,
  RequestInfo,
  PrecedentInfo,
  AmendmentInfo,
} from "../types/contract";

export const contractService = {
  // Charter View Calls
  async getCharterBundle(charterAddress: string): Promise<CharterBundle> {
    return readContractJson<CharterBundle>(charterAddress, "get_charter_bundle");
  },

  async getArticle(charterAddress: string, id: number): Promise<CharterArticle> {
    return readContractJson<CharterArticle>(charterAddress, "get_article", [id]);
  },

  async getAmendment(charterAddress: string, id: number): Promise<AmendmentInfo> {
    return readContractJson<AmendmentInfo>(charterAddress, "get_amendment", [id]);
  },

  async getMember(charterAddress: string, address: string): Promise<CharterMember> {
    return readContractJson<CharterMember>(charterAddress, "get_member", [address]);
  },

  async getCharterCounts(charterAddress: string): Promise<CharterCounts> {
    return readContractJson<CharterCounts>(charterAddress, "get_counts");
  },

  // Treasury View Calls
  async getTreasuryState(treasuryAddress: string): Promise<TreasuryState> {
    const state = await readContractJson<TreasuryState>(treasuryAddress, "get_treasury_state");
    try {
      const balance = await genlayerClient.getBalance({
        address: treasuryAddress as `0x${string}`,
      });
      state.balance_wei = balance.toString();
    } catch {
      state.balance_wei = state.balance_wei || "0";
    }
    return state;
  },

  async getRequestCount(treasuryAddress: string): Promise<number> {
    return readContractJson<number>(treasuryAddress, "get_request_count");
  },

  async getRequest(treasuryAddress: string, id: number): Promise<RequestInfo> {
    return readContractJson<RequestInfo>(treasuryAddress, "get_request", [id]);
  },

  async getPrecedentCount(treasuryAddress: string): Promise<number> {
    return readContractJson<number>(treasuryAddress, "get_precedent_count");
  },

  async getPrecedents(treasuryAddress: string, offset: number, limit: number): Promise<PrecedentInfo[]> {
    return readContractJson<PrecedentInfo[]>(treasuryAddress, "get_precedents", [offset, limit]);
  },
};
