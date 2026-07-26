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

## Final submission instance

_Not deployed yet — Phase 6. Never put placeholder addresses in `.env`._
