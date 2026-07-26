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
| Treasury v2 deploy tx | `0xf69b1d4b971b1bdad3cf550b2fe4dd7d91789de735f96bc51cb4fe5506435aef` — FINALIZED, SUCCESS |
| Deployed-source SHA-256 (byte-identical to repo `contracts/treasury.py`) | `a7d66d34b4475d6a1ae1519ff15d44c4691ccb8f618bbb730cd2e51e40512706` |
| Constructor | `charter_address=0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`, `appeal_window_seconds=300`, `member_cooldown_seconds=60` |
| Funding | `fund()` 1 GEN from member B — tx `0x6272abd697da8d4c48b1b29a19e2ba9a2de63719a7f488c746187d8ea1437853` |

### Integration journey (2026-07-27, members A=Studio deployer, B/C=scripted wallets). Every transaction below: FINALIZED, execution SUCCESS, consensus Accepted.

Membership setup (Charter):

| Action | Actor | Tx |
| --- | --- | --- |
| propose_amendment #1 (ADD_MEMBER B) | A | `0x229916079bd86c874c3eaf31d7ee4ab9b393eb12f40dad5d019e03db66f45ee7` |
| vote #1 yes | A | `0x3446d67fad90b8e0931c7f876ee4662284d90cefac2f5f62022ec50366fc8d2a` |
| finalize #1 → B active | A | `0x5047a278382b04599ba699fdb34814a2102efc367a6d42cd8a560983b6197216` |
| propose_amendment #2 (ADD_MEMBER C) | A | `0x6f83824f97e20246da2e00997fed21c2c646e6760952a9542ab5fa17f47cd795` |
| vote #2 yes | A | `0x35bad19b3d08ed2c8eacfae6c16105076d719a8e4937e7ed01afb6f59e22bafb` |
| vote #2 yes | B | `0xd55944435d97452b48f9ca819291d781ef59553ca9930652532edae45fa7ee28` |
| finalize #2 → C active (3 members, charter v3) | B | `0xb0c044db10fe9fc7476f3ae6bcfddf30539d9b2ab3f9be60456fad5940f0dae0` |

Spend requests (Treasury v2):

| Action | Actor | Outcome | Tx |
| --- | --- | --- | --- |
| submit_request #1 — PyCon ticket 0.02 GEN, evidence = registration price page | B | SUBMITTED | `0xe4ad7a7c773782f3d9a4a57cff821fe689059fef676a5a19692e5006289ec971` |
| adjudicate #1 | C | **APPROVE** — ruling quotes "$469 USD" Individual price, cites art. 1 | `0x16ada0aa0e3ab268d248d656bd065eb8dac115cf6ce7c71a0c40a0c80e6eaabc` |
| submit_request #2 — keyboard 0.04 GEN, Keychron product page | C | SUBMITTED | `0x266cad5d39b3e45e6ef19749eceef00c7ecd1e0e5da3a760ac5149da80c5f488` |
| adjudicate #2 | B | **DENY** (art. 3 — no price in fetched text) | `0x4476bb2daf8616b75b629d0c8cae22000049b36e2902bd146c7e28680a21b4a7` |
| appeal_ruling #2 | C | APPEALED | `0xc635e9ad51e643adaf8d69f336c4da28ba1eee2f22310b16d9e34377ea8464ef` |
| adjudicate #2 (appeal) | B | **DENY upheld** → FINAL_RULED (precedent #3, is_appeal) | `0x580ef5d3007f480d221ead9d717f8c0998d4982fc4f2db42c7ff3b1596476be1` |
| execute_payout #1 → PAID 0.02 GEN to B | C | PAID | `0x3f0989211c40a72b1b087c9f81907d305f312762136656508cd40be5271c24e8` |
| execute_payout #2 (zero) → CLOSED | C | CLOSED | `0x617c88b96356850b913b6c2aaff59daae65eaca7ab5aed424274d821e79090ba` |
| submit_request #3 — team dinner 0.02 GEN | B | SUBMITTED | `0x6de47fec0a7a4672f22b164f063d5ca40176d00a34cdf058e62aeee948fdda91` |
| adjudicate #3 | C | **DENY** (art. 4 v1: food not reimbursable) | `0x244e5ed95037b885c0a12700704750b79426fc9af641424fc46d7de5672e8ddb` |
| execute_payout #3 (zero) → CLOSED | C | CLOSED | `0xe100ab4abc1a17c97039f879b9b174388503c788f4fbe640e1cd29a2a8cea386` |
| propose_amendment #3 (REPLACE art. 4) | B | PROPOSED | `0x3e31f6f50ba7b34327196830dc5e602759d4ecb82cc91edb2ca413d0babf4d6f` |
| vote #3 yes | B | | `0x8cee1d2d81821054560a5b8be81909111195aead1c3af4622b82c067fe01b22b` |
| vote #3 yes | C | | `0x4d6d0dd8dcd29e6d8980a3cc06ef256dacf874be36833cae5a1984475ea253cf` |
| finalize #3 → **RATIFIED**, charter v4 (food ≤0.03 GEN for documented team events) | B | RATIFIED | `0xd46ef231330ba9684713005de2cb6016b3d3fc0c102f6e72545b32e8a935cc9f` |
| submit_request #4 — team dinner 0.05 GEN (post-amendment) | C | SUBMITTED | `0xda7c98f02bcdbde4f5ab2f6506bd4257627c7fb3d9c14f21654b8be93e0e4124` |
| adjudicate #4 | B | **PARTIAL 0.03 GEN** — cites art. 4 **v2**, cap applied | `0xd7afa8d03a5834470e953c99ee012bdf09d585bfcb11fda7e5da36311c907175` |
| execute_payout #4 → PAID 0.03 GEN to C | C | PAID | `0xf8fd83ebe157d23a8b7db6bc1e3892dd0f6ad7681a9cd3dc456d3fa71be06120` |

Final state: balance 0.95 GEN; 4 requests all terminal (PAID/CLOSED/CLOSED/PAID); 5 precedents; the same request type denied under charter v3 (precedent #4) is partially approved under v4 (precedent #5) — the living-charter loop demonstrated on-chain.

## Final submission instance

_Recommendation: adopt Charter + Treasury v2 above as the submission deployment — they already carry genuine multi-wallet activity. Decision at Phase 6. Never put placeholder addresses in `.env`._
