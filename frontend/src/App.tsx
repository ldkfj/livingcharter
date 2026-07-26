import React, { useState, useEffect } from "react";
import { getEnvConfig } from "./config/env";
import { EnvGuardFallback } from "./components/EnvGuard";
import { Header, TabType } from "./components/Header";
import { Footer } from "./components/Footer";
import { DashboardView } from "./components/DashboardView";
import { RequestsView } from "./components/RequestsView";
import { AmendmentsView } from "./components/AmendmentsView";
import { PrecedentsView } from "./components/PrecedentsView";
import { NewRequestModal } from "./components/NewRequestModal";
import { ProposeAmendmentModal } from "./components/ProposeAmendmentModal";
import { TransactionStatusModal } from "./components/TransactionStatusModal";
import {
  useDashboardData,
  useRequests,
  useAmendments,
  usePrecedents,
} from "./hooks/useContractData";
import { connectEip1193Wallet, subscribeWalletEvents, unsubscribeWalletEvents } from "./lib/wallet";
import { executeWriteTransaction, TxStatusState } from "./lib/txEngine";

export const App: React.FC = () => {
  const { config, errors } = getEnvConfig();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Modals & Tx State
  const [isNewReqModalOpen, setIsNewReqModalOpen] = useState(false);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatusState | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
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

  const refetchAll = () => {
    dashboardState.refetch();
    requestsState.refetch();
    amendmentsState.refetch();
    precedentsState.refetch();
  };

  // Write Action Executor
  const runWrite = async (
    targetAddr: string,
    method: string,
    args: any[] = [],
    valueWei: bigint = 0n
  ) => {
    if (!connectedAccount) return;
    setIsExecuting(true);
    try {
      await executeWriteTransaction(
        connectedAccount,
        targetAddr,
        method,
        args,
        valueWei,
        (st) => setTxStatus(st)
      );
      refetchAll();
    } catch (err: any) {
      // Status stream handles error display
    } finally {
      setIsExecuting(false);
    }
  };

  // Treasury Actions
  const handleFundSubmit = async (valueWei: bigint) => {
    await runWrite(config.treasuryAddress, "fund", [], valueWei);
  };

  const handleSubmitRequest = async (amountWei: bigint, purpose: string, url1: string, url2: string, url3: string) => {
    await runWrite(config.treasuryAddress, "submit_request", [amountWei, purpose, url1, url2, url3]);
    setIsNewReqModalOpen(false);
  };

  const handleAdjudicateRequest = async (requestId: number) => {
    await runWrite(config.treasuryAddress, "adjudicate_request", [requestId]);
  };

  const handleAppealRuling = async (requestId: number, appealArg: string) => {
    await runWrite(config.treasuryAddress, "appeal_ruling", [requestId, appealArg]);
  };

  const handleExecutePayout = async (requestId: number) => {
    await runWrite(config.treasuryAddress, "execute_payout", [requestId]);
  };

  // Charter Amendment Actions
  const handleProposeAmendment = async (
    kind: number,
    targetArticleId: number,
    newText: string,
    targetMember: string,
    rationale: string
  ) => {
    await runWrite(config.charterAddress, "propose_amendment", [
      kind,
      targetArticleId,
      newText,
      targetMember,
      rationale,
    ]);
    setIsProposeModalOpen(false);
  };

  const handleVoteAmendment = async (amendmentId: number, voteYes: boolean) => {
    await runWrite(config.charterAddress, "vote_amendment", [amendmentId, voteYes]);
  };

  const handleFinalizeAmendment = async (amendmentId: number) => {
    await runWrite(config.charterAddress, "finalize_amendment", [amendmentId]);
  };

  const handleCancelAmendment = async (amendmentId: number) => {
    await runWrite(config.charterAddress, "cancel_amendment", [amendmentId]);
  };

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
            connectedAccount={connectedAccount}
            onFundSubmit={handleFundSubmit}
            isExecuting={isExecuting}
          />
        )}

        {activeTab === "requests" && (
          <RequestsView
            requests={requestsState.requests}
            loading={requestsState.loading}
            error={requestsState.error}
            onRetry={requestsState.refetch}
            onSelectArticleAnchor={handleSelectArticleAnchor}
            connectedAccount={connectedAccount}
            onOpenNewRequestModal={() => setIsNewReqModalOpen(true)}
            onAdjudicateRequest={handleAdjudicateRequest}
            onAppealRuling={handleAppealRuling}
            onExecutePayout={handleExecutePayout}
            isExecuting={isExecuting}
          />
        )}

        {activeTab === "amendments" && (
          <AmendmentsView
            amendments={amendmentsState.amendments}
            loading={amendmentsState.loading}
            error={amendmentsState.error}
            onRetry={amendmentsState.refetch}
            connectedAccount={connectedAccount}
            memberCount={dashboardState.data?.charterCounts.members || 1}
            onOpenProposeModal={() => setIsProposeModalOpen(true)}
            onVoteAmendment={handleVoteAmendment}
            onFinalizeAmendment={handleFinalizeAmendment}
            onCancelAmendment={handleCancelAmendment}
            isExecuting={isExecuting}
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

      <NewRequestModal
        isOpen={isNewReqModalOpen}
        onClose={() => setIsNewReqModalOpen(false)}
        onSubmitRequest={handleSubmitRequest}
        isExecuting={isExecuting}
        connectedAccount={connectedAccount}
      />

      <ProposeAmendmentModal
        isOpen={isProposeModalOpen}
        onClose={() => setIsProposeModalOpen(false)}
        activeArticles={dashboardState.data?.charterBundle.articles || []}
        onSubmitPropose={handleProposeAmendment}
        isExecuting={isExecuting}
        connectedAccount={connectedAccount}
      />

      <TransactionStatusModal
        status={txStatus}
        onClose={() => setTxStatus(null)}
      />

      <Footer />
    </div>
  );
};

export default App;
