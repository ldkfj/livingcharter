# Deployment Record

## Dev instance — GenLayer Studionet (deployed 2026-07-26)

Development/integration instance for frontend Phase 4–5. Not the final submission deployment.

| Item | Value |
| --- | --- |
| Network | GenLayer Studionet, chain ID `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Charter | `0x0D22C5298ad1437DB715A543B485588a8e0fc9DB` |
| Treasury | `0xB984B0a79B9BC17C332017B0640Dc82eE6151393` |
| Constructor args | Charter: `voting_period_seconds=300`. Treasury: `charter_address=<Charter>`, `appeal_window_seconds=300`, `member_cooldown_seconds=60` |
| Charter deploy tx | `0xad8e0e06ae6872114d37f935b39f270f81ea5fccce2302f89b8ba95d2d281246` — FINALIZED, SUCCESS, consensus Accepted (all validators Agree) |
| Bootstrap | 4 founding articles ratified; `get_charter_bundle` verified `charter_version: 1` |
| Treasury verify | `get_treasury_state` verified: matching charter address, `balance_wei: 0`, window 300s, cooldown 60s |

| Fund smoke test | `fund` with Studio Value field `1` → `balance_wei: 1000000000000000000` (1 GEN) verified via `get_treasury_state` |

Verification rule: every transaction must show Status `FINALIZED` **and** Result `SUCCESS` before the step counts.

Gotcha (Studio UI): the write-method **Value** field accepts integers only and denominates in whole GEN (`1` → 10^18 wei). Decimals like `0.1` throw "cannot be converted to a BigInt". Stale contract entries from other sessions produce harmless `gen_getContractSchema ... not found` log errors — ignore any error naming an address that is not one of ours.

## Final submission instance

_Not deployed yet — Phase 6. Never put placeholder addresses in `.env`._
