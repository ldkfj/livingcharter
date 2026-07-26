import React, { useState, useRef } from "react";
import { Coins, Send } from "lucide-react";
import { parseGenToWei, validateGenAmount } from "../lib/validators";
import type { WriteResult } from "../lib/txEngine";

interface FundFormProps {
  connectedAccount: string | null;
  onFundSubmit: (valueWei: bigint) => Promise<WriteResult>;
  isExecuting: boolean;
}

export const FundForm: React.FC<FundFormProps> = ({
  connectedAccount,
  onFundSubmit,
  isExecuting,
}) => {
  const [amountStr, setAmountStr] = useState("0.1");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    const err = validateGenAmount(amountStr);
    if (err) {
      setFieldError(err);
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    try {
      const wei = parseGenToWei(amountStr);
      const result = await onFundSubmit(wei);
      if (result.kind === "failed") {
        setFieldError(result.error);
      }
    } catch (err: any) {
      setFieldError(err?.message || "Invalid amount");
      if (inputRef.current) inputRef.current.focus();
    }
  };

  return (
    <div
      className="card"
      style={{
        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.04), rgba(99, 102, 241, 0.04))",
        border: "1px solid rgba(16, 185, 129, 0.25)",
      }}
    >
      <div className="card-header" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: "1rem" }}>
        <div className="card-title">
          <Coins size={20} style={{ color: "var(--accent-emerald)" }} />
          <span>Fund Living Treasury</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label htmlFor="fund-amount-input" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            GEN Deposit Amount (18 Decimals)
          </label>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                id="fund-amount-input"
                ref={inputRef}
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="e.g. 0.1 or 1.0"
                disabled={isExecuting || !connectedAccount}
                autoComplete="off"
                style={{
                  width: "100%",
                  padding: "0.65rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: fieldError ? "1px solid var(--accent-rose)" : "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  pointerEvents: "none",
                }}
              >
                GEN
              </span>
            </div>

            <button
              className="btn-retry"
              type="submit"
              disabled={isExecuting || !connectedAccount}
              style={{
                background: "var(--accent-emerald)",
                padding: "0.65rem 1.25rem",
                fontSize: "0.9rem",
                whiteSpace: "nowrap",
              }}
            >
              <Send size={16} />
              <span>{isExecuting ? "Processing..." : "Deposit Funds"}</span>
            </button>
          </div>

          {fieldError && (
            <span style={{ fontSize: "0.8rem", color: "var(--accent-rose)", marginTop: "0.2rem" }}>
              {fieldError}
            </span>
          )}

          {!connectedAccount && (
            <span style={{ fontSize: "0.8rem", color: "var(--accent-amber)" }}>
              Connect your EIP-1193 wallet above to deposit GEN into the treasury.
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
