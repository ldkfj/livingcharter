import {
  ExecutionResult,
  TransactionStatus,
  type DebugTraceResult,
  type GenLayerTransaction,
  type TransactionHash,
} from "genlayer-js/types";
import type { createWriteClient } from "./genlayerClient";

export type TxStage =
  | "IDLE"
  | "WALLET_CONFIRM"
  | "SUBMITTED"
  | "CONSENSUS_PROGRESS"
  | "FINALIZED_SUCCESS"
  | "FINALIZED_ERROR"
  | "TIMEOUT"
  | "CANCELLED";

export interface TxStatusState {
  stage: TxStage;
  txHash: string | null;
  networkStatus: string | null;
  errorMessage: string | null;
  rawErrorCode: string | null;
  elapsedSeconds: number;
}

export type WriteResult =
  | { kind: "success"; hash: string }
  | { kind: "cancelled" }
  | { kind: "failed"; error: string };

export const ERROR_MAPPINGS: Record<string, string> = {
  E_NOT_BOOTSTRAPPED: "The charter has not been bootstrapped with founding articles yet.",
  E_NOT_MEMBER: "Your connected wallet is not an active voting member of LivingCharter.",
  E_OPEN_REQUEST_EXISTS: "You already have an open spend request pending adjudication or payout.",
  E_COOLDOWN_ACTIVE: "Member cooldown active. Please wait 60 seconds between spend requests.",
  E_INVALID_AMOUNT: "Invalid spend request amount. Must be greater than 0 GEN.",
  E_INSUFFICIENT_BALANCE: "The Treasury does not have sufficient GEN balance for this payout.",
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

  const match = errMsg.match(/\b(E_[A-Z0-9_]+)\b/);
  if (match) {
    const code = match[1];
    return {
      rawCode: code,
      humanMsg: ERROR_MAPPINGS[code] || `Contract transaction rejected with error code ${code}.`,
    };
  }

  return { rawCode: null, humanMsg: errMsg };
}

export type TxLifecycleClient = Pick<
  ReturnType<typeof createWriteClient>,
  "writeContract" | "getTransaction" | "waitForTransactionReceipt" | "debugTraceTransaction"
>;

export interface TxEngineOptions {
  pollIntervalMs?: number;
  waitRetries?: number;
}

type ReceiptLike = GenLayerTransaction & Record<string, unknown>;

const STATUS_BY_NUMBER: Record<number, TransactionStatus> = {
  0: TransactionStatus.UNINITIALIZED,
  1: TransactionStatus.PENDING,
  2: TransactionStatus.PROPOSING,
  3: TransactionStatus.COMMITTING,
  4: TransactionStatus.REVEALING,
  5: TransactionStatus.ACCEPTED,
  6: TransactionStatus.UNDETERMINED,
  7: TransactionStatus.FINALIZED,
  8: TransactionStatus.CANCELED,
  9: TransactionStatus.APPEAL_REVEALING,
  10: TransactionStatus.APPEAL_COMMITTING,
  11: TransactionStatus.READY_TO_FINALIZE,
  12: TransactionStatus.VALIDATORS_TIMEOUT,
  13: TransactionStatus.LEADER_TIMEOUT,
};

class ReportedTransactionError extends Error {}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getStatusName(value: unknown): string | null {
  const tx = asRecord(value);
  if (!tx) return null;

  if (typeof tx.statusName === "string") {
    return tx.statusName.toUpperCase();
  }

  if (typeof tx.status_name === "string") {
    return tx.status_name.toUpperCase();
  }

  if (typeof tx.status === "string") {
    return tx.status.toUpperCase();
  }

  if (typeof tx.status === "number") {
    return STATUS_BY_NUMBER[tx.status] ?? `STATUS_${tx.status}`;
  }

  return null;
}

function getLeaderReceipt(receipt: ReceiptLike): Record<string, unknown> | null {
  const consensus =
    asRecord(receipt.consensus_data) ??
    asRecord(receipt.consensusData);
  const leaderReceipts = consensus?.leader_receipt ?? consensus?.leaderReceipt;

  if (!Array.isArray(leaderReceipts)) return null;

  const records = leaderReceipts
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== null);

  return records.find((entry) => entry.mode === "leader") ?? records[0] ?? null;
}

function getExecutionResultName(receipt: ReceiptLike): ExecutionResult | null {
  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN) {
    return ExecutionResult.FINISHED_WITH_RETURN;
  }

  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    return ExecutionResult.FINISHED_WITH_ERROR;
  }

  const rawName =
    receipt.tx_execution_result_name ??
    receipt.executionResultName;
  if (rawName === ExecutionResult.FINISHED_WITH_RETURN) {
    return ExecutionResult.FINISHED_WITH_RETURN;
  }
  if (rawName === ExecutionResult.FINISHED_WITH_ERROR) {
    return ExecutionResult.FINISHED_WITH_ERROR;
  }

  // Studionet currently retains the raw consensus receipt alongside the
  // documented SDK fields. This compatibility path is deliberately closed:
  // only an explicit SUCCESS/ERROR is accepted.
  const leaderReceipt = getLeaderReceipt(receipt);
  const rawExecutionResult = leaderReceipt?.execution_result ?? leaderReceipt?.executionResult;
  if (rawExecutionResult === "SUCCESS") {
    return ExecutionResult.FINISHED_WITH_RETURN;
  }
  if (rawExecutionResult === "ERROR") {
    return ExecutionResult.FINISHED_WITH_ERROR;
  }

  return null;
}

function stringifyDiagnostic(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? item.toString() : item,
    );
  } catch {
    return String(value);
  }
}

async function getFailureDiagnostic(
  client: TxLifecycleClient,
  hash: TransactionHash,
  receipt: ReceiptLike,
): Promise<string> {
  const diagnostics = [stringifyDiagnostic(receipt)];

  try {
    const trace: DebugTraceResult = await client.debugTraceTransaction({
      hash,
      round: 0,
    });
    diagnostics.push(stringifyDiagnostic(trace));
  } catch {
    // The finalized receipt remains authoritative when trace retrieval fails.
  }

  return diagnostics.join("\n");
}

function isWalletRejection(error: unknown): boolean {
  const record = asRecord(error);
  const message = stringifyDiagnostic(error).toLowerCase();
  return (
    record?.code === 4001 ||
    message.includes("user rejected") ||
    message.includes("user denied")
  );
}

function isTimeoutError(error: unknown): boolean {
  const message = stringifyDiagnostic(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("max retries") ||
    message.includes("maximum retries") ||
    message.includes("did not reach")
  );
}

export async function executeWriteTransaction(
  client: TxLifecycleClient,
  contractAddress: string,
  functionName: string,
  args: any[] = [],
  valueWei: bigint = 0n,
  onStatusChange: (status: TxStatusState) => void,
  options: TxEngineOptions = {},
): Promise<string> {
  const startTime = Date.now();
  let currentTxHash: string | null = null;
  let latestNetworkStatus: string | null = null;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const waitRetries = options.waitRetries ?? 180;

  const updateState = (stage: TxStage, netStatus: string | null = null, err: string | null = null, rawCode: string | null = null) => {
    latestNetworkStatus = netStatus ?? latestNetworkStatus;
    onStatusChange({
      stage,
      txHash: currentTxHash,
      networkStatus: latestNetworkStatus,
      errorMessage: err,
      rawErrorCode: rawCode,
      elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
    });
  };

  // Stage 1: WALLET_CONFIRM
  updateState("WALLET_CONFIRM");

  try {
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

    const publishNetworkStatus = async () => {
      try {
        const transaction = await client.getTransaction({ hash });
        const statusName = getStatusName(transaction);
        if (statusName) {
          updateState("CONSENSUS_PROGRESS", statusName);
        }
      } catch {
        // Receipt waiting remains authoritative; a transient status read is not.
      }
    };

    await publishNetworkStatus();
    const progressTimer = setInterval(() => {
      void publishNetworkStatus();
    }, pollIntervalMs);

    let receipt: ReceiptLike;

    try {
      receipt = (await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
        interval: pollIntervalMs,
        retries: waitRetries,
      })) as ReceiptLike;
    } catch (error) {
      if (isTimeoutError(error)) {
        const timeoutMessage =
          "Finalization was not confirmed before the polling limit. Check the transaction in the explorer before retrying.";
        updateState("TIMEOUT", latestNetworkStatus, timeoutMessage);
        throw new ReportedTransactionError("TRANSACTION_TIMEOUT");
      }
      throw error;
    } finally {
      clearInterval(progressTimer);
    }

    const finalStatus = getStatusName(receipt);
    if (finalStatus !== TransactionStatus.FINALIZED) {
      const statusMessage = `Receipt returned without FINALIZED status (received ${finalStatus ?? "unknown"}).`;
      updateState("FINALIZED_ERROR", finalStatus, statusMessage);
      throw new ReportedTransactionError(statusMessage);
    }

    const executionResult = getExecutionResultName(receipt);
    if (executionResult !== ExecutionResult.FINISHED_WITH_RETURN) {
      const diagnostic = await getFailureDiagnostic(client, hash, receipt);
      const { rawCode, humanMsg } = extractErrorCode(
        executionResult === ExecutionResult.FINISHED_WITH_ERROR
          ? diagnostic
          : `Finalized transaction did not expose a recognized execution result. ${diagnostic}`,
      );
      updateState("FINALIZED_ERROR", "FINALIZED", humanMsg, rawCode);
      throw new ReportedTransactionError(humanMsg);
    }

    updateState("FINALIZED_SUCCESS", "FINALIZED");
    return hash;

  } catch (err: any) {
    if (err instanceof ReportedTransactionError) {
      throw err;
    }

    if (isWalletRejection(err)) {
      updateState("CANCELLED", null, "Transaction approval cancelled in wallet.");
      throw new ReportedTransactionError("USER_CANCELLED");
    }

    const errMsg = stringifyDiagnostic(err);
    const { rawCode, humanMsg } = extractErrorCode(errMsg);
    updateState("FINALIZED_ERROR", null, humanMsg, rawCode);
    throw new ReportedTransactionError(humanMsg);
  }
}
