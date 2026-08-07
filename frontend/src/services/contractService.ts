import { readContractJson } from "../lib/genlayerClient";
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
      await readContractJson(
        charterAddress,
        FRONTEND_CONTRACT_CALLS.charter.getCharterBundle.methodName,
      ),
    );
  },

  async getArticle(charterAddress: string, id: number): Promise<CharterArticleInfo> {
    return validateArticle(
      await readContractJson(
        charterAddress,
        FRONTEND_CONTRACT_CALLS.charter.getArticle.methodName,
        [id],
      ),
    );
  },

  async getAmendment(charterAddress: string, id: number): Promise<AmendmentInfo> {
    return validateAmendment(
      await readContractJson(
        charterAddress,
        FRONTEND_CONTRACT_CALLS.charter.getAmendment.methodName,
        [id],
      ),
    );
  },

  async getMember(charterAddress: string, address: string): Promise<CharterMember> {
    return validateMember(
      await readContractJson(
        charterAddress,
        FRONTEND_CONTRACT_CALLS.charter.getMember.methodName,
        [address],
      ),
    );
  },

  async getCharterCounts(charterAddress: string): Promise<CharterCounts> {
    return validateCharterCounts(
      await readContractJson(
        charterAddress,
        FRONTEND_CONTRACT_CALLS.charter.getCounts.methodName,
      ),
    );
  },

  // Treasury View Calls
  async getTreasuryState(treasuryAddress: string): Promise<TreasuryState> {
    return validateTreasuryState(
      await readContractJson(
        treasuryAddress,
        FRONTEND_CONTRACT_CALLS.treasury.getTreasuryState.methodName,
      ),
    );
  },

  async getRequestCount(treasuryAddress: string): Promise<number> {
    return validateScalarCount(
      await readContractJson(
        treasuryAddress,
        FRONTEND_CONTRACT_CALLS.treasury.getRequestCount.methodName,
      ),
      FRONTEND_CONTRACT_CALLS.treasury.getRequestCount.methodName,
    );
  },

  async getRequest(treasuryAddress: string, id: number): Promise<RequestInfo> {
    return validateRequest(
      await readContractJson(
        treasuryAddress,
        FRONTEND_CONTRACT_CALLS.treasury.getRequest.methodName,
        [id],
      ),
    );
  },

  async getPrecedentCount(treasuryAddress: string): Promise<number> {
    return validateScalarCount(
      await readContractJson(
        treasuryAddress,
        FRONTEND_CONTRACT_CALLS.treasury.getPrecedentCount.methodName,
      ),
      FRONTEND_CONTRACT_CALLS.treasury.getPrecedentCount.methodName,
    );
  },

  async getPrecedents(treasuryAddress: string, offset: number, limit: number): Promise<PrecedentInfo[]> {
    return validatePrecedentsPage(
      await readContractJson(
        treasuryAddress,
        FRONTEND_CONTRACT_CALLS.treasury.getPrecedents.methodName,
        [offset, limit],
      ),
    );
  },
};
