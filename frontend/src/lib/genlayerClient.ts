import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { isLosslessNumber, parse } from "lossless-json";

export const genlayerClient = createClient({
  chain: studionet,
  endpoint: "https://studio.genlayer.com/api",
});

export function createWriteClient(accountAddress: string) {
  return createClient({
    chain: studionet,
    endpoint: "https://studio.genlayer.com/api",
    account: accountAddress as `0x${string}`,
  });
}

const WEI_FIELDS = new Set([
  "amount_wei",
  "approved_amount_wei",
  "requested_wei",
  "approved_wei",
  "balance_wei",
]);

export function parseContractJson(rawResult: string): unknown {
  return parse(rawResult, (key, value) => {
    if (WEI_FIELDS.has(key)) {
      if (isLosslessNumber(value)) {
        return BigInt(value.toString());
      }

      if (typeof value === "string" && /^\d+$/.test(value)) {
        return BigInt(value);
      }

      return value;
    }

    if (isLosslessNumber(value)) {
      const numericValue = Number(value.toString());
      if (!Number.isSafeInteger(numericValue)) {
        throw new Error(`Data-shape error: unsafe non-wei integer at "${key || "<root>"}".`);
      }
      return numericValue;
    }

    return value;
  });
}

export async function readContractJson<T>(
  address: string,
  functionName: string,
  args: any[] = []
): Promise<T> {
  const rawResult = await genlayerClient.readContract({
    address: address as `0x${string}`,
    functionName,
    args,
  });

  if (typeof rawResult === "string") {
    return parseContractJson(rawResult) as T;
  }

  return rawResult as T;
}
