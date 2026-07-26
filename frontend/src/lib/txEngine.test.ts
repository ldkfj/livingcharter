import { describe, expect, it, vi } from "vitest";
import {
  ExecutionResult,
  TransactionStatus,
  type GenLayerTransaction,
} from "genlayer-js/types";
import {
  executeWriteTransaction,
  type TxLifecycleClient,
  type TxStatusState,
} from "./txEngine";

const TX_HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

function createMockClient(
  overrides: Partial<TxLifecycleClient> = {},
): TxLifecycleClient {
  return {
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
    getTransaction: vi.fn().mockResolvedValue({
      status: 2,
      statusName: TransactionStatus.PROPOSING,
    } satisfies GenLayerTransaction),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      status: 7,
      statusName: TransactionStatus.FINALIZED,
      txExecutionResult: 1,
      txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN,
    } satisfies GenLayerTransaction),
    debugTraceTransaction: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as TxLifecycleClient;
}

async function runWithStatuses(client: TxLifecycleClient) {
  const statuses: TxStatusState[] = [];
  const promise = executeWriteTransaction(
    client,
    "0x2222222222222222222222222222222222222222",
    "fund",
    [],
    1n,
    (status) => statuses.push(status),
    { pollIntervalMs: 1, waitRetries: 1 },
  );
  return { promise, statuses };
}

describe("executeWriteTransaction", () => {
  it("reports success only for FINALIZED plus FINISHED_WITH_RETURN", async () => {
    const client = createMockClient();
    const { promise, statuses } = await runWithStatuses(client);

    await expect(promise).resolves.toBe(TX_HASH);
    expect(statuses.at(-1)).toMatchObject({
      stage: "FINALIZED_SUCCESS",
      txHash: TX_HASH,
      networkStatus: TransactionStatus.FINALIZED,
    });
    expect(client.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ status: TransactionStatus.FINALIZED }),
    );
  });

  it("reports a finalized execution failure and surfaces the contract E_* code", async () => {
    const client = createMockClient({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: 7,
        statusName: TransactionStatus.FINALIZED,
        txExecutionResult: 2,
        txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
      } satisfies GenLayerTransaction),
      debugTraceTransaction: vi.fn().mockResolvedValue({
        stderr: "Exception: E_BAD_STATE",
      }),
    });
    const { promise, statuses } = await runWithStatuses(client);

    await expect(promise).rejects.toThrow("E_BAD_STATE");
    expect(statuses.at(-1)).toMatchObject({
      stage: "FINALIZED_ERROR",
      rawErrorCode: "E_BAD_STATE",
    });
    expect(statuses.some((status) => status.stage === "FINALIZED_SUCCESS")).toBe(false);
  });

  it("reports a distinct timeout without falling back to ACCEPTED or success", async () => {
    const client = createMockClient({
      waitForTransactionReceipt: vi
        .fn()
        .mockRejectedValue(new Error("Timed out waiting for FINALIZED")),
    });
    const { promise, statuses } = await runWithStatuses(client);

    await expect(promise).rejects.toThrow("TRANSACTION_TIMEOUT");
    expect(statuses.at(-1)).toMatchObject({
      stage: "TIMEOUT",
      txHash: TX_HASH,
    });
    expect(statuses.some((status) => status.stage === "FINALIZED_SUCCESS")).toBe(false);
    expect(client.waitForTransactionReceipt).toHaveBeenCalledTimes(1);
  });

  it("treats wallet rejection as a neutral cancellation", async () => {
    const rejection = Object.assign(new Error("User rejected the request"), {
      code: 4001,
    });
    const client = createMockClient({
      writeContract: vi.fn().mockRejectedValue(rejection),
    });
    const { promise, statuses } = await runWithStatuses(client);

    await expect(promise).rejects.toThrow("USER_CANCELLED");
    expect(statuses.at(-1)).toMatchObject({
      stage: "CANCELLED",
      txHash: null,
    });
    expect(client.waitForTransactionReceipt).not.toHaveBeenCalled();
  });
});
