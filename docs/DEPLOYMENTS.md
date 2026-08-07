# Deployment Record

This is the canonical deployment, source-parity, recovery, and live-proof record for LivingCharter.

## Release-candidate status (2026-08-08)

The production application now uses Treasury v3 at `0xa430f80c74cC90a1a75E3906055118e97CdC363b`, with bounded frontend RPC reads (`e6984e3`) and request-liability reservation accounting (`18b4918`). Source parity, the contract live-proof matrix, and production readback are complete below. Treasury v2 at `0x99A0b62199b412421c6466E1C60e0C0D220D2F16` remains an immutable historical deployment.

Candidate Treasury source SHA-256: raw working-tree bytes `f9d000b1a241b1e112690c826a582567fa43fb545f94e988fde817277d949a31`; LF-normalized Studio comparison `5c87bd2fc825dc425067709ee709ffa0e7e41d19e5e346f226cbf11ad4500dcd`.

### Treasury v3 manifest (`POST-DEPLOY`, promotion pending)

| Field | Intended value |
| --- | --- |
| Network | GenLayer Studionet; chain ID `61999`; RPC `https://studio.genlayer.com/api` |
| Contract | [`0xa430f80c74cC90a1a75E3906055118e97CdC363b`](https://explorer-studio.genlayer.com/address/0xa430f80c74cC90a1a75E3906055118e97CdC363b) |
| Deploy transaction | `0x6b97609aa9473e6a53e0e3a9efce0f8a9cf62bcdd1b097f0420f0cbacb6d4087` — status `FINALIZED`; leader and all quorum-participating validators returned `SUCCESS`/agree. Two idle validators were cancelled after quorum (`CONSENSUS_VALIDATOR_QUORUM_REACHED`). |
| Source revision | Commit `18b4918915698140c5649918698fe0f91b997dcc` |
| Source file/hash | `contracts/treasury.py`; RPC `getContractCode` is byte-identical after LF normalization, length 32,009, SHA-256 `5c87bd2fc825dc425067709ee709ffa0e7e41d19e5e346f226cbf11ad4500dcd` |
| Constructor | `charter_address=0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`, `appeal_window_seconds=300`, `member_cooldown_seconds=60` |
| Linked contract | Existing Charter `0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`; verify `get_charter_bundle` before deployment and address readback after deployment |
| Upgrader | None in candidate source |
| Classification | `INTENTIONALLY FROZEN`; explicitly confirmed by the user on 2026-08-08 with acknowledgement that defects require redeployment |
| Configuration order | Deploy → source/schema/state readback → fund → live proof matrix → update frontend Production env → deploy frontend → production readback |
| Deployment wallet | Studio deployer A, `0x7885536194BbD6E1D0A6Ab991aB215CFa9542339`; selected and operated by the user |
| Initial readback | `balance_wei=0`, `reserved_wei=0`, `available_balance_wei=0`, matching Charter address, windows `300/60`, `request_count=0`, `precedent_count=0` |
| Funding | `fund()` with 1 GEN (`1000000000000000000` wei), tx `0x2cae4e12633a1a830d4055279f96ad32723c8a017fa680911eb89468f989ee86`; `FINALIZED`, leader and quorum participants `SUCCESS`/agree |
| Funded readback | `balance_wei=1000000000000000000`, `reserved_wei=0`, `available_balance_wei=1000000000000000000`, `request_count=0`, `precedent_count=0` |
| Reservation setup B | Request #1, 0.6 GEN, tx `0xfe8325af755e473251a9d36bdbdb84629eff62756c99cd8bb65fffc30419176f`; `FINALIZED`, leader `SUCCESS`, quorum agree |
| Reservation setup C | Request #2, 0.4 GEN, tx `0x74679240a7b018d8082cde96de4b672698c092442ace62ef98c62bd6ff826f20`; `FINALIZED`, leader `SUCCESS`, quorum agree |
| Reservation readback | `balance_wei=1000000000000000000`, `reserved_wei=1000000000000000000`, `available_balance_wei=0`, `request_count=2`, both requests `SUBMITTED` with active reservations |

Excluded diagnostic transaction: duplicate B submission `0x833a4ec6465d4ffdc2ae61e75475c60fb90ea809036ad57834873cb7668c5a77` finalized with leader `LLM_RATE_LIMITED/ERROR`. It did not add a request and is not counted as successful evidence.

### Treasury v3 reservation and infrastructure-failure proof

| Action | Transaction/result | Readback |
| --- | --- | --- |
| Aggregate overcommit after B+C reserved the full 1 GEN | `0x17120f816687bbb5368114b53f030ef0bf79c51a71c6e6bd883cf7d846512baa` — `FINALIZED/ERROR/E_INVALID_AMOUNT` | Treasury state byte-for-byte unchanged: balance/reserved 1 GEN, available 0, request count 2 |
| Request #1 first all-evidence failure | `0x37296de50ca63b5434291abef4125afcb4becb4ac949e065dede953befdda7f9` — `FINALIZED/SUCCESS` | `UNDETERMINED`, retries 1, 0.6 GEN reservation retained, no ruling/precedent |
| Request #1 second all-evidence failure | `0xd91cb94d21fbe0a7c37e9a8b32b73c33d22cd152a64fb8079f67c2a913786b40` — `FINALIZED/SUCCESS` | `FAILED`, reservation released; treasury reserved 0.4 GEN, available 0.6 GEN |
| Request #2 first all-evidence failure | `0x6e76afaf1027f170aad17e18f7cef548750f586de15d781fdc9408dd27d1f1a7` — `FINALIZED/SUCCESS` | `UNDETERMINED`, retries 1, 0.4 GEN reservation retained, no ruling/precedent |
| Request #2 second all-evidence failure | `0xef38c067459e5854524774a62d653050e840cfa2ae1e275e8e723d2f35b15e7c` — `FINALIZED/SUCCESS` | `FAILED`, reservation released; balance/available 1 GEN, reserved 0, precedents 0 |
| Replay adjudication of FAILED request #1 | `0x6d5a5d6c7b88a805f16053d7fc1a76d41f9ebdf5795f4ad6515687a394451103` — `FINALIZED/ERROR/E_BAD_STATE` | Treasury state unchanged |

### Treasury v3 product and payout proof

| Action | Transaction/result | Readback |
| --- | --- | --- |
| Submit PyCon request #3 for 0.02 GEN | `0x36810bbaa95dd52e177a459243dc51ead7970ecc595817ddfb38789d3bd74df8` — `FINALIZED/SUCCESS` | `SUBMITTED`; 0.02 GEN reservation active |
| Initial adjudication | `0x8b9cfd1d3b072ec2f3ba9a2790c9a781525d65117896656f48564f37945349e8` — `FINALIZED/SUCCESS` | `APPROVE` 0.02 GEN, article 1, charter v4, precedent #1 |
| Appeal | `0x7e77877b0ba3fafd1157336aea8c4afaac64d600f703b4f98e6f2695a361b658` — `FINALIZED/SUCCESS` | `APPEALED`; reservation retained |
| Appeal adjudication | `0x6b18fb0e0274126f96270bef700b4a2d0c65ae6a0b215b8720439e508d132eb3` — `FINALIZED/SUCCESS` | `FINAL_RULED`, `APPROVE` 0.02 GEN, articles 1+3, precedent #2 |
| Payout | `0xb813d4de58a3f576010fc2401b9a04ccaab62803587cd6f161e7f07beed3162c` — `FINALIZED/SUCCESS` | `PAID`; balance 1.00 → 0.98 GEN; full 0.02 reservation released |
| Payout replay | `0x71ea508fb2da9a9bc99e07cf2f6c8ab3924600afa55eb5c5c35336860e9009be` — `FINALIZED/ERROR/E_ALREADY_PAID` | Treasury state unchanged |

### Charter terminal-amendment proof (Treasury v3 release candidate)

| Action | Transaction/result | Readback |
| --- | --- | --- |
| Cancel amendment #4 before voting | `0x3f87ed0f946fc27aec1980abf63253b222e7a538d20fab969abf4540c414bcd8` — `FINALIZED/SUCCESS` | Amendment #4 `CANCELLED`, yes/no `0/0`; charter version remains 4 |
| Propose tied-vote amendment #5 | `0xca5f9ff23134e85b6802a9a946fa826b5f12ccfe9eaa64521b1191461a628418` — `FINALIZED/SUCCESS` | Amendment #5 created |
| Vote yes on amendment #5 | `0x710bd1cea4967e18495b1c13f2fcac319a3f8b857a44f26491b03803f81b48f8` — `FINALIZED/SUCCESS` | yes/no `1/0` |
| Vote no on amendment #5 | `0x720533b7025ef3ebffe47c6f3fd539fe5785bb980dfb2b261b14b134a4ad2f5e` — `FINALIZED/SUCCESS` | Amendment #5 `VOTING`, yes/no `1/1`, deadline `1786133549` |
| Propose unvoted amendment #6 | `0x65214c394248f62ab6aae70a4dcb12ea7b5a8a1d8ab53f8f41eb8b1e72ac96dc` — `FINALIZED/SUCCESS` | Amendment #6 `PROPOSED`, yes/no `0/0`, deadline `1786133703` |
| Finalize tied-vote amendment #5 | `0x78f83072732975618d9c30e6968f120b4581004f0a539e6390fd7d34fa8ecb95` — `FINALIZED/SUCCESS` | Amendment #5 `REJECTED`, yes/no `1/1` |
| Finalize unvoted amendment #6 | `0xf500575d41ffc7f471f2953d25ef0071dab37c0790554ebda8354c98208ad48d` — `FINALIZED/SUCCESS` | Amendment #6 `EXPIRED`, yes/no `0/0` |

All three terminal amendment proofs left `charter_version=4`, `articles=4`, and `members=3`; neither rejected draft entered the active charter.

### Treasury v3 remaining verdict and terminal proof

| Action | Transaction/result | Readback |
| --- | --- | --- |
| Submit request #4, keyboard 0.04 GEN | `0xdc6b337591ecf1820d27d354cd550e283d41b55ed5121b2e8fccf8a485ce0ae2` — `FINALIZED/SUCCESS` | `SUBMITTED`; 0.04 GEN reservation active |
| Submit request #5, team dinner 0.05 GEN | `0x0e6543d6b7fda562a134818f760a866353050f597bcb9d490da3bacf8f5130bb` — `FINALIZED/SUCCESS` | `SUBMITTED`; aggregate reservation 0.09 GEN |
| Adjudicate request #4 | `0x0c2e5f679cba2a833733ddac5885543bcd63d3631814ddd8ee0242f6c006a93c` — `FINALIZED/SUCCESS` | `DENY`, approved 0, articles 2+3, charter v4, precedent #3 |
| Adjudicate request #5 | `0x775860c726f1bd4b77d3595e2574235ddaf760018d45fc54b85a8670b0e074fa` — `FINALIZED/SUCCESS` | `PARTIAL`, approved 0.03 GEN under article 4 v2 cap, charter v4, precedent #4 |
| Close DENY request #4 after appeal window | `0x52ace311d7be24110f91eab0e917348fd11491090719e0f5871d9dd7e86459d0` — `FINALIZED/SUCCESS` | `CLOSED`; no transfer; 0.04 GEN reservation released |
| Pay PARTIAL request #5 after appeal window | `0x1ea9e9776e696cbc9a0ecdc6d1c21d914f9d7d43e558b83adc08f79640dd2a9b` — `FINALIZED/SUCCESS` | `PAID`; exactly 0.03 GEN transferred; reservation released |
| Replay payout of CLOSED request #4 | `0x44aaa6807675cb21aef6f12dfbcba3e35e48786c307d5fdcf79615e679fb6c2c` — `FINALIZED/ERROR/E_NOT_PAYABLE` | Treasury state unchanged |

Final Treasury v3 readback: `balance_wei=950000000000000000`, `reserved_wei=0`, `available_balance_wei=950000000000000000`, `request_count=5`, `precedent_count=4`.

### Production frontend promotion (2026-08-08)

| Field | Verified value |
| --- | --- |
| Vercel account/team | `hongcham819-3406` / `gam` (`gam9`) |
| Project | `livingcharter` |
| Frontend source revision | `4ba3b8afe74b353d9536895fe6fb54e1629e2937` (the following audit-record commit is docs-only) |
| Production deployment | `dpl_G4amwJFQVwkJA4uvinyueBiDY4MA`; status `READY`; target `production` |
| Immutable deployment URL | `https://livingcharter-neu7vjme7-gam9.vercel.app` |
| Production alias | `https://livingcharter.vercel.app` |
| Production environment | Charter `0x0D22C5298ad1437DB715A543B485588a8e0fc9DB`; Treasury v3 `0xa430f80c74cC90a1a75E3906055118e97CdC363b` |
| HTTP/app-shell verification | Alias returned HTTP 200 with the LivingCharter root app shell |
| Bundle verification | Production bundle contains the Charter and Treasury v3 addresses and does not contain the Treasury v2 address |
| Studionet readback | `0.95 GEN`, charter v4, 4 articles, 3 members, 5 requests, 4 precedents; Treasury reserved 0 and available balance 0.95 GEN |

The frozen-by-default behavior and its irreversibility are documented by [GenLayer's current upgradability guide](https://docs.genlayer.com/developers/intelligent-contracts/features/upgradability).

### Deployment classification and recovery

| Contract | Runtime classification | Release decision |
| --- | --- | --- |
| Charter `0x0D22...c9DB` | Frozen: no upgrader is registered, so GenVM applies the default post-constructor lock | `INTENTIONALLY FROZEN`, explicitly confirmed by the user on 2026-08-08 |
| Treasury v2 `0x99A0...2F16` | Frozen: no upgrader is registered | Historical deployment; to be superseded, not mutated |
| Treasury v3 `0xa430...363b` | No upgrader; permanently frozen after constructor | `INTENTIONALLY FROZEN`, confirmed by the user before the user-executed deployment |

A frozen contract cannot be upgraded or repaired in place. Recovery is: retain the immutable historical address and audit trail; deploy the reviewed source as a new contract with the same Charter/configuration; verify deploy `FINALIZED` plus execution `SUCCESS`; verify deployed-source SHA-256; fund by a new transaction; update `VITE_TREASURY_ADDRESS`; rerun every required live journey; deploy the frontend; and verify chain readback from the production app. If Studionet itself resets, redeploy both contracts, bootstrap the four founding articles, rebuild membership through amendments, and regenerate this record. No private key or local `.secrets/` content belongs in the recovery package.

### Candidate closure matrix

| Review finding | Source change | Automated evidence | Required live evidence |
| --- | --- | --- | --- |
| Concurrent requests can overcommit treasury funds | `reserved_wei`, per-request reservation, unreserved-balance admission, exactly-once terminal release | overcommit, FAILED release, payout conservation, replay, and RPC-shape tests | Two wallets reserve up to capacity; the next request is rejected; terminal payout/closure releases capacity |
| Deployment/recovery classification absent | This section and the README deployment section | user freeze confirmation recorded; documentation consistency review | Deploy receipt, source hash, constructor readback, final recovery manifest |
| Terminal/write-path proof incomplete | Proof matrix below | existing state-machine suites | `cancel_amendment`, `REJECTED`, `EXPIRED`, `UNDETERMINED`, `FAILED`, payout, replay/readback |
| Repo/live revision mismatch | Candidate/live separation in README and this record | pre-push claim scan | v3 address/env, production deployment SHA, HTTP/app readback |

### Required Treasury v3 proof matrix

Rows marked `COMPLETE` are backed by the transaction hashes and readbacks above. Production parity remains a release blocker until the user authorizes promotion.

The secret-free runner source is `frontend/scripts/integration/v3-proof.mjs`; it consumes the existing ignored testnet B/C account file only when the user runs a named step and never prints keys.

| Journey | Required proof |
| --- | --- |
| Deployment parity | **COMPLETE** — deploy tx, constructor `Charter/300/60`, 10-method schema, exact deployed-source SHA-256, and zero-state readback verified by Codex RPC checks |
| Reservation overcommit | **COMPLETE** — B+C successful reservations, rejected aggregate-overcommit tx `0x17120f...2baa`, unchanged state readback |
| Reservation conservation | **COMPLETE** — exact 0.02 GEN full payout, 0.03 GEN PARTIAL payout, zero-value DENY closure, all reservations released, and replay guards verified |
| Infrastructure ladder | **COMPLETE** — requests #1/#2 each show `UNDETERMINED → FAILED`; no ruling or precedent; reservations fully released; FAILED replay rejected |
| Amendment cancellation | **COMPLETE** — `cancel_amendment` tx `0x3f87ed...bcd8`, amendment #4 `CANCELLED` readback, charter unchanged |
| Amendment rejection | **COMPLETE** — amendment #5 finalized `REJECTED` after a 1–1 tie; charter unchanged |
| Amendment expiration | **COMPLETE** — unvoted amendment #6 finalized `EXPIRED`; charter unchanged |
| Advertised product journey | **COMPLETE** — APPROVE + appeal, DENY, PARTIAL at article 4 v2's 0.03 GEN cap, terminal payout/closure, and four v3 precedents |
| Production parity | **COMPLETE** — Production env embeds Charter + Treasury v3 (no v2 address), HTTP 200/app shell verified, and live reads match `0.95 GEN`, charter v4, 4 articles, 3 members, 5 requests, 4 precedents |

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
| submit_request #5 — PyCon Student ticket 0.01 GEN (pre-submission journey) | B | SUBMITTED | `0xec570311699f2282db746522625288acc246ac7f6685b8d47f45f1a95ac60b6d` |
| adjudicate #5 | C | **APPROVE** — ruling quotes "$139 USD" Student price, cites art. 1 and precedent seq=1 | `0xcf3014bc6dec86b03aee722a55a58888de9e08451e0a4ffedd244e9de16dfd42` |
| execute_payout #5 → PAID 0.01 GEN to B | C | PAID | `0x7bed2fbc8ce0b53a892bed93832f6c3d60afd3669e0dc5b5e00f25090fca38eb` |

Final on-chain state at submission: balance 0.94 GEN; 5 requests all terminal; 6 precedents; charter v4; 3 members.

## Final submission instance (decided 2026-07-27)

Charter + Treasury v2 above ARE the submission deployment (user-approved) — they carry genuine multi-wallet activity.

## Release (2026-07-27)

| Item | Value |
| --- | --- |
| Public repository | https://github.com/ldkfj/livingcharter (branch `master`) |
| Live application | https://livingcharter.vercel.app (Vercel project `livingcharter`, framework Vite, output `dist`) |
| Production env | `VITE_CHARTER_ADDRESS`, `VITE_TREASURY_ADDRESS` set to the addresses above (public values, not secrets) |
| Push/deploy executed by | GPT/Codex under an explicit per-task user override of the standing no-push rule; verified by Claude (repo content, live HTTP 200 + correct Studionet reads) |
| Production frontend build | Deployed from commit `8e54332`; documentation commits continue on `master` after that build |

Note: `.secrets/` (testnet bot keys) and `frontend/.env` are gitignored and verified absent from the published history.
