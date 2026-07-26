export interface WalletState {
  account: string | null;
  chainId: string | null;
  isStudionet: boolean;
  hasWallet: boolean;
  error: string | null;
}

const STUDIONET_HEX_CHAIN_ID = "0xF22F"; // 61999

export async function connectEip1193Wallet(): Promise<{ account: string; chainId: string }> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("NO_WALLET_INSTALLED");
  }

  const ethereum = (window as any).ethereum;

  // 1. Request accounts
  const accounts: string[] = await ethereum.request({
    method: "eth_requestAccounts",
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts authorized in wallet.");
  }

  const account = accounts[0];

  // 2. Ensure chain is Studionet (61999 = 0xF22F)
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_HEX_CHAIN_ID }],
    });
  } catch (switchError: any) {
    // Error code 4902 indicates chain has not been added to wallet
    if (switchError?.code === 4902 || switchError?.message?.includes("Unrecognized chain")) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: STUDIONET_HEX_CHAIN_ID,
              chainName: "GenLayer Studionet",
              rpcUrls: ["https://studio.genlayer.com/api"],
              nativeCurrency: {
                name: "GEN",
                symbol: "GEN",
                decimals: 18,
              },
              blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
            },
          ],
        });
      } catch (addError: any) {
        throw new Error(`Failed to add GenLayer Studionet network to wallet: ${addError?.message || addError}`);
      }
    } else {
      throw new Error(`Failed to switch wallet to GenLayer Studionet network: ${switchError?.message || switchError}`);
    }
  }

  const currentChainId: string = await ethereum.request({ method: "eth_chainId" });

  return {
    account,
    chainId: currentChainId,
  };
}

export function subscribeWalletEvents(
  onAccountsChanged: (accounts: string[]) => void,
  onChainChanged: (chainId: string) => void
) {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const ethereum = (window as any).ethereum;
    if (ethereum.on) {
      ethereum.on("accountsChanged", onAccountsChanged);
      ethereum.on("chainChanged", onChainChanged);
    }
  }
}

export function unsubscribeWalletEvents(
  onAccountsChanged: (accounts: string[]) => void,
  onChainChanged: (chainId: string) => void
) {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const ethereum = (window as any).ethereum;
    if (ethereum.removeListener) {
      ethereum.removeListener("accountsChanged", onAccountsChanged);
      ethereum.removeListener("chainChanged", onChainChanged);
    }
  }
}
