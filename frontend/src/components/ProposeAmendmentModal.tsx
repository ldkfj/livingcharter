import React, { useState, useRef } from "react";
import { Vote, X, Send, AlertCircle, Eye } from "lucide-react";
import { CharterArticle } from "../types/contract";
import {
  validateRationale,
  validateNewText,
  validateAddressHex,
} from "../lib/validators";

interface ProposeAmendmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeArticles: CharterArticle[];
  onSubmitPropose: (
    kind: number,
    targetArticleId: number,
    newText: string,
    targetMember: string,
    rationale: string
  ) => Promise<void>;
  isExecuting: boolean;
  connectedAccount: string | null;
}

export const ProposeAmendmentModal: React.FC<ProposeAmendmentModalProps> = ({
  isOpen,
  onClose,
  activeArticles,
  onSubmitPropose,
  isExecuting,
  connectedAccount,
}) => {
  const [kind, setKind] = useState<number>(0);
  const [targetArticleId, setTargetArticleId] = useState<number>(activeArticles[0]?.id || 1);
  const [newText, setNewText] = useState("");
  const [targetMember, setTargetMember] = useState("");
  const [rationale, setRationale] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const newTextRef = useRef<HTMLTextAreaElement>(null);
  const targetMemberRef = useRef<HTMLInputElement>(null);
  const rationaleRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (newText.trim().length > 0 || targetMember.trim().length > 0 || rationale.trim().length > 0) {
      if (!window.confirm("Discard unsaved amendment proposal draft?")) {
        return;
      }
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Validate contextual fields per kind
    if (kind === 0 || kind === 1) { // ADD_ARTICLE or REPLACE_ARTICLE
      const txtErr = validateNewText(newText);
      if (txtErr) {
        setFormError(txtErr);
        if (newTextRef.current) newTextRef.current.focus();
        return;
      }
    }

    if (kind === 3 || kind === 4) { // ADD_MEMBER or REMOVE_MEMBER
      const addrErr = validateAddressHex(targetMember);
      if (addrErr) {
        setFormError(addrErr);
        if (targetMemberRef.current) targetMemberRef.current.focus();
        return;
      }
    }

    // 2. Validate Rationale
    const ratErr = validateRationale(rationale);
    if (ratErr) {
      setFormError(ratErr);
      if (rationaleRef.current) rationaleRef.current.focus();
      return;
    }

    try {
      await onSubmitPropose(
        kind,
        kind === 1 || kind === 2 ? targetArticleId : 0,
        kind === 0 || kind === 1 ? newText.trim() : "",
        kind === 3 || kind === 4 ? targetMember.trim() : "",
        rationale.trim()
      );
    } catch (err: any) {
      setFormError(err?.message || "Failed to submit proposal.");
    }
  };

  return (
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
      onClick={handleClose}
    >
      <div
        className="card"
        style={{ maxWidth: "680px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="propose-modal-title"
      >
        <div className="card-header">
          <div className="card-title" id="propose-modal-title">
            <Vote size={22} style={{ color: "var(--accent-amber)" }} />
            <span>Propose LivingCharter Amendment</span>
          </div>
          <button className="btn-icon" onClick={handleClose} type="button" aria-label="Close form">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {formError && (
            <div
              style={{
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "var(--radius-md)",
                padding: "0.85rem 1rem",
                color: "var(--accent-rose)",
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {/* Kind Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label htmlFor="amend-kind-select" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Amendment Motion Kind
            </label>
            <select
              id="amend-kind-select"
              value={kind}
              onChange={(e) => setKind(Number(e.target.value))}
              disabled={isExecuting || !connectedAccount}
              style={{
                width: "100%",
                padding: "0.65rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "#121827",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                outline: "none",
              }}
            >
              <option value={0}>0: ADD_ARTICLE (Draft new charter article)</option>
              <option value={1}>1: REPLACE_ARTICLE (Update existing article text)</option>
              <option value={2}>2: REPEAL_ARTICLE (Repeal active article)</option>
              <option value={3}>3: ADD_MEMBER (Grant active voting member status)</option>
              <option value={4}>4: REMOVE_MEMBER (Revoke member status)</option>
            </select>
          </div>

          {/* Contextual Inputs */}
          {(kind === 1 || kind === 2) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label htmlFor="target-article-select" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                Target Article
              </label>
              <select
                id="target-article-select"
                value={targetArticleId}
                onChange={(e) => setTargetArticleId(Number(e.target.value))}
                disabled={isExecuting || !connectedAccount}
                style={{
                  width: "100%",
                  padding: "0.65rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: "#121827",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              >
                {activeArticles.map((art) => (
                  <option key={art.id} value={art.id}>
                    Article #{art.id} (v{art.version}): {art.text.slice(0, 60)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          {(kind === 0 || kind === 1) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <label htmlFor="new-text-input" style={{ fontWeight: 500 }}>New Article Text (20–2000 chars)</label>
                <span style={{ color: newText.length > 2000 ? "var(--accent-rose)" : "var(--text-muted)" }}>{newText.length}/2000</span>
              </div>
              <textarea
                id="new-text-input"
                ref={newTextRef}
                rows={4}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Write the full ratified article text..."
                disabled={isExecuting || !connectedAccount}
                autoComplete="off"
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  outline: "none",
                  resize: "vertical",
                }}
              />

              {/* Live Preview Panel */}
              {newText.trim().length >= 20 && (
                <div style={{ background: "rgba(99, 102, 241, 0.05)", border: "1px dashed var(--border-accent)", borderRadius: "var(--radius-md)", padding: "1rem", marginTop: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--accent-primary)", fontWeight: 600, marginBottom: "0.4rem" }}>
                    <Eye size={14} />
                    <span>Live Article Preview</span>
                  </div>
                  <p style={{ fontSize: "0.9rem", lineHeight: "1.6", color: "var(--text-primary)" }}>{newText}</p>
                </div>
              )}
            </div>
          )}

          {(kind === 3 || kind === 4) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label htmlFor="target-member-input" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                Target Member Hex Address (0x...)
              </label>
              <input
                id="target-member-input"
                ref={targetMemberRef}
                type="text"
                value={targetMember}
                onChange={(e) => setTargetMember(e.target.value)}
                placeholder="0x0D22C5298ad1437DB715A543B485588a8e0fc9DB"
                disabled={isExecuting || !connectedAccount}
                autoComplete="off"
                style={{
                  width: "100%",
                  padding: "0.65rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--accent-cyan)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.88rem",
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* Rationale Field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <label htmlFor="amend-rationale-input" style={{ fontWeight: 500 }}>Rationale Statement (≤500 chars)</label>
              <span style={{ color: rationale.length > 500 ? "var(--accent-rose)" : "var(--text-muted)" }}>{rationale.length}/500</span>
            </div>
            <textarea
              id="amend-rationale-input"
              ref={rationaleRef}
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Explain why this amendment is necessary for living governance..."
              disabled={isExecuting || !connectedAccount}
              autoComplete="off"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button className="btn-icon" onClick={handleClose} type="button" style={{ padding: "0.6rem 1.25rem" }}>
              Cancel
            </button>
            <button
              className="btn-retry"
              type="submit"
              disabled={isExecuting || !connectedAccount}
              style={{ padding: "0.6rem 1.5rem", background: "var(--accent-amber)" }}
            >
              <Send size={16} />
              <span>{isExecuting ? "Proposing..." : "Propose Amendment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
