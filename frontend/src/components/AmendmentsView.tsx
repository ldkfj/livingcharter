import React, { useState } from "react";
import { AmendmentInfo } from "../types/contract";
import { truncateAddress, formatTimestamp } from "../lib/formatters";
import { Vote, Copy, Check, RefreshCw } from "lucide-react";

interface AmendmentsViewProps {
  amendments: AmendmentInfo[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const AmendmentsView: React.FC<AmendmentsViewProps> = ({
  amendments,
  loading,
  error,
  onRetry,
}) => {
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(text);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><Vote size={20} /><span>Charter Amendments</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton-box" style={{ height: "60px" }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card state-error">
        <p>{error}</p>
        <button className="btn-retry" onClick={onRetry} type="button" style={{ marginTop: "1rem" }}>
          <RefreshCw size={16} /><span>Retry Amendments</span>
        </button>
      </div>
    );
  }

  if (!amendments || amendments.length === 0) {
    return (
      <div className="card state-empty">
        <Vote size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
        <h3>No Amendments Proposed Yet</h3>
        <p style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
          The living charter has not received any amendment motions on Studionet. Proposed article changes or membership motions will appear here live.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Vote size={20} style={{ color: "var(--accent-amber)" }} />
          <span>Charter Amendments ({amendments.length})</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {amendments.map((am) => (
          <div
            key={am.id}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>Motion #{am.id}</span>
                <span className="badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fcd34d" }}>
                  {am.kind_name}
                </span>
                <span className="badge badge-state">{am.state_name}</span>
              </div>

              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Deadline: {formatTimestamp(am.voting_deadline)}
              </span>
            </div>

            <p style={{ fontSize: "0.92rem", color: "var(--text-primary)", marginBottom: "0.75rem" }}>
              {am.rationale}
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>Proposer: {truncateAddress(am.proposer)}</span>
                <button className="btn-icon" onClick={() => copyToClipboard(am.proposer)} type="button">
                  {copiedAddr === am.proposer ? <Check size={12} style={{ color: "var(--accent-emerald)" }} /> : <Copy size={12} />}
                </button>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>YES: {am.yes_votes}</span>
                <span style={{ color: "var(--accent-rose)", fontWeight: 600 }}>NO: {am.no_votes}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
