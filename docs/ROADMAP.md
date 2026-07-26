# LivingCharter — Roadmap

Everything below is **future work** — none of it exists in the current build. The deployed v1 is described in the [README](../README.md).

## Near term (v1.x — hardening the current loop)

- **Governance-set parameters**: move `appeal_window_seconds` and `member_cooldown_seconds` from constructor values into charter-amendable parameters, so the community tunes its own process the same way it tunes spending rules.
- **Cross-source corroboration**: an optional per-article rule requiring two independent evidence URLs to agree before APPROVE (the request format already accepts up to three URLs).
- **Precedent browsing by article**: filter the precedent log by cited article in the UI, so members can read "case law" for a rule before submitting.
- **Public testnet deployment**: redeploy to Testnet Asimov/Bradbury for durable persistence once the dev iteration settles.

## Mid term (v2 — smarter adjudication)

- **Relevance-based precedent retrieval**: select the precedents that cite the same articles as the pending request instead of the most-recent-ten window, keeping the "case law" context sharp as history grows.
- **Configurable voting**: quorum thresholds and weighted votes defined by the charter itself; optional vote delegation between members.
- **Treasury analytics**: spend by article, approval/denial rates over time, per-member history — all derived from the on-chain precedent log.

## Long term (v3 — beyond one treasury)

- **Multi-treasury federation**: a parent charter whose articles bind sub-treasuries, with sub-charter amendments that cannot contradict the parent — organizational constitutional law.
- **Charter templates**: reusable, community-audited starting charters (open-source project fund, student club, grant round) deployable in one step.
- **Governance as a module**: expose the adjudication + precedent engine so other GenLayer contracts can submit their own "requests" for charter-governed rulings.
