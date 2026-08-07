# LivingCharter — Reviewer Guide

## What it does

LivingCharter is a shared treasury whose spending rules are written in plain language — a "charter" — and can be amended by member vote. When a member asks to be reimbursed, the decision is not made by a treasurer or a fixed formula: GenLayer validators each fetch the request's public web evidence themselves, read the current charter together with the most recent on-chain precedents (the latest ten ruling summaries), and reach consensus on APPROVE, PARTIAL, or DENY. Once the appeal window closes, anyone can call `execute_payout` and the approved GEN moves on-chain. Every accepted ruling is appended to an immutable precedent log that is supplied to later adjudications — deployed rulings have been observed citing earlier precedents by sequence number.

## The problem it solves

Small shared treasuries (clubs, DAO working groups, team funds) run on trust in one treasurer, or on multisigs that can count votes but cannot read a policy. A rule like "reimburse conference tickets up to the price listed on the event page" needs someone to check a web page and interpret a sentence. LivingCharter makes that someone a validator network: the policy is public on-chain text, the evidence check happens on the actual web page, and no single party — including the app's operators — can decide alone or quietly change the rules.

## Why GenLayer is required

The core decision needs three things at once: reading live web pages (does the event page really list that price?), interpreting natural-language rules and precedents (is a team dinner "directly related to software development"?), and reaching consensus so no single machine's answer is trusted. Deterministic smart contracts can do none of the first two; a centralized LLM API fails the third. The decision runs inside `gl.vm.run_nondet_unsafe` in `contracts/treasury.py`: the leader and every validator independently call `gl.nondet.web.render` on each evidence URL and `gl.nondet.exec_prompt` over the charter and recent precedents, and a validator accepts only if its own independent verdict matches the leader's under a strict schema (closed verdict set, per-decision amount rules, citations restricted to active articles, ±10% tolerance on PARTIAL amounts). Infrastructure failure can never become a denial — it becomes a retryable UNDETERMINED state.

This is on display in the deployed history: the AI denied a ticket request because the evidence page showed no price, quoted "$469 USD" from the corrected price page before approving, upheld a denial on appeal with sharper reasoning, cited an earlier precedent by sequence number, and — after members amended article 4 — partially approved the exact request type it had denied under the old charter, applying the new 0.03 GEN cap.

## Walkthrough

1. Open **https://livingcharter.vercel.app** — no wallet needed for reading. The dashboard shows the live treasury balance, charter version 4, 3 members, and both contract addresses with explorer links.
2. Read the **charter panel**: four articles; article 4 shows version 2 — it was amended on-chain (amendment #3) after a denial.
3. Open **Requests**: five completed requests covering every outcome — #1 APPROVE (the ruling quotes the real $469 ticket price it read from the PyCon page), #2 DENY with an upheld appeal, #3 DENY under the old article 4, #4 PARTIAL 0.03/0.05 GEN under the amended article 4, and #5 APPROVE for the publicly listed $139 Student ticket. Each ruling card shows the decision, amount, cited articles, and the validators' reasoning.
4. Open **Precedents**: the append-only ruling log (6 entries, one marked as an appeal ruling).
5. To write: install MetaMask, use the faucet at studio.genlayer.com for GEN, connect on the site (it adds the Studionet chain). Anyone can trigger `adjudicate_request` and `execute_payout`; submitting requests and voting require membership (added by amendment vote).
6. Every transaction hash for the journeys above is in [DEPLOYMENTS.md](DEPLOYMENTS.md); all are FINALIZED with execution SUCCESS on the explorer.

Studionet has limited shared execution capacity. The frontend limits all reads to two concurrent calls, retries only transient capacity/network failures within a bounded budget, and polls only the visible tab without overlapping a prior load. If Studionet remains unavailable, the UI says so and offers Retry; it never replaces on-chain data with a simulated snapshot.

## The concrete build

- Contracts: `contracts/charter.py` (members, versioned articles, amendment state machine — deterministic) and `contracts/treasury.py` (funds, request lifecycle with appeal, the nondeterministic adjudication, append-only precedent log). Deployed on GenLayer Studionet: Charter `0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`, Treasury `0x99A0b62199b412421c6466E1C60e0C0D220D2F16`.
- Consensus method: custom leader/validator pair (`gl.vm.run_nondet_unsafe`) with independent re-evaluation and deterministic payload validation on both sides.
- Frontend: React + `genlayer-js` at https://livingcharter.vercel.app; UI state changes only after transactions are FINALIZED with execution SUCCESS.
- Tests: 49 contract unit tests (pure-Python GenVM stub) and 97 frontend tests; `genvm-lint` passes for both contracts.
- Repository: https://github.com/ldkfj/livingcharter — an incremental commit history telling the real development story.

## Roadmap (future, not in this build)

Weighted/quorum-configurable voting; relevance-based precedent retrieval beyond the most-recent window; multi-treasury federation.
