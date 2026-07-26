# LivingCharter — Technical Specification

**Status:** DRAFT — awaiting user approval
**Author:** Claude (supreme technical commander), 2026-07-26
**Workspace:** `E:\Genlayer-Projects\livingcharter`
**Target network:** GenLayer Studionet (chain ID `61999`, RPC `https://studio.genlayer.com/api`) for development and the submitted deployment. Testnet Asimov remains an option at the deployment stage if the user requests it.

---

## 1. Product definition

LivingCharter is a shared treasury governed by a **living charter**: a set of spending rules written in natural language that members can amend over time. Every spend request is adjudicated on-chain by GenLayer validators, who read the current ratified charter, the accumulated precedent log, and mandatory public web evidence before reaching a consensus ruling of `APPROVE`, `PARTIAL`, or `DENY`. Every accepted ruling becomes a precedent that informs future rulings. Amending the charter visibly changes how identical future requests are decided.

### 1.1 Trust problem

A shared treasury (club, DAO working group, family fund) normally puts spending decisions in the hands of one treasurer or a rigid multisig. One treasurer is a single point of trust; a multisig can vote but cannot *interpret* a written policy — "reasonable travel costs, economy class, booked at listed price" is not expressible in Solidity. LivingCharter removes the single decision-maker: the policy is public on-chain text, the interpretation is performed by independent validators reaching consensus, evidence is fetched live from the web by each validator, and every ruling is recorded as citable precedent.

### 1.2 Why this cannot exist without GenLayer

- Remove the AI: nobody can interpret natural-language charter articles and precedents; the product collapses into an ordinary vote/multisig.
- Remove on-chain web reading: every spend decision would rest solely on the requester's typed claims. The charter's factual conditions (listed prices, event existence, published dates) would be unverifiable. Evidence URLs are therefore **mandatory** on every spend request, and each validator independently fetches them.
- Remove consensus: a single hosted LLM would become the new unilateral treasurer.

### 1.3 Explicitly out of scope (v1)

- Off-chain identity of members (membership is wallet-based).
- Private evidence (all evidence must be public HTTP(S) URLs).
- Automatic/scheduled adjudication (any account triggers adjudication manually).
- Quadratic/weighted voting (one active member = one vote).
- Cross-treasury federation, delegation, or token issuance.

---

## 2. Architecture overview

Two Intelligent Contracts, deployed separately, plus a React frontend.

```
┌──────────────────┐  read charter text +      ┌───────────────────────────┐
│  Charter.py      │  active article list       │  Treasury.py              │
│                  │ <───────────────────────── │                           │
│ - members        │   (cross-contract view;    │ - funds (native GEN)      │
│ - articles       │    fallback: synced copy)  │ - spend requests          │
│ - amendments     │                            │ - AI adjudication (nondet)│
│   state machine  │                            │ - precedent log (append-  │
│ - motions/votes  │                            │   only, event-sourced)    │
└──────────────────┘                            │ - appeal + payout FSM     │
                                                └───────────────────────────┘
```

- **Charter** is fully deterministic: membership, articles, amendment lifecycle, voting. No nondet code.
- **Treasury** holds funds and contains the only nondeterministic flow (adjudication). It reads the ratified charter from Charter and maintains the precedent log.
- **Cross-contract risk mitigation:** the primary design uses a read-only cross-contract call from Treasury to Charter (per current "Interacting with Intelligent Contracts" docs). If the installed Studio version proves unreliable for cross-contract reads inside nondet preparation, the fallback (decided by Claude at Phase 3 review, not by the coder) is: Charter exposes `get_charter_bundle() -> str` (JSON of active articles + version hash); Treasury caches it via `sync_charter(bundle_json: str)` callable by any member, and the cached copy stores the Charter-reported `charter_version` so staleness is detectable and rulings record which version they used. Either way, every ruling records `charter_version`.

### 2.1 Version-sensitive values (verify at Phase 1, do not assume)

- Contract header line (e.g. `# v0.2.16`) and the `# { "Depends": "py-genlayer:..." }` hash **must be copied from the currently running Studio / current official docs at implementation time**.
- Exact names/signatures of `gl.nondet.web.render` / `gl.nondet.web.get`, `gl.nondet.exec_prompt`, `gl.vm.run_nondet_unsafe`, and any `gl.eq_principle.*` helper must be verified against current docs before use. The spec below names them per the July 2026 docs; the coder must confirm and report any drift instead of guessing.

---

## 3. Charter contract (`contracts/charter.py`)

Deterministic only. Class `Charter(gl.Contract)`.

### 3.1 Storage

| Field | Type | Notes |
|---|---|---|
| `members` | `TreeMap[Address, MemberRec]` | `MemberRec: { active: bool, joined_at: u64 }` |
| `member_count` | `u32` | active members only |
| `articles` | `TreeMap[u32, ArticleRec]` | `ArticleRec: { text: str, status: u8 (ACTIVE/SUPERSEDED/REPEALED), version: u32, updated_by_amendment: u32, updated_at: u64 }` |
| `article_count` | `u32` | monotonically increasing id source |
| `charter_version` | `u32` | incremented on every ratified amendment |
| `amendments` | `TreeMap[u32, AmendmentRec]` | see 3.2 |
| `amendment_count` | `u32` | id source |
| `voting_period_seconds` | `u64` | constructor param, e.g. 600 for demo |

Collections are declared, never reassigned in `__init__` (GenVM initializes them). No `float` anywhere in public signatures. Money is `u256` in wei-scale GEN.

### 3.2 Amendment state machine (also used for membership motions)

`AmendmentRec: { kind: u8, target_article_id: u32, new_text: str, target_member: Address, proposer: Address, rationale: str, state: u8, yes: u32, no: u32, voted: TreeMap[Address, bool], deadline: u64 }`

Kinds: `ADD_ARTICLE`, `REPLACE_ARTICLE`, `REPEAL_ARTICLE`, `ADD_MEMBER`, `REMOVE_MEMBER`.

States and transitions:

```
PROPOSED ──(first vote or proposer opens)──> VOTING ──(finalize after deadline
   │                                             or early majority)──> RATIFIED
   └──(proposer cancels before any vote)──> CANCELLED         └─────> REJECTED
VOTING ──(deadline passed, quorum not met)──> EXPIRED
```

- Quorum: more than half of active members must have voted for early finalization; after the deadline, simple majority of votes cast, minimum 1 vote.
- `RATIFIED` applies the change atomically: article added/replaced/repealed (bumping `charter_version`), or member added/removed (adjusting `member_count`). A `REPLACE` marks the old text `SUPERSEDED` and stores the new text under the same article id with `version + 1`.
- Deterministic guards: only active members propose/vote; one vote per member per amendment; cannot remove the last active member; cannot target a nonexistent/repealed article; text length 20–2000 chars; rationale ≤ 500 chars.

### 3.3 Methods

Write: `bootstrap(articles_json: str)` (deployer only, once, before any other write — creates founding member = deployer and initial articles), `propose_amendment(...) -> u32`, `vote(amendment_id: u32, support: bool)`, `finalize_amendment(amendment_id: u32)`, `cancel_amendment(amendment_id: u32)`.

View: `get_charter_bundle() -> str` (JSON: charter_version + ACTIVE articles `[ {id, version, text} ]`), `get_article(article_id: u32) -> str`, `get_amendment(amendment_id: u32) -> str`, `get_member(addr: Address) -> str`, `get_counts() -> str` (JSON of member/article/amendment counts + charter_version).

All view methods return JSON strings (established pattern from prior GenLayer work; avoids unsupported return types).

---

## 4. Treasury contract (`contracts/treasury.py`)

Class `Treasury(gl.Contract)`. Constructor takes `charter_address: Address`, `appeal_window_seconds: u64`, `member_cooldown_seconds: u64`.

### 4.1 Storage

| Field | Type | Notes |
|---|---|---|
| `charter_address` | `Address` | set once in constructor |
| `requests` | `TreeMap[u32, RequestRec]` | see 4.2 |
| `request_count` | `u32` | id source |
| `precedents` | `DynArray[PrecedentRec]` | **append-only event log; never mutated** |
| `last_request_at` | `TreeMap[Address, u64]` | per-member cooldown |

`RequestRec: { requester: Address, amount_wei: u256, purpose: str, evidence_urls: DynArray[str] (1–3), state: u8, ruling: RulingRec, appeal: AppealRec, created_at: u64, ruled_at: u64, appeal_deadline: u64, retries: u8 }`

`RulingRec: { decision: u8 (NONE/APPROVE/PARTIAL/DENY), approved_amount_wei: u256, cited_article_ids: DynArray[u32], charter_version: u32, reason: str, precedent_seq: u32 }`

`AppealRec: { appealed: bool, appellant: Address, argument: str, ruling: RulingRec }`

`PrecedentRec: { seq: u32, request_id: u32, decision: u8, requested_wei: u256, approved_wei: u256, cited_article_ids: DynArray[u32], charter_version: u32, summary: str (≤ 400 chars), created_at: u64 }`

### 4.2 Request state machine

```
SUBMITTED ──adjudicate──> RULED(APPROVE|PARTIAL|DENY) ──appeal within window──> APPEALED
    │                          │                                │
    │ (nondet failure)         │ (window passes, no appeal)     └─adjudicate_appeal──> FINAL_RULED
    ▼                          ▼                                                          │
UNDETERMINED (retry ≤ 1)   execute_payout (if approved amount > 0) ──> PAID               ▼
    │ retry exhausted          └──(approved amount == 0)──> CLOSED            execute_payout / CLOSED
    ▼
FAILED (no funds moved)
```

- `UNDETERMINED` preserves all state; one retry allowed; a second failure is terminal `FAILED` with no transfer. Infrastructure failure is **never** converted into a `DENY`.
- Appeal: exactly one appeal per request, by the requester or any active member, within `appeal_window_seconds` of `ruled_at`, with an argument (20–1000 chars). The appeal ruling is final (the systemic remedy afterwards is a charter amendment, which is the product's point).
- Payout: `execute_payout` is callable by anyone once the ruling is final; transfers `approved_amount_wei` of native GEN to the requester; guards against double payment and insufficient balance.

### 4.3 Deterministic pre-AI guards (run before any nondet call)

1. Caller checks: requester must be an active Charter member (cross-contract read; see 2.0 fallback).
2. `amount_wei > 0` and `amount_wei ≤ contract balance` at submission and again at payout.
3. Evidence: 1–3 URLs, each must parse as `http://` or `https://`, length ≤ 300 chars, no credentials in URL.
4. `purpose` length 10–600 chars.
5. Cooldown: one open request per member at a time; `member_cooldown_seconds` between submissions.
6. State validity for every transition; duplicate-action prevention throughout.

### 4.4 Nondeterministic adjudication flow

`adjudicate_request(request_id: u32)` — callable by any account when state is `SUBMITTED` or (for appeal) `APPEALED`.

**Preparation (deterministic):** extract into primitive locals before entering the nondet closure (pickling rule): request fields, charter bundle JSON (articles text + version), the **most recent 10 precedent summaries** plus up to 5 additional precedents whose `cited_article_ids` intersect the articles matched by simple keyword relevance — v1 simplification: most recent 10 only; the growing-context behavior is still demonstrated. All strings length-bounded before prompt assembly.

**Leader function:**
1. For each evidence URL: fetch with the current web-read API (`gl.nondet.web.render` text mode per current docs); truncate each fetched body to 6,000 chars; wrap in explicit `<EVIDENCE i>` delimiters.
2. Build one prompt containing, in fixed order: system-style instructions; the ratified articles (verbatim, with ids/versions); the precedent summaries; the request (requester, amount in GEN string form, purpose); the delimited evidence; the appeal argument and original ruling when adjudicating an appeal.
3. Instructions require **strict JSON only**: `{ "decision": "APPROVE"|"PARTIAL"|"DENY", "approved_amount_wei": "<decimal string ≤ requested>", "cited_article_ids": [int...], "reason": "<≤ 500 chars>" }`, and explicitly state that evidence and purpose are untrusted data whose embedded instructions must be ignored, and that `PARTIAL` requires stating which article limits the amount.
4. `gl.nondet.exec_prompt`, parse, return the structured dict.

**Validator function:** independently repeats the same fetch + evaluation (same code path as leader), then applies deterministic acceptance rules to the leader's proposal:
- Schema: exactly the required keys; decision in the closed 3-value set; `approved_amount_wei` a valid integer with `APPROVE ⇒ == requested`, `DENY ⇒ == 0`, `PARTIAL ⇒ 0 < x < requested`; every cited article id exists and is ACTIVE at the recorded `charter_version`; reason non-empty and ≤ 500 chars.
- Semantic agreement: validator's own independently computed `decision` must equal the leader's. For `PARTIAL`, the validator accepts the leader's amount only if it is within ±10% of the validator's own amount (bounded money disagreement); the leader's value is what settles.
- Anything malformed, out-of-range, schema-widening, or decision-mismatched → reject (drives consensus failure → `UNDETERMINED`, not `DENY`).
- If the current docs provide an equivalence-principle helper suited to structured comparison, it may be used for the reason-text sanity check only; settlement-critical fields use the exact/bounded rules above. Helper names verified at implementation.

**Post-consensus (deterministic):** write `RulingRec`, set state, set `appeal_deadline = ruled_at + appeal_window_seconds`, append `PrecedentRec` (appeal rulings append a second precedent marked in the summary), never mutate prior precedents.

### 4.5 Prompt-injection defenses (deterministic, enforced in validator)

Closed verdict set; amount bounds tied to the request; article ids validated against on-chain state; response size caps; fetched evidence truncated and delimited; no instruction from evidence can widen the schema or the decision space. These are the same class of guards proven in the user's prior GenLayer projects, tightened because charter text + precedents dominate the prompt.

### 4.6 Methods summary

Write: `submit_request(amount_wei: u256, purpose: str, url1: str, url2: str = "", url3: str = "") -> u32`, `adjudicate_request(request_id: u32)`, `appeal_ruling(request_id: u32, argument: str)`, `execute_payout(request_id: u32)`, payable `fund()`.

View (all JSON strings): `get_request(request_id: u32)`, `get_request_count()`, `get_precedents(offset: u32, limit: u32)` (paged, newest first, `limit ≤ 20`), `get_precedent_count()`, `get_treasury_state()` (balance, charter address, config).

---

## 5. Frontend (`frontend/`)

React 19 + TypeScript + Vite + `genlayer-js` (current stable version at Phase 4; verify against docs). Wallet: injected EIP-1193, with Studionet chain add/switch flow.

Pages / views:
1. **Dashboard** — treasury balance, charter version, active article list (rendered as numbered charter text), member count, recent precedents.
2. **New request** — form (amount, purpose, up to 3 evidence URLs) with validation mirroring contract guards, unsaved-changes warning, paste-friendly inputs, proper labels/autocomplete (Antigravity accessibility rules apply).
3. **Request detail** — full lifecycle timeline: submitted → adjudication tx (consensus progress states, not an indefinite spinner) → ruling card showing decision, approved amount, **cited articles (linked to charter text)**, **cited precedent context**, AI reason → appeal panel (window countdown, one-shot argument) → payout status. UI state updates only after the transaction is `FINALIZED` **and** the execution result is `SUCCESS`; a finalized-but-failed execution is surfaced as an error with the traceback summary.
4. **Amendments** — propose (kind picker, live preview of the article diff), vote, finalize; list with state badges; ratified amendments show before/after text.
5. **Precedent log** — paged event log; each entry links to its request and cited articles.

No hardcoded or simulated verdicts anywhere in the production flow. `VITE_CHARTER_ADDRESS` / `VITE_TREASURY_ADDRESS` come from `.env` and **must never contain placeholder values** — the frontend refuses to start (clear error screen) if they are unset or match a known placeholder pattern.

---

## 6. Testing

- `tests/stubs/genlayer/` — pure-Python GenLayer runtime stub (pattern proven in prior work) so all deterministic logic runs under plain pytest.
- Unit suites: amendment state machine (every transition + every guard), membership motions, request state machine, cooldowns, payout arithmetic and double-pay guards, appeal window logic, precedent append-only invariants, JSON view shapes.
- Nondet-path tests: stubbed leader/validator closures exercising validator acceptance rules — schema violations, out-of-range amounts, decision mismatch, PARTIAL tolerance boundary (±10% edges), injection-style responses (extra keys, oversized reason), retry/UNDETERMINED flow.
- Frontend: type-check + build must pass; happy-path E2E is manual against Studio (documented script in `docs/TESTING.md`).

---

## 7. Delivery phases (coder handoffs)

Each phase is one implementation-ready prompt to Antigravity (Codex on escalation). **Every phase's acceptance criteria include: small meaningful commits in the listed order (no single-commit phases), descriptive messages, all tests green, and a changed-files + evidence report.** Claude reviews each phase before the next begins.

| Phase | Scope | Key acceptance criteria |
|---|---|---|
| 1 | Repo scaffold (`contracts/`, `frontend/` placeholder, `tests/`, `docs/`, `scripts/`), GenLayer stub, `charter.py` complete + unit tests | Header/Depends values copied from current Studio docs and recorded in `docs/VERSIONS.md`; amendment FSM fully tested; ≥ 5 commits (scaffold → stub → storage → FSM → tests) |
| 2 | `treasury.py` deterministic core: funding, submit, guards, payout/appeal FSM (adjudication stubbed), views + unit tests | All guards individually tested; no nondet code yet; ≥ 4 commits |
| 3 | Nondet adjudication: leader/validator, precedent log, appeal re-adjudication, retry/UNDETERMINED, injection guards + tests | Validator acceptance rules match §4.4 exactly; cross-contract read verified or fallback implemented per Claude's decision; ≥ 4 commits |
| 4 | Frontend scaffold + all read paths (dashboard, charter, requests, precedents) against a Studio-deployed dev instance | Build + typecheck clean; no write flows yet; env guard against placeholder addresses; ≥ 3 commits |
| 5 | Frontend writes: request form, adjudicate trigger, appeal, payout, amendments + tx lifecycle UI + accessibility/motion polish | FINALIZED+SUCCESS gating verified against Studio; consensus progress UI; ≥ 4 commits |
| 6 | (Claude + user, not a coder phase) Studio deployment of both contracts (require `FINALIZED` + `SUCCESS`), real addresses into `.env`, end-to-end verification, README/submission notes, real-usage journeys from multiple wallets, demo video | Explorer evidence for: bootstrap, funding, ≥ 3 rulings covering APPROVE/PARTIAL/DENY, 1 appeal, 1 ratified amendment followed by a ruling that visibly changes outcome |

## 8. Deployment & release checklist (Phase 6 detail)

1. Deploy `charter.py` → verify tx `FINALIZED` + result `SUCCESS` → `bootstrap` with founding articles (see §9) → verify.
2. Deploy `treasury.py` with the real Charter address → verify `FINALIZED` + `SUCCESS`.
3. Only then write both real addresses into frontend `.env`; never a placeholder.
4. `fund()` from wallet A; add wallet B and C as members via amendments; run the demo journeys (§7 Phase 6) across all three wallets over multiple days before submission.
5. Confirm explorer contract code corresponds to the repo source; record addresses + tx links in README.
6. GitHub push and Vercel deploy are performed by Claude **only after explicit user confirmation for each push and each deploy**, after verifying the intended GitHub account (`ptc123456` or `dietthe030-ux`) and linked Vercel project.
7. Submission notes in plain language: what it does → the trust problem → why GenLayer is required → how a reviewer uses it step by step, naming contract files, the nondet decision, consensus method, live URL, and deployed addresses. No generic AI intro. Claims limited to what the committed code does.

## 9. Founding charter (demo content, ratified at bootstrap)

1. "The treasury reimburses members for conference or workshop tickets directly related to software development, up to the price publicly listed on the event page. Evidence must include the event's official page."
2. "Hardware purchases are reimbursed at 50% of the listed price, up to 0.05 GEN equivalent per request, and require the vendor's public product page as evidence."
3. "Requests without verifiable public evidence for the claimed cost must be denied."
4. "Food, drinks, and entertainment are not reimbursable."

These four articles make APPROVE (article 1), PARTIAL (article 2's 50% rule), and DENY (articles 3/4) all naturally reachable, and article 4 is the designated amendment-demo target (amend to allow team-event food up to a cap, then show a previously denied request type getting approved).

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cross-contract read unsupported/flaky in current Studio | §2.0 fallback (synced charter bundle with version stamp); decision at Phase 3 review |
| PARTIAL amount disagreement between validators | ±10% bounded tolerance; exact agreement on decision; UNDETERMINED (not DENY) on failure |
| Evidence pages too large / dynamic | 6,000-char truncation, delimiters, per-URL failure handled as "evidence unavailable" input to the ruling (article 3 then applies) |
| Prompt injection via purpose/evidence | Closed verdict set, amount/article bounds, schema strictness in validator, explicit prompt hardening |
| Precedent list growth exceeding prompt budget | Fixed window (last 10 summaries, each ≤ 400 chars) |
| Version drift (header, Depends, API names) | Phase 1 records verified values in `docs/VERSIONS.md`; coders must not assume |

---

*This spec is the single source of truth for implementation. Coders implement exactly this; deviations require Claude's approval before code is written.*
