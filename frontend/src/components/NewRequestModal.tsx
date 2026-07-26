import React, { useState, useRef } from "react";
import { FileText, X, Send, AlertCircle, Plus, Trash2 } from "lucide-react";
import {
  parseGenToWei,
  validateRequestAmount,
  validatePurpose,
  validateEvidenceUrls,
} from "../lib/validators";
import type { WriteResult } from "../lib/txEngine";

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitRequest: (amountWei: bigint, purpose: string, url1: string, url2: string, url3: string) => Promise<WriteResult>;
  isExecuting: boolean;
  connectedAccount: string | null;
  treasuryBalanceWei: bigint | null;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmitRequest,
  isExecuting,
  connectedAccount,
  treasuryBalanceWei,
}) => {
  const [amountStr, setAmountStr] = useState("0.05");
  const [purpose, setPurpose] = useState("");
  const [urls, setUrls] = useState<string[]>(["https://"]);
  const [formError, setFormError] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const purposeRef = useRef<HTMLTextAreaElement>(null);
  const urlRef0 = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddUrlField = () => {
    if (urls.length < 3) {
      setUrls([...urls, "https://"]);
    }
  };

  const handleRemoveUrlField = (idx: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== idx));
    }
  };

  const handleUrlChange = (idx: number, val: string) => {
    const updated = [...urls];
    updated[idx] = val;
    setUrls(updated);
  };

  const handleClose = () => {
    if (purpose.trim().length > 0 || urls.some((u) => u !== "https://" && u.trim() !== "")) {
      if (!window.confirm("Discard unsaved spend request draft?")) {
        return;
      }
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Validate Amount
    const amtErr =
      treasuryBalanceWei === null
        ? "E_BALANCE_UNAVAILABLE: Treasury balance is not available. Retry the dashboard read before submitting."
        : validateRequestAmount(amountStr, treasuryBalanceWei);
    if (amtErr) {
      setFormError(amtErr);
      if (amountRef.current) amountRef.current.focus();
      return;
    }

    // 2. Validate Purpose
    const purpErr = validatePurpose(purpose);
    if (purpErr) {
      setFormError(purpErr);
      if (purposeRef.current) purposeRef.current.focus();
      return;
    }

    // 3. Validate Evidence URLs
    const urlErr = validateEvidenceUrls(urls);
    if (urlErr) {
      setFormError(urlErr);
      if (urlRef0.current) urlRef0.current.focus();
      return;
    }

    try {
      const amountWei = parseGenToWei(amountStr);
      const activeUrls = urls.map((u) => u.trim()).filter((u) => u.length > 0);
      const url1 = activeUrls[0] || "";
      const url2 = activeUrls[1] || "";
      const url3 = activeUrls[2] || "";

      const result = await onSubmitRequest(amountWei, purpose.trim(), url1, url2, url3);
      if (result.kind === "failed") {
        setFormError(result.error);
      }
    } catch (err: any) {
      setFormError(err?.message || "Failed to submit request.");
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
        style={{ maxWidth: "620px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="new-request-title"
      >
        <div className="card-header">
          <div className="card-title" id="new-request-title">
            <FileText size={22} style={{ color: "var(--accent-cyan)" }} />
            <span>Submit LivingCharter Spend Request</span>
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

          {/* Amount Field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label htmlFor="req-amount-input" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Requested Reimbursement Amount (GEN)
            </label>
            <input
              id="req-amount-input"
              ref={amountRef}
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 0.05"
              disabled={isExecuting || !connectedAccount}
              autoComplete="off"
              style={{
                width: "100%",
                padding: "0.65rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          {/* Purpose Field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <label htmlFor="req-purpose-input" style={{ fontWeight: 500 }}>Purpose Statement (10–600 chars)</label>
              <span style={{ color: purpose.length > 600 ? "var(--accent-rose)" : "var(--text-muted)" }}>
                {purpose.length}/600
              </span>
            </div>
            <textarea
              id="req-purpose-input"
              ref={purposeRef}
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe your reimbursement request, e.g. Conference ticket purchased for software workshop."
              disabled={isExecuting || !connectedAccount}
              autoComplete="off"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
                fontSize: "0.9rem",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Evidence URLs Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                Public Verifiable Evidence URLs (1 to 3 URLs)
              </label>
              {urls.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddUrlField}
                  disabled={isExecuting}
                  className="nav-btn"
                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.78rem" }}
                >
                  <Plus size={12} />
                  <span>Add URL</span>
                </button>
              )}
            </div>

            {urls.map((urlVal, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  ref={idx === 0 ? urlRef0 : undefined}
                  type="url"
                  value={urlVal}
                  onChange={(e) => handleUrlChange(idx, e.target.value)}
                  placeholder="https://example.com/vendor-page"
                  disabled={isExecuting || !connectedAccount}
                  autoComplete="off"
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--accent-cyan)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
                {urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveUrlField(idx)}
                    disabled={isExecuting}
                    className="btn-icon"
                    title="Remove URL field"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
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
              style={{ padding: "0.6rem 1.5rem" }}
            >
              <Send size={16} />
              <span>{isExecuting ? "Submitting..." : "Submit Spend Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
