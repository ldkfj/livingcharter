# LivingCharter

A shared treasury governed by a **living charter**: spending rules written in plain language that members can amend by vote. Every spend request is judged on-chain by GenLayer validators, which independently fetch the request's public web evidence, read the current charter and the accumulated precedent log, and reach consensus on an `APPROVE` / `PARTIAL` / `DENY` ruling. Every ruling becomes a precedent that informs future rulings - and amending the charter visibly changes how the same request is decided.

## Verified links

| Item | Value |
| --- | --- |
| Network | GenLayer Studionet, chain ID `61999`, RPC `https://studio.genlayer.com/api` |
| Charter contract | [`0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`](https://explorer-studio.genlayer.com/address/0x0D22C5298ad1437DB715A543B485588a8e0fc9DB) |
| Treasury contract | [`0x99A0b62199b412421c6466E1C60e0C0D220D2F16`](https://explorer-studio.genlayer.com/address/0x99A0b62199b412421c6466E1C60e0C0D220D2F16) |
| Contract source | [`contracts/charter.py`](contracts/charter.py), [`contracts/treasury.py`](contracts/treasury.py) |

The deployed contracts carry **real multi-wallet usage**, not a single demo transaction: 5 spend requests covering all three verdicts, one appeal adjudicated and upheld, three ratified amendments, and 6 precedents - including the living-charter moment where a team-dinner request denied under charter v3 is partially approved under the amended article at charter v4. Every transaction hash is recorded in [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md); all are `FINALIZED` with execution `SUCCESS`. (An earlier Treasury instance at `0xB984B0a79B9BC17C332017B0640Dc82eE6151393` holds two additional authentic denials from before an evidence-rendering fix - evidence strictness working as designed.)

Studionet is GenLayer's hosted development network; persistence is controlled by the GenLayer environment.

> Release-candidate status: the live Treasury v2 above is the last verified deployment. The repository currently contains a solvency hardening change that reserves the maximum liability of every open request. It is not a release until a new Treasury is deployed, source parity is verified, the production address is updated, and the full live proof matrix in [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md) is complete.

## The trust problem

A shared treasury normally hands spending decisions to one treasurer or a rigid multisig. One treasurer is a single point of trust. A multisig can count votes but cannot interpret a written policy such as “reimburse conference tickets up to the price publicly listed on the event page.” LivingCharter makes the policy public on-chain text, has independent validators check live evidence and interpret that policy, and records every accepted ruling as citable precedent.

## Why GenLayer is essential

The consequential nondeterministic decision is the spend ruling. The leader and validators independently fetch the submitted public URLs, interpret the active natural-language charter and recent precedents, and compare constrained results. Remove web reading and factual conditions become unverifiable; remove natural-language interpretation and the charter becomes a rigid formula; remove consensus and one hosted model becomes the unilateral treasurer. An accepted ruling controls an on-chain payout or closure.

## How it works

A member submits a bounded request with public evidence. Anyone may adjudicate it. The request may be appealed once during its window, after which anyone may execute the effective ruling. Separately, members propose, vote on, finalize, or cancel amendments; a ratified amendment changes the rules supplied to later adjudications.

## Architecture

- `contracts/charter.py` is the on-chain source of truth for membership, versioned articles, and amendments.
- `contracts/treasury.py` is the on-chain source of truth for funds, reservations, requests, rulings, appeals, payouts, and precedents.
- `frontend/` reads and validates contract JSON losslessly and submits wallet-signed transactions. It never synthesizes chain state.
- `tests/` provides a pure-Python GenVM behavioral stub; it is test infrastructure, not a production backend.

### Repository layout

```
contracts/   Charter and Treasury GenVM Intelligent Contracts
frontend/    React DApp and scripted Studionet integration journeys
tests/       Pure-Python GenVM behavioral tests
docs/        Deployment, verification, version, and roadmap records
scripts/     genvm-lint deployment gate
```

## Intelligent Contracts

1. **Charter** (`contracts/charter.py`, deterministic): members, versioned articles, and a full amendment state machine (`PROPOSED → VOTING → RATIFIED/REJECTED/EXPIRED`) used both for policy changes and membership changes. One active member = one vote; strict majority; ratification re-validates preconditions against current state.
2. **Treasury** (`contracts/treasury.py`): holds native GEN. A member submits a spend request with an amount, a purpose, and 1–3 **public evidence URLs**. Deterministic guards run first. The candidate contract reserves each request's full amount at submission, rejects aggregate overcommitment, keeps the reservation through ruling and appeal, and releases it exactly once at `PAID`, `CLOSED`, or initial-adjudication `FAILED`.
3. **Adjudication** (the nondeterministic core): anyone triggers `adjudicate_request`. Inside `gl.vm.run_nondet_unsafe`, the leader **and** each validator independently fetch every evidence URL (`gl.nondet.web.render`, text mode), read the ratified charter and the last 10 precedent summaries, and run the same constrained evaluation (`gl.nondet.exec_prompt`). The validator accepts only if its own independently-computed decision matches the leader's, the strict JSON schema holds (exact keys, closed verdict set, decision-specific amount invariants, citations restricted to active articles), and PARTIAL amounts agree within ±10% of the requested amount. Consensus failure leaves state untouched; shared infrastructure failure becomes `UNDETERMINED` (retryable) - never a `DENY`.
4. **Precedent log**: every accepted ruling is appended to an immutable event log and fed into future adjudications ("prior consensus rulings under this charter - follow them unless the charter text itself contradicts them"). Rulings have been observed citing earlier precedents by sequence number.
5. **Appeal**: one appeal per request within a time window; the appeal adjudication re-runs the full evidence evaluation with the original ruling and the (untrusted-flagged) appeal argument in context. The appeal ruling is final; the systemic remedy afterwards is amending the charter.
6. **Payout**: after the appeal window (or a final ruling), anyone can execute the payout - native GEN moves to the requester for the approved amount; zero-amount rulings close the request.

## Transaction lifecycle

React 19 + TypeScript + Vite + `genlayer-js` live in `frontend/`. Reads use lossless JSON and runtime validators, with wei represented only as `bigint`. Writes use an EIP-1193 wallet on Studionet. The UI shows named consensus stages, waits for `FINALIZED`, verifies execution `SUCCESS`, then reads authoritative state back. Rejections are neutral cancellations; timeouts and unknown receipt shapes fail closed with reconciliation guidance. A FIFO limiter permits at most two concurrent reads, visible-tab polling never overlaps, and transient capacity failures receive bounded retry.

## Run locally

**1. Contract tests** (no GenLayer runtime needed - the GenVM surface is stubbed):

```bash
pip install -r requirements-dev.txt
python -m pytest -v
```

**2. Lint gate** (required before any deployment):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/lint.ps1
```

**3. Frontend** against the live deployed contracts:

```bash
cd frontend
npm ci
copy .env.example .env     # then fill in the two deployed addresses (README table above)
npm run dev                # local app
npx vitest run
npm run build              # production build
```

The app refuses to start if either address is missing or looks like a placeholder.

## Tests and verification

Current candidate results: `51 passed` for `python -m pytest -q`; `99 passed` for `npx vitest run`; `npx tsc --noEmit` clean; `npm run build` clean apart from Vite's existing chunk-size advisory. Both contracts must also pass `powershell -ExecutionPolicy Bypass -File scripts/lint.ps1` before deployment. Exact release evidence, source hashes, transaction hashes, and the outstanding live-proof rows are maintained in [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md).

## Deployment and recovery

1. Run the lint gate (above) - both contracts must pass.
2. In [GenLayer Studio](https://studio.genlayer.com), deploy `contracts/charter.py` with `voting_period_seconds` (e.g. `300`). Require the transaction to be **FINALIZED with result SUCCESS** - both, always.
3. From the deployer account, call `bootstrap(articles_json)` with a JSON array of 2–10 founding articles (each 20–2000 chars). Verify with `get_charter_bundle`.
4. Deploy `contracts/treasury.py` with `charter_address` (step 2's address), `appeal_window_seconds`, `member_cooldown_seconds`. Verify with `get_treasury_state`.
5. Fund it: call payable `fund` with a GEN value, then put both addresses in `frontend/.env`.
6. Add members via `propose_amendment` (kind `3` = ADD_MEMBER) → `vote` → `finalize_amendment`.

Both existing contracts have no upgrader and are therefore frozen under GenVM's default post-constructor lock. The new Treasury deployment remains blocked until the user explicitly confirms the intended frozen classification. A frozen contract cannot be repaired in place: recovery is a source-parity redeployment, state/funding migration by new transactions, frontend environment update, and a fresh proof matrix. See [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md).

## Security and trust boundaries

- All fetched web content, request purposes, and appeal arguments are treated as untrusted; the validator enforces a closed verdict set, amount bounds tied to the request, citations restricted to active articles, and exact-key schemas, so injected instructions cannot widen the decision space.
- Evidence is truncated to 6,000 characters per URL (text rendering). Pages that do not expose the claimed facts in their text lead to denial under the charter's evidence article - strict by design, as the on-chain history shows.
- Infrastructure failure is never converted into a substantive denial (`UNDETERMINED`/`FAILED` paths preserve funds).
- `npm audit` reports advisories on a transitive tooling path of `genlayer-js` (no upstream fix available); the runtime read/write paths do not use those modules.
- Membership is wallet-based; the contract does not verify off-chain identity.

## Known limitations

- The current live Treasury v2 predates reservation accounting; the repository candidate must not be represented as deployed until Treasury v3 evidence is complete.
- Frozen contracts cannot be upgraded or recovered in place.
- Evidence is limited to the rendered text window, and public pages can change or become unavailable.
- Studionet is a shared development environment and can temporarily exhaust execution capacity.

## Roadmap (not yet implemented)

Near term: charter-amendable process parameters, cross-source evidence corroboration, precedent browsing by article, public-testnet deployment. Mid term: relevance-based precedent retrieval, configurable voting. Long term: multi-treasury federation, reusable charter templates, adjudication as a module for other contracts. Details: [docs/ROADMAP.md](docs/ROADMAP.md).
