# Deployment Record

## Dev instance — GenLayer Studionet (deployed 2026-07-26)

Development/integration instance for frontend Phase 4–5. Not the final submission deployment.

| Item | Value |
| --- | --- |
| Network | GenLayer Studionet, chain ID `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Charter | `0x0D22C5298ad1437DB715A543B485588a8e0fc9DB` |
| Treasury | `0xB984B0a79B9BC17C332017B0640Dc82eE6151393` |
| Constructor args | Charter: `voting_period_seconds=300`. Treasury: `charter_address=0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`, `appeal_window_seconds=300`, `member_cooldown_seconds=60` |
| Charter deploy tx | `0xad8e0e06ae6872114d37f935b39f270f81ea5fccce2302f89b8ba95d2d281246` — FINALIZED, SUCCESS, consensus Accepted (all validators Agree) |
| Treasury deploy tx | `0x3518b1a775bff5ab9aca944d4ac9b9f498996efad520bcfc5f4c774efaca13c7` — FINALIZED, MAJORITY_AGREE, leader + 5 validators SUCCESS |
| Charter bootstrap tx | `0x6ae6b566c1a7e7fbeaa6241740bd7bc570d491e17b3bf755bf750ac34f6d430e` — FINALIZED, MAJORITY_AGREE, all executions SUCCESS |
| Treasury funding tx | `0x72767247b9cc72b12b8c16a770d2e02da65596e60ff7e4b42566c9a243c8500d` — FINALIZED, MAJORITY_AGREE, all executions SUCCESS |
| Bootstrap | 4 founding articles ratified; `get_charter_bundle` verified `charter_version: 1` |
| Deployed-source hashes (verified byte-for-byte vs repo HEAD) | Charter SHA-256 `d53c72938404fcd21cb6a4cb370ac8c4bd57737ca2472ee98cd34b1beaf43a4d`; Treasury SHA-256 `6fcfceecb80a806e2f282314b93a7ccc3b74c827b019a5aa49bbc8a2e5decfd4` |
| Treasury verify | `get_treasury_state` verified: matching charter address, `balance_wei: 0`, window 300s, cooldown 60s |

| Fund smoke test | `fund` with Studio Value field `1` → `balance_wei: 1000000000000000000` (1 GEN) verified via `get_treasury_state` |

Verification rule: every transaction must show Status `FINALIZED` **and** Result `SUCCESS` before the step counts.

Gotcha (Studio UI): the write-method **Value** field accepts integers only and denominates in whole GEN (`1` → 10^18 wei). Decimals like `0.1` throw "cannot be converted to a BigInt". Stale contract entries from other sessions produce harmless `gen_getContractSchema ... not found` log errors — ignore any error naming an address that is not one of ours.

## Dev instance v2 — Treasury redeployment (2026-07-27)

Treasury v1 rendered evidence with `mode="html"`, so the 6000-char window carried only head-HTML and every request was denied under article 3 (two authentic denials recorded on v1 — the strictness working as designed against bad evidence). SPEC §4.4 specifies text mode; hotfix commit `a471c5e` restored conformance and Treasury was redeployed by the user via Studio. Charter is unchanged.

| Item | Value |
| --- | --- |
| Treasury v2 | `0x99A0b62199b412421c6466E1C60e0C0D220D2F16` |
| Constructor | `charter_address=0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`, `appeal_window_seconds=300`, `member_cooldown_seconds=60` |
| Funding | `fund()` 1 GEN from member B — tx `0x6272abd697da8d4c48b1b29a19e2ba9a2de63719a7f488c746187d8ea1437853` |

### Integration journey (2026-07-27, members A=deployer, B/C=scripted wallets, all tx FINALIZED+SUCCESS)

| Event | Outcome | Tx |
| --- | --- | --- |
| Members B, C added via amendments 1–2 (A via Studio; B voted/finalized by script) | 3 members, charter v3 | vote `0xd559...ee28`, finalize `0xb0c0...dae0` |
| Req #1 (B): PyCon ticket 0.02 GEN, evidence = registration price page | **APPROVE** — AI read "$469 USD Individual" from the page, cited art. 1 | submit `0xe4ad...c971`, adjudicate `0x16ad...aabc` |
| Req #2 (C): keyboard 0.04 GEN, Keychron product page | **DENY** (art. 3 — no price in fetched text) | submit `0x266c...f488`, adjudicate `0x4476...b4a7` |
| Req #2 appeal (C) | **DENY upheld** → FINAL_RULED (precedent #3, is_appeal) | appeal `0xc635...64ef`, adjudicate `0x580e...6be1` |
| Payouts | #1 PAID 0.02 GEN → B (`0x3f09...24e8`); #2 CLOSED (`0x617c...90ba`) | |
| Req #3 (B): team dinner 0.02 GEN | **DENY** (art. 4 v1: food not reimbursable) → CLOSED `0xe100...ea86` | submit `0x6de4...da91`, adjudicate `0x244e...8ddb` |
| Amendment 3: REPLACE art. 4 (B proposes, B+C vote, finalize) | **RATIFIED** — charter v4, food allowed ≤0.03 GEN for documented team events | `0x3e31...4d6f`, `0x8cee...b22b`, `0x4d6d...53cf`, `0xd46e...5cc9` |
| Req #4 (C): team dinner 0.05 GEN after amendment | **PARTIAL 0.03 GEN** — cited art. 4 **v2**, cap applied → PAID `0xf8fd...6120` | submit `0xda7c...4124`, adjudicate `0xd7af...9175` |

Final state: balance 0.95 GEN; 4 requests all terminal (PAID/CLOSED/CLOSED/PAID); 5 precedents; the same request type denied under charter v3 (precedent #4) is partially approved under v4 (precedent #5) — the living-charter loop demonstrated on-chain.

## Final submission instance

_Recommendation: adopt Charter + Treasury v2 above as the submission deployment — they already carry genuine multi-wallet activity. Decision at Phase 6. Never put placeholder addresses in `.env`._
