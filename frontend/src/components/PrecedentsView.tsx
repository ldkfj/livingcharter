import React from "react";
import { PrecedentInfo } from "../types/contract";
import { formatWeiToGen, formatTimestamp } from "../lib/formatters";
import { ScrollText, RefreshCw, ChevronDown, ShieldAlert } from "lucide-react";

interface PrecedentsViewProps {
  precedents: PrecedentInfo[];
  totalCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectArticleAnchor?: (articleId: number) => void;
}

export const PrecedentsView: React.FC<PrecedentsViewProps> = ({
  precedents,
  totalCount,
  hasMore,
  onLoadMore,
  loading,
  error,
  onRetry,
  onSelectArticleAnchor,
}) => {
  const getDecisionBadgeClass = (decisionName: string) => {
    switch (decisionName?.toUpperCase()) {
      case "APPROVE": return "badge-approve";
      case "PARTIAL": return "badge-partial";
      case "DENY": return "badge-deny";
      default: return "badge-state";
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><ScrollText size={20} /><span>Precedent Rulings Log</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton-box" style={{ height: "70px" }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card state-error">
        <p>{error}</p>
        <button className="btn-retry" onClick={onRetry} type="button" style={{ marginTop: "1rem" }}>
          <RefreshCw size={16} /><span>Retry Precedents</span>
        </button>
      </div>
    );
  }

  if (!precedents || precedents.length === 0) {
    return (
      <div className="card state-empty">
        <ScrollText size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
        <h3>No Precedent Rulings Recorded Yet</h3>
        <p style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
          As spend requests are adjudicated by GenLayer non-deterministic consensus, consensus precedent summaries will be recorded here to guide future rulings.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <ScrollText size={20} style={{ color: "var(--accent-rose)" }} />
          <span>Precedent Rulings Log ({totalCount})</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {precedents.map((p) => (
          <div
            key={p.seq}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                  Precedent #{p.seq}
                </span>
                <span className={`badge ${getDecisionBadgeClass(p.decision_name)}`}>
                  {p.decision_name}
                </span>
                {p.is_appeal && (
                  <span className="badge" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc" }}>
                    <ShieldAlert size={12} />
                    <span>Appeal Ruling</span>
                  </span>
                )}
              </div>

              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Charter v{p.charter_version} • {formatTimestamp(p.created_at)}
              </span>
            </div>

            <p style={{ fontSize: "0.92rem", color: "var(--text-primary)", fontWeight: 500, marginBottom: "0.75rem" }}>
              "{p.summary}"
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.82rem" }}>
              <div style={{ color: "var(--text-muted)" }}>
                <span>Request #{p.request_id} • </span>
                <span>Requested: {formatWeiToGen(p.requested_wei)} GEN • </span>
                <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>Approved: {formatWeiToGen(p.approved_wei)} GEN</span>
              </div>

              {p.cited_article_ids && p.cited_article_ids.length > 0 && (
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {p.cited_article_ids.map((id) => (
                    <a
                      key={id}
                      href={`#article-${id}`}
                      onClick={() => onSelectArticleAnchor && onSelectArticleAnchor(id)}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        color: "var(--accent-primary)",
                        background: "rgba(99, 102, 241, 0.12)",
                        padding: "0.15rem 0.4rem",
                        borderRadius: "4px",
                        textDecoration: "none",
                      }}
                    >
                      #article-{id}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {hasMore && (
          <button
            className="btn-retry"
            onClick={onLoadMore}
            type="button"
            style={{ margin: "1rem auto 0", background: "var(--bg-surface-hover)" }}
          >
            <ChevronDown size={16} />
            <span>Load More Precedents</span>
          </button>
        )}
      </div>
    </div>
  );
};
