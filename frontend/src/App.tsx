import React, { useState } from "react";
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

export const App: React.FC = () => {
  const { config, errors } = getEnvConfig();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

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
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

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
            loadingMore={precedentsState.loadingMore}
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
