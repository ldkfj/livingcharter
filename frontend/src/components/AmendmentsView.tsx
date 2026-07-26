import React, { useState } from "react";
import { AmendmentInfo } from "../types/contract";
import { truncateAddress, formatTimestamp } from "../lib/formatters";
import { Vote, Copy, Check, RefreshCw } from "lucide-react";

const AMENDMENT_KIND_NAMES = [
  "ADD_ARTICLE",
  "REPLACE_ARTICLE",
  "REPEAL_ARTICLE",
  "ADD_MEMBER",
  "REMOVE_MEMBER",
] as const;

function getKindName(kind: number): string {
  return AMENDMENT_KIND_NAMES[kind] ?? `UNKNOWN_KIND_${kind}`;
}

function renderTarget(amendment: AmendmentInfo): React.ReactNode {
  if (amendment.kind === 0) {
    return (
      <>
        <strong>New article:</strong> {amendment.new_text}
      </>
    );
  }

  if (amendment.kind === 1) {
    return (
      <>
        <strong>Replace Article {amendment.target_article_id}:</strong> {amendment.new_text}
      </>
    );
  }

  if (amendment.kind === 2) {
    return <strong>Repeal Article {amendment.target_article_id}</strong>;
  }

  if (amendment.kind === 3 || amendment.kind === 4) {
    return (
      <>
        <strong>{amendment.kind === 3 ? "Add member:" : "Remove member:"}</strong>{" "}
        <span style={{ fontFamily: "var(--font-mono)" }}>{amendment.target_member}</span>
      </>
    );
  }

  return <span>Unknown amendment target</span>;
}

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
                  {getKindName(am.kind)}
                </span>
                <span className="badge badge-state">{am.state_name}</span>
              </div>

              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Deadline: {formatTimestamp(am.deadline)}
              </span>
            </div>

            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              {renderTarget(am)}
            </p>

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
                <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>YES: {am.yes}</span>
                <span style={{ color: "var(--accent-rose)", fontWeight: 600 }}>NO: {am.no}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
