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
    const raw = await readContractJson<any>(charterAddress, "get_counts");
    if (
      !raw ||
      typeof raw.members !== "number" ||
      typeof raw.articles !== "number" ||
      typeof raw.amendments !== "number" ||
      typeof raw.charter_version !== "number"
    ) {
      throw new Error(
        "Data-shape error: get_counts returned invalid or missing count fields (expected members, articles, amendments, charter_version as numbers)."
      );
    }
    return {
      members: raw.members,
      articles: raw.articles,
      amendments: raw.amendments,
      charter_version: raw.charter_version,
    };
  },

  // Treasury View Calls
  async getTreasuryState(treasuryAddress: string): Promise<TreasuryState> {
    const state = await readContractJson<TreasuryState>(treasuryAddress, "get_treasury_state");
    const balance = await genlayerClient.getBalance({
      address: treasuryAddress as `0x${string}`,
    });
    state.balance_wei = balance;
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
