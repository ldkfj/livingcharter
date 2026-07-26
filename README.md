# LivingCharter

A shared treasury governed by a **living charter**: spending rules written in plain language that members can amend by vote. Every spend request is judged on-chain by GenLayer validators, which independently fetch the request's public web evidence, read the current charter and the accumulated precedent log, and reach consensus on an `APPROVE` / `PARTIAL` / `DENY` ruling. Every ruling becomes a precedent that informs future rulings — and amending the charter visibly changes how the same request is decided.

## The trust problem

A shared treasury (club, DAO working group, small fund) normally hands spending decisions to one treasurer or a rigid multisig. One treasurer is a single point of trust. A multisig can count votes but cannot *interpret* a written policy — "reimburse conference tickets up to the price publicly listed on the event page" is not expressible in deterministic contract code. LivingCharter removes the single decision-maker: the policy is public on-chain text, the interpretation is performed by independent validators reaching consensus, the factual claims are checked against live web evidence fetched by each validator, and every ruling is recorded as citable precedent.

**Why this cannot exist without GenLayer:** remove the AI and nobody can interpret natural-language rules and precedents — the product collapses into an ordinary vote. Remove on-chain web reading and every decision rests on the requester's typed claims — the charter's factual conditions (listed prices, event existence) become unverifiable. Remove consensus and a single hosted LLM becomes the new unilateral treasurer.

## Live deployment (GenLayer Studionet)

| Item | Value |
| --- | --- |
| Network | GenLayer Studionet, chain ID `61999`, RPC `https://studio.genlayer.com/api` |
| Charter contract | [`0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`](https://explorer-studio.genlayer.com/address/0x0D22C5298ad1437DB715A543B485588a8e0fc9DB) |
| Treasury contract | [`0x99A0b62199b412421c6466E1C60e0C0D220D2F16`](https://explorer-studio.genlayer.com/address/0x99A0b62199b412421c6466E1C60e0C0D220D2F16) |
| Contract source | [`contracts/charter.py`](contracts/charter.py), [`contracts/treasury.py`](contracts/treasury.py) |

The deployed contracts carry **real multi-wallet usage**, not a single demo transaction: 4 spend requests covering all three verdicts, one appeal adjudicated and upheld, three ratified amendments, and 5 precedents — including the living-charter moment where a team-dinner request denied under charter v3 is partially approved under the amended article at charter v4. Every transaction hash is recorded in [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md); all are `FINALIZED` with execution `SUCCESS`. (An earlier Treasury instance at `0xB984B0a79B9BC17C332017B0640Dc82eE6151393` holds two additional authentic denials from before an evidence-rendering fix — evidence strictness working as designed.)

Studionet is GenLayer's hosted development network; persistence is controlled by the GenLayer environment.

## How it works

1. **Charter** (`contracts/charter.py`, deterministic): members, versioned articles, and a full amendment state machine (`PROPOSED → VOTING → RATIFIED/REJECTED/EXPIRED`) used both for policy changes and membership changes. One active member = one vote; strict majority; ratification re-validates preconditions against current state.
2. **Treasury** (`contracts/treasury.py`): holds native GEN. A member submits a spend request with an amount, a purpose, and 1–3 **public evidence URLs** (mandatory). Deterministic guards run first (membership via cross-contract read, amount vs balance, cooldown, one open request per member, URL hygiene).
3. **Adjudication** (the nondeterministic core): anyone triggers `adjudicate_request`. Inside `gl.vm.run_nondet_unsafe`, the leader **and** each validator independently fetch every evidence URL (`gl.nondet.web.render`, text mode), read the ratified charter and the last 10 precedent summaries, and run the same constrained evaluation (`gl.nondet.exec_prompt`). The validator accepts only if its own independently-computed decision matches the leader's, the strict JSON schema holds (exact keys, closed verdict set, decision-specific amount invariants, citations restricted to active articles), and PARTIAL amounts agree within ±10% of the requested amount. Consensus failure leaves state untouched; shared infrastructure failure becomes `UNDETERMINED` (retryable) — never a `DENY`.
4. **Precedent log**: every accepted ruling is appended to an immutable event log and fed into future adjudications ("prior consensus rulings under this charter — follow them unless the charter text itself contradicts them"). Rulings have been observed citing earlier precedents by sequence number.
5. **Appeal**: one appeal per request within a time window; the appeal adjudication re-runs the full evidence evaluation with the original ruling and the (untrusted-flagged) appeal argument in context. The appeal ruling is final; the systemic remedy afterwards is amending the charter.
6. **Payout**: after the appeal window (or a final ruling), anyone can execute the payout — native GEN moves to the requester for the approved amount; zero-amount rulings close the request.

## Frontend

React 19 + TypeScript + Vite + `genlayer-js` (`frontend/`). Read paths go through a lossless-JSON, runtime-validated data layer (wei as `bigint` end to end). Write paths use an EIP-1193 wallet with Studionet chain management and a truthful transaction lifecycle: the UI shows real consensus stages and mutates state **only** after a transaction is `FINALIZED` with execution `SUCCESS`; contract error codes are surfaced, timeouts are a distinct terminal state, and nothing on-chain is ever simulated.

## Repository layout

```
contracts/   charter.py, treasury.py (GenVM Intelligent Contracts, Python)
frontend/    React DApp (read + write, wallet, tx lifecycle)
tests/       49 pytest unit tests over a pure-Python GenVM stub
docs/        SPEC.md, DEPLOYMENTS.md (full tx audit trail), VERSIONS.md (verified API surface)
scripts/     lint.ps1 (genvm-lint gate)
```

## Running locally

Contracts (tests): `python -m pytest -v` — 49 tests, no GenLayer runtime required (stubbed).
Lint gate (before any deployment): `powershell -ExecutionPolicy Bypass -File scripts/lint.ps1`.
Frontend: `cd frontend && npm ci && npm run dev` — requires `.env` with the real deployed addresses (see `.env.example`; the app refuses to start on missing or placeholder values). Frontend tests: `npx vitest run` (81 tests); build: `npm run build`.

## Security posture and honest limitations

- All fetched web content, request purposes, and appeal arguments are treated as untrusted; the validator enforces a closed verdict set, amount bounds tied to the request, citations restricted to active articles, and exact-key schemas, so injected instructions cannot widen the decision space.
- Evidence is truncated to 6,000 characters per URL (text rendering). Pages that do not expose the claimed facts in their text lead to denial under the charter's evidence article — strict by design, as the on-chain history shows.
- Infrastructure failure is never converted into a substantive denial (`UNDETERMINED`/`FAILED` paths preserve funds).
- `npm audit` reports advisories on a transitive tooling path of `genlayer-js` (no upstream fix available); the runtime read/write paths do not use those modules.
- Membership is wallet-based; the contract does not verify off-chain identity.

## Roadmap (not yet implemented)

Weighted or quorum-configurable voting; richer precedent retrieval (relevance-based selection beyond the most recent window); multi-treasury federation.
