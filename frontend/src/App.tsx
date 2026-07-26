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
import { createWriteClient } from "./lib/genlayerClient";
import { FRONTEND_CONTRACT_CALLS } from "./lib/contractMethods";
import {
  executeWriteTransaction,
  TxStatusState,
  type WriteResult,
} from "./lib/txEngine";

export const App: React.FC = () => {
  const calls = FRONTEND_CONTRACT_CALLS;
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
  ): Promise<WriteResult> => {
    if (!connectedAccount) {
      return { kind: "failed", error: "Connect a wallet before submitting a transaction." };
    }

    setIsExecuting(true);
    try {
      const hash = await executeWriteTransaction(
        createWriteClient(connectedAccount),
        targetAddr,
        method,
        args,
        valueWei,
        (st) => setTxStatus(st)
      );
      refetchAll();
      return { kind: "success", hash };
    } catch (err: any) {
      const error = err?.message || String(err);
      if (error === "USER_CANCELLED") {
        return { kind: "cancelled" };
      }
      return { kind: "failed", error };
    } finally {
      setIsExecuting(false);
    }
  };

  // Treasury Actions
  const handleFundSubmit = async (valueWei: bigint) => {
    return runWrite(config.treasuryAddress, calls.treasury.fund.methodName, [], valueWei);
  };

  const handleSubmitRequest = async (amountWei: bigint, purpose: string, url1: string, url2: string, url3: string) => {
    const result = await runWrite(config.treasuryAddress, calls.treasury.submitRequest.methodName, [amountWei, purpose, url1, url2, url3]);
    if (result.kind === "success") {
      setIsNewReqModalOpen(false);
    }
    return result;
  };

  const handleAdjudicateRequest = async (requestId: number) => {
    return runWrite(config.treasuryAddress, calls.treasury.adjudicateRequest.methodName, [requestId]);
  };

  const handleAppealRuling = async (requestId: number, appealArg: string) => {
    return runWrite(config.treasuryAddress, calls.treasury.appealRuling.methodName, [requestId, appealArg]);
  };

  const handleExecutePayout = async (requestId: number) => {
    return runWrite(config.treasuryAddress, calls.treasury.executePayout.methodName, [requestId]);
  };

  // Charter Amendment Actions
  const handleProposeAmendment = async (
    kind: number,
    targetArticleId: number,
    newText: string,
    targetMember: string,
    rationale: string
  ) => {
    const result = await runWrite(config.charterAddress, calls.charter.proposeAmendment.methodName, [
      kind,
      targetArticleId,
      newText,
      targetMember,
      rationale,
    ]);
    if (result.kind === "success") {
      setIsProposeModalOpen(false);
    }
    return result;
  };

  const handleVoteAmendment = async (amendmentId: number, voteYes: boolean) => {
    return runWrite(config.charterAddress, calls.charter.vote.methodName, [amendmentId, voteYes]);
  };

  const handleFinalizeAmendment = async (amendmentId: number) => {
    return runWrite(config.charterAddress, calls.charter.finalizeAmendment.methodName, [amendmentId]);
  };

  const handleCancelAmendment = async (amendmentId: number) => {
    return runWrite(config.charterAddress, calls.charter.cancelAmendment.methodName, [amendmentId]);
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
        treasuryBalanceWei={dashboardState.data?.treasuryState.balance_wei ?? null}
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
