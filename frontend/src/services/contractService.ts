import { readContractJson, genlayerClient } from "../lib/genlayerClient";
import { FRONTEND_CONTRACT_CALLS } from "../lib/contractMethods";
import {
  CharterBundle,
  CharterArticleInfo,
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
    const raw = await readContractJson<CharterBundle>(charterAddress, FRONTEND_CONTRACT_CALLS.charter.getCharterBundle.methodName);
    if (!raw || typeof raw.charter_version !== "number" || !Array.isArray(raw.articles)) {
      throw new Error("Data-shape error: get_charter_bundle returned invalid shape.");
    }
    return raw;
  },

  async getArticle(charterAddress: string, id: number): Promise<CharterArticleInfo> {
    return readContractJson<CharterArticleInfo>(charterAddress, FRONTEND_CONTRACT_CALLS.charter.getArticle.methodName, [id]);
  },

  async getAmendment(charterAddress: string, id: number): Promise<AmendmentInfo> {
    return readContractJson<AmendmentInfo>(charterAddress, FRONTEND_CONTRACT_CALLS.charter.getAmendment.methodName, [id]);
  },

  async getMember(charterAddress: string, address: string): Promise<CharterMember> {
    return readContractJson<CharterMember>(charterAddress, FRONTEND_CONTRACT_CALLS.charter.getMember.methodName, [address]);
  },

  async getCharterCounts(charterAddress: string): Promise<CharterCounts> {
    const raw = await readContractJson<any>(charterAddress, FRONTEND_CONTRACT_CALLS.charter.getCounts.methodName);
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
    const state = await readContractJson<TreasuryState>(treasuryAddress, FRONTEND_CONTRACT_CALLS.treasury.getTreasuryState.methodName);
    try {
      const balance = await genlayerClient.getBalance({
        address: treasuryAddress as `0x${string}`,
      });
      return { ...state, balance_wei: balance };
    } catch {
      return { ...state, balance_wei: state.balance_wei || 0n };
    }
  },

  async getRequestCount(treasuryAddress: string): Promise<number> {
    return readContractJson<number>(treasuryAddress, FRONTEND_CONTRACT_CALLS.treasury.getRequestCount.methodName);
  },

  async getRequest(treasuryAddress: string, id: number): Promise<RequestInfo> {
    return readContractJson<RequestInfo>(treasuryAddress, FRONTEND_CONTRACT_CALLS.treasury.getRequest.methodName, [id]);
  },

  async getPrecedentCount(treasuryAddress: string): Promise<number> {
    return readContractJson<number>(treasuryAddress, FRONTEND_CONTRACT_CALLS.treasury.getPrecedentCount.methodName);
  },

  async getPrecedents(treasuryAddress: string, offset: number, limit: number): Promise<PrecedentInfo[]> {
    return readContractJson<PrecedentInfo[]>(treasuryAddress, FRONTEND_CONTRACT_CALLS.treasury.getPrecedents.methodName, [offset, limit]);
  },
};
