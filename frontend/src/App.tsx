import React, { useState } from "react";
import { getEnvConfig } from "./config/env";
import { EnvGuardFallback } from "./components/EnvGuard";
import { Header, TabType } from "./components/Header";
import { Footer } from "./components/Footer";

export const App: React.FC = () => {
  const { config, errors } = getEnvConfig();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  if (!config || errors.length > 0) {
    return <EnvGuardFallback errors={errors} />;
  }

  return (
    <div className="app-shell">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="app-main">
        <section>
          <h2>LivingCharter Phase 4 Scaffold</h2>
          <p>Dev Environment Active with Real Addresses.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default App;
