import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const genlayerClient = createClient({
  chain: studionet,
  endpoint: "https://studio.genlayer.com/api",
});

export async function readContractJson<T>(address: string, functionName: string, args: any[] = []): Promise<T> {
  const rawResult = await genlayerClient.readContract({
    address: address as `0x${string}`,
    functionName,
    args,
  });

  if (typeof rawResult === "string") {
    try {
      return JSON.parse(rawResult) as T;
    } catch {
      return rawResult as unknown as T;
    }
  }

  return rawResult as T;
}
