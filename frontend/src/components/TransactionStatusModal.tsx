import React from "react";
import { TxStatusState } from "../lib/txEngine";
import { ExternalLink, CheckCircle2, AlertTriangle, RefreshCw, X, Loader2 } from "lucide-react";
import { truncateAddress } from "../lib/formatters";

interface TransactionStatusModalProps {
  status: TxStatusState | null;
  onClose: () => void;
  onRetry?: () => void;
}

export const TransactionStatusModal: React.FC<TransactionStatusModalProps> = ({
  status,
  onClose,
  onRetry,
}) => {
  if (!status || status.stage === "IDLE") return null;

  const isCancelled = status.stage === "CANCELLED";
  const isSuccess = status.stage === "FINALIZED_SUCCESS";
  const isError = status.stage === "FINALIZED_ERROR";
  const isTimeout = status.stage === "TIMEOUT";
  const isPending = !isCancelled && !isSuccess && !isError && !isTimeout;

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
        zIndex: 350,
      }}
      onClick={isPending ? undefined : onClose}
    >
      <div
        className="card"
        style={{ maxWidth: "540px", width: "100%", textAlign: "left" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="tx-modal-title"
      >
        <div className="card-header">
          <div className="card-title" id="tx-modal-title">
            {isSuccess && <CheckCircle2 size={22} style={{ color: "var(--accent-emerald)" }} />}
            {isError && <AlertTriangle size={22} style={{ color: "var(--accent-rose)" }} />}
            {isCancelled && <X size={22} style={{ color: "var(--text-muted)" }} />}
            {isTimeout && <AlertTriangle size={22} style={{ color: "var(--accent-amber)" }} />}
            {isPending && <Loader2 size={22} className="spin-icon" style={{ color: "var(--accent-cyan)" }} />}

            <span>
              {isSuccess && "Transaction Finalized & Successful"}
              {isError && "Transaction Rejection / Error"}
              {isCancelled && "Transaction Cancelled in Wallet"}
              {isTimeout && "Finalization Not Yet Confirmed"}
              {isPending && "GenLayer Network Adjudication"}
            </span>
          </div>

          {!isPending && (
            <button className="btn-icon" onClick={onClose} type="button" aria-label="Close modal">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "1rem 0 1.5rem",
            padding: "0.85rem",
            background: "rgba(0, 0, 0, 0.25)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.8rem",
          }}
        >
          <div style={{ opacity: status.stage === "WALLET_CONFIRM" ? 1 : 0.6, fontWeight: status.stage === "WALLET_CONFIRM" ? 700 : 400 }}>
            1. Wallet Confirm
          </div>
          <div>→</div>
          <div style={{ opacity: status.stage === "SUBMITTED" ? 1 : 0.6, fontWeight: status.stage === "SUBMITTED" ? 700 : 400 }}>
            2. Submitted
          </div>
          <div>→</div>
          <div style={{ opacity: status.stage === "CONSENSUS_PROGRESS" ? 1 : 0.6, fontWeight: status.stage === "CONSENSUS_PROGRESS" ? 700 : 400 }}>
            3. Consensus ({status.networkStatus || "Pending"})
          </div>
          <div>→</div>
          <div style={{ opacity: isSuccess || isError ? 1 : 0.6, fontWeight: isSuccess || isError ? 700 : 400 }}>
            4. Finalized
          </div>
        </div>

        {/* Body Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {status.txHash && (
            <div style={{ fontSize: "0.88rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Transaction Hash: </span>
              <a
                href={`https://explorer-studio.genlayer.com/tx/${status.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-cyan)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  marginLeft: "0.4rem",
                }}
              >
                <span>{truncateAddress(status.txHash)}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            <span>Elapsed Time: </span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
              {status.elapsedSeconds}s
            </span>
          </div>

          {isError && (
            <div
              tabIndex={-1}
              style={{
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                outline: "none",
              }}
            >
              {status.rawErrorCode && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", fontWeight: 700, color: "var(--accent-rose)", marginBottom: "0.3rem" }}>
                  Contract Error Code: [{status.rawErrorCode}]
                </div>
              )}
              <p style={{ color: "var(--text-primary)", fontSize: "0.9rem" }}>
                {status.errorMessage}
              </p>
            </div>
          )}

          {isCancelled && (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              The transaction proposal was cancelled in your wallet. No network fees or state changes occurred.
            </p>
          )}

          {isSuccess && (
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                color: "#6ee7b7",
                fontSize: "0.9rem",
              }}
            >
              Transaction finalized with status <strong>SUCCESS</strong> on GenLayer Studionet. Contract state and view data have been updated.
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          {isTimeout && (
            <div
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
              }}
            >
              {status.errorMessage}
              {" "}Do not submit the action again until you have checked the transaction through the explorer link above.
            </div>
          )}

          {isError && onRetry && (
            <button className="btn-retry" onClick={onRetry} type="button">
              <RefreshCw size={16} />
              <span>Retry Action</span>
            </button>
          )}

          {!isPending && (
            <button className="btn-icon" onClick={onClose} type="button" style={{ padding: "0.55rem 1.25rem" }}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
