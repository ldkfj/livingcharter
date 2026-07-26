import React, { useState, useEffect } from "react";
import { AmendmentInfo } from "../types/contract";
import { truncateAddress, formatTimestamp } from "../lib/formatters";
import { Vote, Copy, Check, RefreshCw, Plus, ThumbsUp, ThumbsDown, CheckCircle, XCircle } from "lucide-react";
import type { WriteResult } from "../lib/txEngine";
import { getAmendmentActionGates } from "../lib/actionGates";

interface AmendmentsViewProps {
  amendments: AmendmentInfo[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  connectedAccount: string | null;
  memberCount: number;
  onOpenProposeModal: () => void;
  onVoteAmendment: (amendmentId: number, voteYes: boolean) => Promise<WriteResult>;
  onFinalizeAmendment: (amendmentId: number) => Promise<WriteResult>;
  onCancelAmendment: (amendmentId: number) => Promise<WriteResult>;
  isExecuting: boolean;
}

const KIND_NAMES: Record<number, string> = {
  0: "ADD_ARTICLE",
  1: "REPLACE_ARTICLE",
  2: "REPEAL_ARTICLE",
  3: "ADD_MEMBER",
  4: "REMOVE_MEMBER",
};

export const AmendmentsView: React.FC<AmendmentsViewProps> = ({
  amendments,
  loading,
  error,
  onRetry,
  connectedAccount,
  memberCount,
  onOpenProposeModal,
  onVoteAmendment,
  onFinalizeAmendment,
  onCancelAmendment,
  isExecuting,
}) => {
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(text);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleVote = async (amendmentId: number, voteYes: boolean) => {
    const result = await onVoteAmendment(amendmentId, voteYes);
    if (result.kind === "success" && connectedAccount) {
      setVotedMap((prev) => ({ ...prev, [`${connectedAccount.toLowerCase()}_${amendmentId}`]: true }));
    }
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

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Vote size={20} style={{ color: "var(--accent-amber)" }} />
          <span>Charter Amendments ({amendments ? amendments.length : 0})</span>
        </div>

        <button
          className="btn-retry"
          onClick={onOpenProposeModal}
          disabled={isExecuting || !connectedAccount}
          type="button"
          style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", background: "var(--accent-amber)" }}
        >
          <Plus size={16} />
          <span>Propose Amendment</span>
        </button>
      </div>

      {!amendments || amendments.length === 0 ? (
        <div className="state-empty" style={{ padding: "3rem 1.5rem" }}>
          <Vote size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
          <h3>No Amendments Proposed Yet</h3>
          <p style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
            The living charter has not received any amendment motions on Studionet. Connected active members can submit proposals above.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {amendments.map((am) => {
            const hasVoted = connectedAccount ? votedMap[`${connectedAccount.toLowerCase()}_${am.id}`] : false;
            const isProposer = connectedAccount && connectedAccount.toLowerCase() === am.proposer.toLowerCase();
            const kindLabel = KIND_NAMES[am.kind] || `KIND_${am.kind}`;
            const { canVote, canFinalize, canCancel } =
              getAmendmentActionGates(
                am,
                memberCount,
                nowSec,
                Boolean(isProposer),
              );

            return (
              <div
                key={am.id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                      Motion #{am.id}
                    </span>
                    <span className="badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fcd34d" }}>
                      {kindLabel}
                    </span>
                    <span className="badge badge-state">{am.state_name}</span>
                  </div>

                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Deadline: {formatTimestamp(am.deadline)}
                  </span>
                </div>

                <p style={{ fontSize: "0.92rem", color: "var(--text-primary)", fontWeight: 500 }}>
                  "{am.rationale}"
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

                {/* Voting & Action Controls */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    paddingTop: "0.65rem",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {canVote && (
                      <>
                        <button
                          className="nav-btn"
                          onClick={() => handleVote(am.id, true)}
                          disabled={isExecuting || !connectedAccount || hasVoted}
                          type="button"
                          style={{
                            background: hasVoted ? "rgba(255,255,255,0.05)" : "rgba(16, 185, 129, 0.15)",
                            color: hasVoted ? "var(--text-muted)" : "#6ee7b7",
                            padding: "0.4rem 0.85rem",
                            fontSize: "0.82rem",
                          }}
                        >
                          <ThumbsUp size={14} />
                          <span>Vote YES</span>
                        </button>

                        <button
                          className="nav-btn"
                          onClick={() => handleVote(am.id, false)}
                          disabled={isExecuting || !connectedAccount || hasVoted}
                          type="button"
                          style={{
                            background: hasVoted ? "rgba(255,255,255,0.05)" : "rgba(244, 63, 94, 0.15)",
                            color: hasVoted ? "var(--text-muted)" : "#fda4af",
                            padding: "0.4rem 0.85rem",
                            fontSize: "0.82rem",
                          }}
                        >
                          <ThumbsDown size={14} />
                          <span>Vote NO</span>
                        </button>
                      </>
                    )}

                    {hasVoted && (
                      <span style={{ fontSize: "0.78rem", color: "var(--accent-emerald)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <CheckCircle size={12} />
                        <span>Voted</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {canFinalize && (
                      <button
                        className="btn-retry"
                        onClick={() => onFinalizeAmendment(am.id)}
                        disabled={isExecuting || !connectedAccount}
                        type="button"
                        style={{ padding: "0.4rem 0.85rem", fontSize: "0.82rem", background: "var(--accent-primary)" }}
                      >
                        <CheckCircle size={14} />
                        <span>Finalize Motion</span>
                      </button>
                    )}

                    {canCancel && (
                      <button
                        className="btn-icon"
                        onClick={() => onCancelAmendment(am.id)}
                        disabled={isExecuting || !connectedAccount}
                        type="button"
                        style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem", color: "var(--accent-rose)" }}
                      >
                        <XCircle size={14} />
                        <span>Cancel Motion</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
