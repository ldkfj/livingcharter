import { createWriteClient, genlayerClient } from "./genlayerClient";

export type TxStage =
  | "IDLE"
  | "WALLET_CONFIRM"
  | "SUBMITTED"
  | "CONSENSUS_PROGRESS"
  | "FINALIZED_SUCCESS"
  | "FINALIZED_ERROR"
  | "CANCELLED";

export interface TxStatusState {
  stage: TxStage;
  txHash: string | null;
  networkStatus: string | null;
  errorMessage: string | null;
  rawErrorCode: string | null;
  elapsedSeconds: number;
}

export const ERROR_MAPPINGS: Record<string, string> = {
  E_NOT_BOOTSTRAPPED: "The charter has not been bootstrapped with founding articles yet.",
  E_NOT_MEMBER: "Your connected wallet is not an active voting member of LivingCharter.",
  E_OPEN_REQUEST_EXISTS: "You already have an open spend request pending adjudication or payout.",
  E_COOLDOWN_ACTIVE: "Member cooldown active. Please wait 60 seconds between spend requests.",
  E_INVALID_AMOUNT: "Invalid spend request amount. Must be greater than 0 GEN.",
  E_INSUFFICIENT_FUNDS: "The Treasury does not have sufficient GEN balance for this payout.",
  E_RATIONALE_TOO_LONG: "Amendment rationale exceeds the 500 character limit.",
  E_INVALID_ARTICLE_LENGTH: "Article text must be between 20 and 2000 characters.",
  E_INVALID_ARTICLE_TARGET: "Target article ID does not exist or is not active.",
  E_MEMBER_ALREADY_ACTIVE: "Target address is already an active charter member.",
  E_MEMBER_NOT_ACTIVE: "Target address is not an active charter member.",
  E_LAST_MEMBER: "Cannot remove the final active member of LivingCharter.",
  E_INVALID_KIND: "Invalid amendment motion kind.",
  E_AMENDMENT_NOT_FOUND: "Amendment motion ID was not found.",
  E_NOT_PROPOSER: "Only the original motion proposer can cancel this amendment.",
  E_CANNOT_CANCEL: "Motion cannot be cancelled (votes cast or not in proposed state).",
  E_EXPIRED: "Voting period deadline has expired.",
  E_ALREADY_VOTED: "Your wallet has already cast a vote on this amendment motion.",
  E_VOTING_CLOSED: "Voting period for this amendment motion is closed.",
  E_NOT_FINAL_RULED: "Request is not in a final ruled state for payout execution.",
  E_ALREADY_PAID: "Request funds have already been paid out.",
  E_APPEAL_WINDOW_OPEN: "Appeal window is still open. Payout can be executed after the window closes.",
  E_APPEAL_WINDOW_CLOSED: "Appeal window has expired for this request.",
  E_ALREADY_APPEALED: "An appeal has already been filed for this spend request.",
  E_PURPOSE_TOO_SHORT: "Request purpose statement must be at least 10 characters.",
  E_PURPOSE_TOO_LONG: "Request purpose statement cannot exceed 600 characters.",
  E_INVALID_EVIDENCE_COUNT: "Must provide between 1 and 3 evidence URLs.",
  E_URL_TOO_LONG: "Evidence URL exceeds 300 characters.",
  E_INVALID_URL_SCHEME: "Evidence URL must begin with http:// or https://.",
  E_INVALID_URL_CREDENTIALS: "Evidence URL must not contain embedded user credentials ('@' in host).",
  E_APPEAL_ARGUMENT_TOO_SHORT: "Appeal argument must be at least 20 characters.",
  E_APPEAL_ARGUMENT_TOO_LONG: "Appeal argument cannot exceed 1000 characters.",
};

export function extractErrorCode(errMsg: string | undefined | null): { rawCode: string | null; humanMsg: string } {
  if (!errMsg) return { rawCode: null, humanMsg: "Transaction execution failed." };

  for (const [code, explanation] of Object.entries(ERROR_MAPPINGS)) {
    if (errMsg.includes(code)) {
      return { rawCode: code, humanMsg: explanation };
    }
  }

  const match = errMsg.match(/Exception: (E_[A_Z0-9_]+)/);
  if (match) {
    const code = match[1];
    return {
      rawCode: code,
      humanMsg: ERROR_MAPPINGS[code] || `Contract transaction rejected with error code ${code}.`,
    };
  }

  return { rawCode: null, humanMsg: errMsg };
}

export async function executeWriteTransaction(
  accountAddress: string,
  contractAddress: string,
  functionName: string,
  args: any[] = [],
  valueWei: bigint = 0n,
  onStatusChange: (status: TxStatusState) => void
): Promise<string> {
  const startTime = Date.now();
  let currentTxHash: string | null = null;

  const updateState = (stage: TxStage, netStatus: string | null = null, err: string | null = null, rawCode: string | null = null) => {
    onStatusChange({
      stage,
      txHash: currentTxHash,
      networkStatus: netStatus,
      errorMessage: err,
      rawErrorCode: rawCode,
      elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
    });
  };

  // Stage 1: WALLET_CONFIRM
  updateState("WALLET_CONFIRM");

  try {
    const client = createWriteClient(accountAddress);

    // Prompt wallet sign
    const hash = await client.writeContract({
      address: contractAddress as `0x${string}`,
      functionName,
      args,
      value: valueWei,
    });

    currentTxHash = hash;

    // Stage 2: SUBMITTED
    updateState("SUBMITTED", "SUBMITTED");

    // Stage 3: CONSENSUS_PROGRESS polling
    updateState("CONSENSUS_PROGRESS", "PROPOSING");

    const pollIntervalMs = 1500;
    const maxPolls = 60;
    let receipt: any = null;

    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));

      try {
        const tx = await genlayerClient.getTransaction({ hash: hash as any });
        if (tx) {
          const statusStr = String(tx.status).toUpperCase();
          updateState("CONSENSUS_PROGRESS", statusStr);
        }
      } catch {
        // Ignore poll error
      }

      try {
        receipt = await genlayerClient.waitForTransactionReceipt({
          hash: hash as any,
          status: "FINALIZED" as any,
          interval: 1000,
          retries: 1,
        });

        if (receipt) break;
      } catch {
        // Keep checking
      }
    }

    if (!receipt) {
      try {
        receipt = await genlayerClient.waitForTransactionReceipt({
          hash: hash as any,
          status: "ACCEPTED" as any,
          interval: 1000,
          retries: 2,
        });
      } catch {
        // Receipt polling finished
      }
    }

    if (receipt && receipt.status === "ERROR") {
      const { rawCode, humanMsg } = extractErrorCode(receipt.error?.message || receipt.execution_result);
      updateState("FINALIZED_ERROR", "FINALIZED", humanMsg, rawCode);
      throw new Error(humanMsg);
    }

    updateState("FINALIZED_SUCCESS", "FINALIZED");
    return hash;

  } catch (err: any) {
    const errMsg = err?.message || String(err);

    if (errMsg.toLowerCase().includes("user rejected") || errMsg.toLowerCase().includes("user denied") || err?.code === 4001) {
      updateState("CANCELLED", null, "Transaction approval cancelled in wallet.");
      throw new Error("USER_CANCELLED");
    }

    const { rawCode, humanMsg } = extractErrorCode(errMsg);
    updateState("FINALIZED_ERROR", null, humanMsg, rawCode);
    throw new Error(humanMsg);
  }
}
