import React, { useState } from "react";
import { RequestInfo, RulingInfo } from "../types/contract";
import { formatWeiToGen, truncateAddress, formatTimestamp } from "../lib/formatters";
import { FileText, Copy, Check, ExternalLink, RefreshCw, X, ChevronRight } from "lucide-react";

interface RequestsViewProps {
  requests: RequestInfo[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectArticleAnchor?: (articleId: number) => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  loading,
  error,
  onRetry,
  onSelectArticleAnchor,
}) => {
  const [selectedReq, setSelectedReq] = useState<RequestInfo | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(text);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const getStateBadgeClass = (stateName: string) => {
    switch (stateName?.toUpperCase()) {
      case "SUBMITTED": return "badge-state-submitted";
      case "RULED": return "badge-state-ruled";
      case "APPEALED": return "badge-state-appealed";
      case "FINAL_RULED": return "badge-state-final_ruled";
      case "PAID": return "badge-state-paid";
      case "CLOSED": return "badge-state-closed";
      case "UNDETERMINED": return "badge-state-undetermined";
      case "FAILED": return "badge-state-failed";
      default: return "badge-state";
    }
  };

  const getDecisionBadgeClass = (decisionName: string) => {
    switch (decisionName?.toUpperCase()) {
      case "APPROVE": return "badge-approve";
      case "PARTIAL": return "badge-partial";
      case "DENY": return "badge-deny";
      default: return "badge-state";
    }
  };

  const renderRulingCard = (title: string, ruling: RulingInfo) => {
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "1rem 1.25rem",
          marginTop: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--accent-cyan)" }}>{title}</span>
          <span className={`badge ${getDecisionBadgeClass(ruling.decision_name)}`}>
            {ruling.decision_name}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.88rem" }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Approved Amount: </span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {formatWeiToGen(ruling.approved_amount_wei)} GEN
            </span>
          </div>

          <div>
            <span style={{ color: "var(--text-muted)" }}>AI Reason: </span>
            <p style={{ color: "var(--text-primary)", fontStyle: "italic", marginTop: "0.2rem", background: "rgba(0,0,0,0.2)", padding: "0.6rem", borderRadius: "var(--radius-sm)" }}>
              "{ruling.reason}"
            </p>
          </div>

          {ruling.cited_article_ids && ruling.cited_article_ids.length > 0 && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>Cited Charter Articles: </span>
              <div style={{ display: "inline-flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                {ruling.cited_article_ids.map((id) => (
                  <a
                    key={id}
                    href={`#article-${id}`}
                    onClick={() => onSelectArticleAnchor && onSelectArticleAnchor(id)}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.78rem",
                      color: "var(--accent-primary)",
                      background: "rgba(99, 102, 241, 0.12)",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "4px",
                      textDecoration: "none",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    Article #{id}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><FileText size={20} /><span>Spend Requests</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton-box" style={{ height: "60px" }} />
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
          <RefreshCw size={16} /><span>Retry Requests</span>
        </button>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="card state-empty">
        <FileText size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
        <h3>No Spend Requests Submitted Yet</h3>
        <p style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
          The treasury request ledger is currently empty on Studionet. New member spend proposals will appear here live.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileText size={20} style={{ color: "var(--accent-cyan)" }} />
            <span>Treasury Spend Requests ({requests.length})</span>
          </div>
        </div>

        <div className="requests-table-container" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase" }}>
                <th style={{ padding: "0.75rem 1rem" }}>ID</th>
                <th style={{ padding: "0.75rem 1rem" }}>Requester</th>
                <th style={{ padding: "0.75rem 1rem" }}>Amount</th>
                <th style={{ padding: "0.75rem 1rem" }}>State</th>
                <th style={{ padding: "0.75rem 1rem" }}>Created (UTC)</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr
                  key={req.id}
                  style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.2s ease" }}
                >
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>#{req.id}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{truncateAddress(req.requester)}</span>
                      <button
                        className="btn-icon"
                        onClick={() => copyToClipboard(req.requester)}
                        title="Copy Requester Address"
                        type="button"
                      >
                        {copiedAddr === req.requester ? <Check size={12} style={{ color: "var(--accent-emerald)" }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "var(--accent-emerald)" }}>
                    {formatWeiToGen(req.amount_wei)} GEN
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span className={`badge ${getStateBadgeClass(req.state_name)}`}>
                      {req.state_name}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    {formatTimestamp(req.created_at)}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                    <button
                      className="nav-btn"
                      onClick={() => setSelectedReq(req)}
                      type="button"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", marginLeft: "auto" }}
                    >
                      <span>View Details</span>
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Detail Modal */}
      {selectedReq && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            zIndex: 200,
          }}
          onClick={() => setSelectedReq(null)}
        >
          <div
            className="card"
            style={{ maxWidth: "650px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <div className="card-title">
                <FileText size={22} style={{ color: "var(--accent-cyan)" }} />
                <span>Request #{selectedReq.id} Lifecycle & Adjudication</span>
              </div>
              <button className="btn-icon" onClick={() => setSelectedReq(null)} type="button">
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={`badge ${getStateBadgeClass(selectedReq.state_name)}`}>
                  State: {selectedReq.state_name}
                </span>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-emerald)" }}>
                  {formatWeiToGen(selectedReq.amount_wei)} GEN
                </span>
              </div>

              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Purpose Statement</span>
                <p style={{ marginTop: "0.25rem", color: "var(--text-primary)", background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  {selectedReq.purpose}
                </p>
              </div>

              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Evidence URLs</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.3rem" }}>
                  {selectedReq.evidence_urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--accent-cyan)",
                        fontSize: "0.85rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        textDecoration: "none",
                        wordBreak: "break-all",
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>{url}</span>
                    </a>
                  ))}
                </div>
              </div>

              {selectedReq.initial_ruling && renderRulingCard("Initial Ruling", selectedReq.initial_ruling)}
              {selectedReq.appeal_ruling && renderRulingCard("Appeal Ruling", selectedReq.appeal_ruling)}

              {selectedReq.appealed && (
                <div style={{ background: "rgba(168, 85, 247, 0.06)", border: "1px solid rgba(168, 85, 247, 0.2)", borderRadius: "var(--radius-md)", padding: "1rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#c084fc" }}>APPEAL FILED</span>
                  <p style={{ fontSize: "0.88rem", marginTop: "0.3rem" }}>{selectedReq.appeal_argument}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
