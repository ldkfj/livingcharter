import { describe, expect, it, vi } from "vitest";
import {
  STUDIONET_READ_UNAVAILABLE_MESSAGE,
  StudionetReadUnavailableError,
  createRpcReadExecutor,
  isTransientRpcError,
} from "./rpcRead";

const noDelay = async () => {};
const flushQueue = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function testExecutor(overrides: Parameters<typeof createRpcReadExecutor>[0] = {}) {
  return createRpcReadExecutor({
    maxConcurrent: 2,
    maxAttempts: 4,
    retryBudgetMs: 10_000,
    baseDelayMs: 1,
    maxDelayMs: 1,
    jitterRatio: 0,
    sleep: noDelay,
    now: () => 0,
    random: () => 0.5,
    ...overrides,
  });
}

describe("Studionet RPC error classification", () => {
  it("recognizes the nested reviewer-reported execution-slot error", () => {
    const error = {
      name: "ResourceUnavailableRpcError",
      message: "Version of JSON-RPC protocol is not supported. Version: viem@2.55.8",
      cause: {
        details: "Server busy: all 8 execution slots occupied, retry later",
        code: -32002,
      },
    };

    expect(isTransientRpcError(error)).toBe(true);
  });

  it("recognizes a -32002 service-unavailable response", () => {
    expect(
      isTransientRpcError({
        code: -32002,
        details: "Service temporarily unavailable",
      }),
    ).toBe(true);
  });

  it("recognizes the browser network-failure shape observed on Studionet", () => {
    expect(
      isTransientRpcError(
        new Error(
          "An unknown RPC error occurred. Details: Failed to fetch Version: viem@2.55.8",
        ),
      ),
    ).toBe(true);
  });

  it.each([
    new Error("Data-shape error: missing field."),
    new Error("Invalid params for get_request."),
    new Error("Contract function not found."),
    new Error("E_NOT_MEMBER"),
    new Error("Version of JSON-RPC protocol is not supported."),
  ])("does not retry deterministic or unqualified protocol errors", (error) => {
    expect(isTransientRpcError(error)).toBe(false);
  });
});

describe("bounded RPC read executor", () => {
  it("retries transient failures and returns a later success", async () => {
    const run = testExecutor();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Server busy, retry later"))
      .mockRejectedValueOnce(new Error("HTTP 503"))
      .mockResolvedValue("live-chain-data");

    await expect(run(operation)).resolves.toBe("live-chain-data");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("fails with a stable honest message and preserves the final cause", async () => {
    const run = testExecutor({ maxAttempts: 3 });
    const finalCause = new Error("Server busy: all 8 execution slots occupied");
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(finalCause);

    try {
      await run(operation);
      throw new Error("Expected the read to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(StudionetReadUnavailableError);
      expect(error).toMatchObject({
        message: STUDIONET_READ_UNAVAILABLE_MESSAGE,
        cause: finalCause,
        attempts: 3,
      });
    }
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it.each([
    new Error("Data-shape error: wrong state type."),
    new Error("Invalid params."),
    new Error("E_NOT_FOUND"),
  ])("does not retry non-transient failures", async (failure) => {
    const run = testExecutor();
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(failure);

    await expect(run(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("never runs more than two underlying reads concurrently", async () => {
    const run = testExecutor({ maxConcurrent: 2, maxAttempts: 1 });
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];

    const tasks = Array.from({ length: 4 }, (_, index) =>
      run(
        () =>
          new Promise<number>((resolve) => {
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            releases.push(() => {
              active -= 1;
              resolve(index);
            });
          }),
      ),
    );

    await flushQueue();
    expect(releases).toHaveLength(2);
    releases[0]();
    releases[1]();

    await flushQueue();
    expect(releases).toHaveLength(4);
    releases[2]();
    releases[3]();

    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3]);
    expect(maximumActive).toBe(2);
  });

  it("starts queued reads in FIFO order", async () => {
    const run = testExecutor({ maxConcurrent: 1, maxAttempts: 1 });
    const started: number[] = [];
    const releases: Array<() => void> = [];

    const tasks = [1, 2, 3].map((id) =>
      run(
        () =>
          new Promise<number>((resolve) => {
            started.push(id);
            releases.push(() => resolve(id));
          }),
      ),
    );

    await flushQueue();
    expect(started).toEqual([1]);

    releases[0]();
    await flushQueue();
    expect(started).toEqual([1, 2]);

    releases[1]();
    await flushQueue();
    expect(started).toEqual([1, 2, 3]);

    releases[2]();
    await expect(Promise.all(tasks)).resolves.toEqual([1, 2, 3]);
  });

  it("does not multiply an outage after one slow attempt consumes the retry budget", async () => {
    let clockMs = 0;
    const run = testExecutor({
      retryBudgetMs: 8_000,
      now: () => clockMs,
    });
    const failure = new Error("Service temporarily unavailable");
    const operation = vi.fn(async () => {
      clockMs = 9_000;
      throw failure;
    });

    await expect(run(operation)).rejects.toMatchObject({
      cause: failure,
      attempts: 1,
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
