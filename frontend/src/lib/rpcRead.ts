export const STUDIONET_READ_UNAVAILABLE_MESSAGE =
  "Studionet is temporarily busy. No data was fabricated and no transaction was submitted. Wait a moment and retry.";

export class StudionetReadUnavailableError extends Error {
  readonly code = "STUDIONET_READ_UNAVAILABLE";
  readonly attempts: number;
  override readonly cause: unknown;

  constructor(cause: unknown, attempts: number) {
    super(STUDIONET_READ_UNAVAILABLE_MESSAGE);
    this.name = "StudionetReadUnavailableError";
    this.cause = cause;
    this.attempts = attempts;
  }
}

type Sleep = (delayMs: number) => Promise<void>;

export interface RpcReadExecutorOptions {
  maxConcurrent?: number;
  maxAttempts?: number;
  retryBudgetMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  sleep?: Sleep;
  now?: () => number;
  random?: () => number;
}

interface RequiredRpcReadExecutorOptions {
  maxAttempts: number;
  retryBudgetMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  sleep: Sleep;
  now: () => number;
  random: () => number;
}

const ERROR_TEXT_KEYS = [
  "name",
  "message",
  "shortMessage",
  "details",
  "code",
  "status",
  "statusCode",
] as const;

function collectErrorParts(
  value: unknown,
  parts: string[],
  seen: Set<object>,
  depth = 0,
): void {
  if (value === null || value === undefined || depth > 6) {
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    parts.push(String(value));
    return;
  }

  if (typeof value !== "object" || seen.has(value)) {
    return;
  }

  seen.add(value);
  const record = value as Record<string, unknown>;

  for (const key of ERROR_TEXT_KEYS) {
    if (key in record) {
      collectErrorParts(record[key], parts, seen, depth + 1);
    }
  }

  if ("cause" in record) {
    collectErrorParts(record.cause, parts, seen, depth + 1);
  }
  if ("data" in record) {
    collectErrorParts(record.data, parts, seen, depth + 1);
  }
}

export function describeRpcError(error: unknown): string {
  const parts: string[] = [];
  collectErrorParts(error, parts, new Set<object>());
  return parts.join(" | ");
}

const DEFINITELY_NON_RETRYABLE = [
  /data-shape error/i,
  /invalid (?:argument|params|parameters)/i,
  /method not found/i,
  /function .*not found/i,
  /contract .*not found/i,
  /execution reverted/i,
  /user (?:rejected|denied|cancelled|canceled)/i,
  /wallet .*rejected/i,
  /\bE_[A-Z0-9_]+\b/,
];

const TRANSIENT_TEXT = [
  /server busy/i,
  /execution slots? occupied/i,
  /retry later/i,
  /service temporarily unavailable/i,
  /temporarily busy/i,
  /too many requests/i,
  /rate limit/i,
  /failed to fetch/i,
  /network (?:error|reset|unavailable)/i,
  /connection (?:reset|timed out|timeout)/i,
  /\btimeout\b/i,
  /\btimed out\b/i,
  /\b(?:HTTP )?(?:429|502|503|504)\b/i,
  /(?:^|\D)-32002(?:\D|$)/,
];

export function isTransientRpcError(error: unknown): boolean {
  const description = describeRpcError(error);

  if (DEFINITELY_NON_RETRYABLE.some((pattern) => pattern.test(description))) {
    return false;
  }

  return TRANSIENT_TEXT.some((pattern) => pattern.test(description));
}

class FifoSemaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  run<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active += 1;
        Promise.resolve()
          .then(operation)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.drain();
          });
      };

      this.queue.push(start);
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.limit && this.queue.length > 0) {
      this.queue.shift()?.();
    }
  }
}

const defaultSleep: Sleep = (delayMs) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });

export function createRpcReadExecutor(options: RpcReadExecutorOptions = {}) {
  const maxConcurrent = options.maxConcurrent ?? 2;
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error("maxConcurrent must be a positive integer.");
  }

  const config: RequiredRpcReadExecutorOptions = {
    maxAttempts: options.maxAttempts ?? 4,
    retryBudgetMs: options.retryBudgetMs ?? 8_000,
    baseDelayMs: options.baseDelayMs ?? 250,
    maxDelayMs: options.maxDelayMs ?? 1_500,
    jitterRatio: options.jitterRatio ?? 0.2,
    sleep: options.sleep ?? defaultSleep,
    now: options.now ?? Date.now,
    random: options.random ?? Math.random,
  };
  const semaphore = new FifoSemaphore(maxConcurrent);

  return async function runRpcRead<T>(operation: () => Promise<T>): Promise<T> {
    const startedAt = config.now();
    let attempts = 0;

    while (attempts < config.maxAttempts) {
      attempts += 1;

      try {
        return await semaphore.run(operation);
      } catch (error) {
        if (!isTransientRpcError(error)) {
          throw error;
        }

        const elapsedMs = config.now() - startedAt;
        if (attempts >= config.maxAttempts || elapsedMs >= config.retryBudgetMs) {
          throw new StudionetReadUnavailableError(error, attempts);
        }

        const exponentialDelay = Math.min(
          config.maxDelayMs,
          config.baseDelayMs * 2 ** (attempts - 1),
        );
        const jitterMultiplier =
          1 - config.jitterRatio + config.random() * config.jitterRatio * 2;
        const delayMs = Math.max(0, Math.round(exponentialDelay * jitterMultiplier));

        if (elapsedMs + delayMs > config.retryBudgetMs) {
          throw new StudionetReadUnavailableError(error, attempts);
        }

        await config.sleep(delayMs);
      }
    }

    throw new Error("RPC read retry loop terminated unexpectedly.");
  };
}

export const runStudionetRead = createRpcReadExecutor();
