import React, { useState } from "react";
import { DashboardData } from "../hooks/useContractData";
import { formatWeiToGen, truncateAddress } from "../lib/formatters";
import { CharterPanel } from "./CharterPanel";
import { FundForm } from "./FundForm";
import type { WriteResult } from "../lib/txEngine";
import {
  Coins,
  ShieldCheck,
  Users,
  BookOpen,
  Vote,
  FileText,
  ScrollText,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface DashboardViewProps {
  charterAddress: string;
  treasuryAddress: string;
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  connectedAccount?: string | null;
  onFundSubmit?: (valueWei: bigint) => Promise<WriteResult>;
  isExecuting?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  charterAddress,
  treasuryAddress,
  data,
  loading,
  error,
  onRetry,
  connectedAccount = null,
  onFundSubmit,
  isExecuting = false,
}) => {
  const [copiedCharter, setCopiedCharter] = useState(false);
  const [copiedTreasury, setCopiedTreasury] = useState(false);

  const copyToClipboard = (text: string, type: "charter" | "treasury") => {
    navigator.clipboard.writeText(text);
    if (type === "charter") {
      setCopiedCharter(true);
      setTimeout(() => setCopiedCharter(false), 2000);
    } else {
      setCopiedTreasury(true);
      setTimeout(() => setCopiedTreasury(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="stat-grid">
          <div className="stat-card"><div className="skeleton-box" style={{ width: "100%", height: "40px" }} /></div>
          <div className="stat-card"><div className="skeleton-box" style={{ width: "100%", height: "40px" }} /></div>
          <div className="stat-card"><div className="skeleton-box" style={{ width: "100%", height: "40px" }} /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card state-error">
        <h3>Dashboard Error</h3>
        <p>{error}</p>
        <button className="btn-retry" onClick={onRetry} type="button" style={{ marginTop: "1rem" }}>
          <RefreshCw size={16} />
          <span>Retry Loading Live Data</span>
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { charterBundle, charterCounts, treasuryState } = data;
  const genBalance = formatWeiToGen(treasuryState.balance_wei);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Address Banner */}
      <div className="address-banner">
        <div className="address-item">
          <div className="address-item-header">
            <span>CHARTER CONTRACT (STUDIONET)</span>
            <a
              href={`https://explorer-studio.genlayer.com/address/${charterAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon"
              title="View on GenLayer Explorer"
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="address-value-row">
            <span className="address-hex" title={charterAddress}>
              {truncateAddress(charterAddress)} ({charterAddress})
            </span>
            <button
              className="btn-icon"
              onClick={() => copyToClipboard(charterAddress, "charter")}
              title="Copy Charter Address"
              type="button"
            >
              {copiedCharter ? <Check size={14} style={{ color: "var(--accent-emerald)" }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="address-item">
          <div className="address-item-header">
            <span>TREASURY CONTRACT (STUDIONET)</span>
            <a
              href={`https://explorer-studio.genlayer.com/address/${treasuryAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon"
              title="View on GenLayer Explorer"
            >
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="address-value-row">
            <span className="address-hex" title={treasuryAddress}>
              {truncateAddress(treasuryAddress)} ({treasuryAddress})
            </span>
            <button
              className="btn-icon"
              onClick={() => copyToClipboard(treasuryAddress, "treasury")}
              title="Copy Treasury Address"
              type="button"
            >
              {copiedTreasury ? <Check size={14} style={{ color: "var(--accent-emerald)" }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Fund Deposit Form */}
      {onFundSubmit && (
        <FundForm
          connectedAccount={connectedAccount}
          onFundSubmit={onFundSubmit}
          isExecuting={isExecuting}
        />
      )}

      {/* Stat Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--accent-emerald)" }}>
            <Coins size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{genBalance} GEN</div>
            <div className="stat-label">Treasury Balance</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--accent-primary)" }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">Version {charterCounts.charter_version}</div>
            <div className="stat-label">Charter Version</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(6, 182, 212, 0.12)", color: "var(--accent-cyan)" }}>
            <BookOpen size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{charterCounts.articles}</div>
            <div className="stat-label">Active Articles</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "var(--accent-amber)" }}>
            <Users size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{charterCounts.members}</div>
            <div className="stat-label">Active Members</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#c084fc" }}>
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{treasuryState.request_count}</div>
            <div className="stat-label">Spend Requests</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(244, 63, 94, 0.12)", color: "var(--accent-rose)" }}>
            <ScrollText size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{treasuryState.precedent_count}</div>
            <div className="stat-label">Recorded Precedents</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(255, 255, 255, 0.08)", color: "var(--text-secondary)" }}>
            <Vote size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{charterCounts.amendments}</div>
            <div className="stat-label">Amendments</div>
          </div>
        </div>
      </div>

      {/* Charter Panel */}
      <CharterPanel
        articles={charterBundle.articles}
        charterVersion={charterBundle.charter_version}
        loading={false}
        error={null}
      />
    </div>
  );
};
