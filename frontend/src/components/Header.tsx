import React, { useState } from "react";
import { Scale, LayoutDashboard, FileText, Vote, ScrollText, Wallet, LogOut, ExternalLink, AlertCircle } from "lucide-react";
import { truncateAddress } from "../lib/formatters";

export type TabType = "dashboard" | "requests" | "amendments" | "precedents";

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  connectedAccount: string | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  isConnecting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  connectedAccount,
  onConnectWallet,
  onDisconnectWallet,
  isConnecting = false,
}) => {
  const [showNoWalletModal, setShowNoWalletModal] = useState(false);

  const handleConnectClick = () => {
    if (typeof window !== "undefined" && !(window as any).ethereum) {
      setShowNoWalletModal(true);
      return;
    }
    onConnectWallet();
  };

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand" onClick={() => onTabChange("dashboard")} style={{ cursor: "pointer" }}>
          <div className="brand-logo">
            <Scale size={26} className="brand-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-title">LivingCharter</span>
            <span className="brand-subtitle">AI Governance & Treasury Protocol</span>
          </div>
        </div>

        <nav className="header-nav" aria-label="Main Navigation">
          <button
            className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => onTabChange("dashboard")}
            aria-selected={activeTab === "dashboard"}
            type="button"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-btn ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => onTabChange("requests")}
            aria-selected={activeTab === "requests"}
            type="button"
          >
            <FileText size={18} />
            <span>Requests</span>
          </button>

          <button
            className={`nav-btn ${activeTab === "amendments" ? "active" : ""}`}
            onClick={() => onTabChange("amendments")}
            aria-selected={activeTab === "amendments"}
            type="button"
          >
            <Vote size={18} />
            <span>Amendments</span>
          </button>

          <button
            className={`nav-btn ${activeTab === "precedents" ? "active" : ""}`}
            onClick={() => onTabChange("precedents")}
            aria-selected={activeTab === "precedents"}
            type="button"
          >
            <ScrollText size={18} />
            <span>Precedents</span>
          </button>
        </nav>

        <div className="wallet-header-controls">
          {connectedAccount ? (
            <div className="wallet-connected-badge" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#6ee7b7",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10b981",
                  }}
                />
                <span>{truncateAddress(connectedAccount)}</span>
              </div>

              <button
                className="btn-icon"
                onClick={onDisconnectWallet}
                title="Disconnect Wallet"
                type="button"
                aria-label="Disconnect Wallet"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              className="btn-retry"
              onClick={handleConnectClick}
              disabled={isConnecting}
              type="button"
              style={{ padding: "0.55rem 1.1rem", fontSize: "0.88rem" }}
            >
              <Wallet size={16} />
              <span>{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
            </button>
          )}
        </div>
      </div>

      {/* No Wallet Warning Modal */}
      {showNoWalletModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            zIndex: 300,
          }}
          onClick={() => setShowNoWalletModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: "var(--accent-amber)", marginBottom: "1rem" }}>
              <AlertCircle size={48} style={{ margin: "0 auto" }} />
            </div>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>EIP-1193 Browser Wallet Required</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "1.5rem" }}>
              LivingCharter requires an EIP-1193 browser extension wallet (such as MetaMask or Rabby) to sign transactions on GenLayer Studionet. No wallet was detected in your browser window.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-retry"
                style={{ textDecoration: "none" }}
              >
                <ExternalLink size={16} />
                <span>Get MetaMask Wallet</span>
              </a>
              <button
                className="btn-icon"
                onClick={() => setShowNoWalletModal(false)}
                type="button"
                style={{ padding: "0.55rem 1rem" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
