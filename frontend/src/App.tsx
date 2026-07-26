import React, { useState, useEffect } from "react";
import { getEnvConfig } from "./config/env";
import { EnvGuardFallback } from "./components/EnvGuard";
import { Header, TabType } from "./components/Header";
import { Footer } from "./components/Footer";
import { DashboardView } from "./components/DashboardView";
import { RequestsView } from "./components/RequestsView";
import { AmendmentsView } from "./components/AmendmentsView";
import { PrecedentsView } from "./components/PrecedentsView";
import {
  useDashboardData,
  useRequests,
  useAmendments,
  usePrecedents,
} from "./hooks/useContractData";
import { connectEip1193Wallet, subscribeWalletEvents, unsubscribeWalletEvents } from "./lib/wallet";

export const App: React.FC = () => {
  const { config, errors } = getEnvConfig();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Check if wallet accounts exist already
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setConnectedAccount(accounts[0]);
        }
      }).catch(() => {});

      const handleAccountsChanged = (accs: string[]) => {
        if (accs && accs.length > 0) {
          setConnectedAccount(accs[0]);
        } else {
          setConnectedAccount(null);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      subscribeWalletEvents(handleAccountsChanged, handleChainChanged);
      return () => unsubscribeWalletEvents(handleAccountsChanged, handleChainChanged);
    }
  }, []);

  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true);
      const res = await connectEip1193Wallet();
      setConnectedAccount(res.account);
    } catch (err: any) {
      if (err?.message !== "NO_WALLET_INSTALLED") {
        console.warn("Wallet connect failed:", err?.message || err);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setConnectedAccount(null);
  };

  if (!config || errors.length > 0) {
    return <EnvGuardFallback errors={errors} />;
  }

  const dashboardState = useDashboardData(config.charterAddress, config.treasuryAddress);
  const requestsState = useRequests(config.treasuryAddress);
  const amendmentsState = useAmendments(config.charterAddress);
  const precedentsState = usePrecedents(config.treasuryAddress);

  const handleSelectArticleAnchor = (articleId: number) => {
    setActiveTab("dashboard");
    setTimeout(() => {
      const elem = document.getElementById(`article-${articleId}`);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connectedAccount={connectedAccount}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        isConnecting={isConnecting}
      />

      <main className="app-main">
        {activeTab === "dashboard" && (
          <DashboardView
            charterAddress={config.charterAddress}
            treasuryAddress={config.treasuryAddress}
            data={dashboardState.data}
            loading={dashboardState.loading}
            error={dashboardState.error}
            onRetry={dashboardState.refetch}
          />
        )}

        {activeTab === "requests" && (
          <RequestsView
            requests={requestsState.requests}
            loading={requestsState.loading}
            error={requestsState.error}
            onRetry={requestsState.refetch}
            onSelectArticleAnchor={handleSelectArticleAnchor}
          />
        )}

        {activeTab === "amendments" && (
          <AmendmentsView
            amendments={amendmentsState.amendments}
            loading={amendmentsState.loading}
            error={amendmentsState.error}
            onRetry={amendmentsState.refetch}
          />
        )}

        {activeTab === "precedents" && (
          <PrecedentsView
            precedents={precedentsState.precedents}
            totalCount={precedentsState.totalCount}
            hasMore={precedentsState.hasMore}
            onLoadMore={precedentsState.loadMore}
            loading={precedentsState.loading}
            error={precedentsState.error}
            onRetry={precedentsState.refetch}
            onSelectArticleAnchor={handleSelectArticleAnchor}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;
