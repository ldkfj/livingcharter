# LivingCharter — Submission Notes

LivingCharter is a shared treasury governed by a plain-language charter that members amend by vote. Each spend request carries public evidence URLs. GenLayer validators independently fetch those pages, interpret the charter together with the most recent on-chain precedents, and reach consensus on APPROVE, PARTIAL, or DENY; once the appeal window closes, anyone can execute the payout on-chain. Rulings join an append-only precedent log.

Why GenLayer: the decision needs live web reading, natural-language interpretation, and multi-validator consensus at once. Core: gl.vm.run_nondet_unsafe in contracts/treasury.py — leader and validators each re-fetch evidence and re-evaluate under strict schema and amount rules.

Live: https://livingcharter.vercel.app (Studionet). Charter 0x0D22C5298ad1437DB715A543B485588a8e0fc9DB, Treasury 0x99A0b62199b412421c6466E1C60e0C0D220D2F16. Repo: https://github.com/ldkfj/livingcharter (guide: docs/REVIEWER-GUIDE.md).
