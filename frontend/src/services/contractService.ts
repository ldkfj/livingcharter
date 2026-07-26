import { readContractJson, genlayerClient } from "../lib/genlayerClient";
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
} from "../lib/validators";

export const contractService = {
  // Charter View Calls
  async getCharterBundle(charterAddress: string): Promise<CharterBundle> {
    return validateCharterBundle(
      await readContractJson(charterAddress, "get_charter_bundle"),
    );
  },

  async getArticle(charterAddress: string, id: number): Promise<CharterArticleInfo> {
    return validateArticle(await readContractJson(charterAddress, "get_article", [id]));
  },

  async getAmendment(charterAddress: string, id: number): Promise<AmendmentInfo> {
    return validateAmendment(
      await readContractJson(charterAddress, "get_amendment", [id]),
    );
  },

  async getMember(charterAddress: string, address: string): Promise<CharterMember> {
    return validateMember(
      await readContractJson(charterAddress, "get_member", [address]),
    );
  },

  async getCharterCounts(charterAddress: string): Promise<CharterCounts> {
    return validateCharterCounts(await readContractJson(charterAddress, "get_counts"));
  },

  // Treasury View Calls
  async getTreasuryState(treasuryAddress: string): Promise<TreasuryState> {
    const state = validateTreasuryState(
      await readContractJson(treasuryAddress, "get_treasury_state"),
    );
    const balance = await genlayerClient.getBalance({
      address: treasuryAddress as `0x${string}`,
    });
    return { ...state, balance_wei: balance };
  },

  async getRequestCount(treasuryAddress: string): Promise<number> {
    return validateScalarCount(
      await readContractJson(treasuryAddress, "get_request_count"),
      "get_request_count",
    );
  },

  async getRequest(treasuryAddress: string, id: number): Promise<RequestInfo> {
    return validateRequest(await readContractJson(treasuryAddress, "get_request", [id]));
  },

  async getPrecedentCount(treasuryAddress: string): Promise<number> {
    return validateScalarCount(
      await readContractJson(treasuryAddress, "get_precedent_count"),
      "get_precedent_count",
    );
  },

  async getPrecedents(treasuryAddress: string, offset: number, limit: number): Promise<PrecedentInfo[]> {
    return validatePrecedentsPage(
      await readContractJson(treasuryAddress, "get_precedents", [offset, limit]),
    );
  },
};
