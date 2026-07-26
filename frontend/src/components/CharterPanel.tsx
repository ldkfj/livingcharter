import React from "react";
import { CharterArticle } from "../types/contract";
import { BookOpen, ShieldCheck } from "lucide-react";

interface CharterPanelProps {
  articles: CharterArticle[];
  charterVersion: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const CharterPanel: React.FC<CharterPanelProps> = ({
  articles,
  charterVersion,
  loading = false,
  error = null,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <BookOpen size={20} className="text-primary" />
            <span>Ratified Living Charter</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton-box" style={{ height: "80px" }} />
          <div className="skeleton-box" style={{ height: "80px" }} />
          <div className="skeleton-box" style={{ height: "80px" }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card state-error">
        <p>{error}</p>
        {onRetry && (
          <button className="btn-retry" onClick={onRetry} type="button">
            Retry Loading Charter
          </button>
        )}
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="card state-empty">
        <BookOpen size={36} style={{ margin: "0 auto 0.5rem" }} />
        <p>No active charter articles ratified yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <BookOpen size={20} style={{ color: "var(--accent-primary)" }} />
          <span>Ratified Living Charter</span>
        </div>
        <div className="badge badge-version">
          <ShieldCheck size={14} />
          <span>Version {charterVersion}</span>
        </div>
      </div>

      <div className="articles-list" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {articles.map((art) => (
          <article
            key={art.id}
            id={`article-${art.id}`}
            className="article-card"
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
              transition: "border-color 0.2s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: "var(--accent-cyan)",
                    fontSize: "0.95rem",
                  }}
                >
                  Article {art.id}
                </span>
                <span
                  className="badge"
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "var(--text-muted)",
                    fontSize: "0.7rem",
                  }}
                >
                  v{art.version}
                </span>
              </div>

              <a
                href={`#article-${art.id}`}
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
                title="Direct link to Article"
              >
                #article-{art.id}
              </a>
            </div>

            <p
              style={{
                color: "var(--text-primary)",
                lineHeight: "1.65",
                fontSize: "0.95rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {art.text}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
};
