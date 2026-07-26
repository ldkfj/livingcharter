# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Treasury Intelligent Contract — Deterministic treasury management and request state machine.

Storage Approach:
    Storage-compatible dataclasses (@allow_storage @dataclass) stored inside TreeMap and DynArray collections.

Open Request Tracking Rule:
    A member's open request entry (open_request[requester]) is set when a request is submitted and remains
    active throughout initial adjudication and appeal windows. It is cleared ONLY when the request reaches
    a terminal state (PAID, CLOSED, or FAILED). This prevents members from stacking requests during appeal windows.

Constants:
    Decisions:
        DECISION_NONE = 0
        DECISION_APPROVE = 1
        DECISION_PARTIAL = 2
        DECISION_DENY = 3

    Request states:
        REQ_SUBMITTED = 0
        REQ_RULED = 1
        REQ_APPEALED = 2
        REQ_FINAL_RULED = 3
        REQ_PAID = 4
        REQ_CLOSED = 5
        REQ_UNDETERMINED = 6
        REQ_FAILED = 7

Error Codes:
    E_ZERO_FUNDING — Funding value must be greater than zero
    E_NOT_MEMBER — Caller is not an active Charter member
    E_INVALID_AMOUNT — Requested amount must be > 0 and <= contract balance
    E_INVALID_PURPOSE — Purpose length must be between 10 and 600 characters
    E_NO_EVIDENCE — At least one evidence URL must be provided
    E_INVALID_EVIDENCE_URL — Evidence URL is malformed, too long (>300), or contains credentials
    E_OPEN_REQUEST_EXISTS — Requester already has an open non-terminal request
    E_COOLDOWN_ACTIVE — Cooldown period since last submission has not elapsed
    E_REQUEST_NOT_FOUND — Request ID does not exist
    E_INVALID_RULING — Ruling parameters violate decision schema or amount bounds
    E_BAD_STATE — Request is not in a valid state for this operation
    E_ADJUDICATION_NOT_WIRED — Adjudication flow is not wired in Phase 2
    E_APPEAL_WINDOW_CLOSED — Appeal deadline has passed
    E_ALREADY_APPEALED — Request has already been appealed
    E_NOT_ALLOWED — Caller is not requester or active member
    E_INVALID_ARGUMENT — Appeal argument length must be between 20 and 1000 characters
    E_NOT_PAYABLE — Request is not eligible for payout or closure
    E_ALREADY_PAID — Payout has already been executed for this request
    E_INSUFFICIENT_BALANCE — Contract balance is insufficient for payout
"""

from __future__ import annotations
from dataclasses import dataclass
from genlayer import *
import json

DECISION_NONE = 0
DECISION_APPROVE = 1
DECISION_PARTIAL = 2
DECISION_DENY = 3

DECISION_NAMES = ["NONE", "APPROVE", "PARTIAL", "DENY"]

REQ_SUBMITTED = 0
REQ_RULED = 1
REQ_APPEALED = 2
REQ_FINAL_RULED = 3
REQ_PAID = 4
REQ_CLOSED = 5
REQ_UNDETERMINED = 6
REQ_FAILED = 7

STATE_NAMES = [
    "SUBMITTED",
    "RULED",
    "APPEALED",
    "FINAL_RULED",
    "PAID",
    "CLOSED",
    "UNDETERMINED",
    "FAILED",
]


@allow_storage
@dataclass
class RulingRec:
    decision: u8
    approved_amount_wei: u256
    cited_article_ids_json: str
    charter_version: u32
    reason: str
    precedent_seq: u32


@allow_storage
@dataclass
class RequestRec:
    id: u32
    requester: Address
    amount_wei: u256
    purpose: str
    evidence_urls_json: str
    state: u8
    created_at: u64
    ruled_at: u64
    appeal_deadline: u64
    retries: u8
    appealed: bool
    appellant: Address
    appeal_argument: str
    paid: bool


@allow_storage
@dataclass
class PrecedentRec:
    seq: u32
    request_id: u32
    decision: u8
    requested_wei: u256
    approved_wei: u256
    cited_article_ids_json: str
    charter_version: u32
    summary: str
    created_at: u64
    is_appeal: bool


class Treasury(gl.Contract):
    charter_address: Address
    appeal_window_seconds: u64
    member_cooldown_seconds: u64
    requests: TreeMap[u32, RequestRec]
    request_count: u32
    rulings: TreeMap[u32, RulingRec]
    appeal_rulings: TreeMap[u32, RulingRec]
    precedents: DynArray[PrecedentRec]
    precedent_count: u32
    last_request_at: TreeMap[Address, u64]
    open_request: TreeMap[Address, u32]

    def __init__(
        self,
        charter_address: str,
        appeal_window_seconds: int = 600,
        member_cooldown_seconds: int = 300,
    ):
        self.charter_address = Address(charter_address)
        self.appeal_window_seconds = appeal_window_seconds
        self.member_cooldown_seconds = member_cooldown_seconds
        self.request_count = 0
        self.precedent_count = 0

    def _now(self) -> int:
        """Internal timestamp helper.
        TODO: Re-verify block timestamp accessor at deployment.
        """
        raise NotImplementedError("Block timestamp accessor not wired in stub; see https://docs.genlayer.com")

    def _is_active_member(self, addr: Address) -> bool:
        """Internal cross-contract check to Charter.
        TODO: Re-verify cross-contract call syntax at deployment.
        """
        raise NotImplementedError("Cross-contract read to Charter not wired in stub; see https://docs.genlayer.com/developers/intelligent-contracts/interacting-with-other-contracts")

    def _balance(self) -> int:
        """Internal contract native balance helper.
        TODO: Re-verify balance accessor at deployment.
        """
        raise NotImplementedError("Native balance accessor not wired in stub; see https://docs.genlayer.com/developers/intelligent-contracts/balances-and-transfers")

    def _transfer(self, to: Address, amount_wei: int) -> None:
        """Internal native GEN transfer helper.
        TODO: Re-verify transfer call syntax at deployment.
        """
        raise NotImplementedError("Native transfer accessor not wired in stub; see https://docs.genlayer.com/developers/intelligent-contracts/balances-and-transfers")

    @gl.public.write.payable
    def fund(self):
        if gl.message.value <= 0:
            raise Exception("E_ZERO_FUNDING")

    @gl.public.write
    def submit_request(
        self,
        amount_wei: int,
        purpose: str,
        url1: str,
        url2: str = "",
        url3: str = "",
    ) -> int:
        caller = gl.message.sender_address

        if not self._is_active_member(caller):
            raise Exception("E_NOT_MEMBER")

        if not (0 < amount_wei <= self._balance()):
            raise Exception("E_INVALID_AMOUNT")

        if not (10 <= len(purpose) <= 600):
            raise Exception("E_INVALID_PURPOSE")

        raw_urls = [url1, url2, url3]
        urls = [u for u in raw_urls if u != ""]

        if len(urls) == 0:
            raise Exception("E_NO_EVIDENCE")

        for u in urls:
            if not (u.startswith("http://") or u.startswith("https://")):
                raise Exception("E_INVALID_EVIDENCE_URL")
            if len(u) > 300:
                raise Exception("E_INVALID_EVIDENCE_URL")

            scheme_offset = 7 if u.startswith("http://") else 8
            rest = u[scheme_offset:]
            slash_idx = rest.find("/")
            host_part = rest[:slash_idx] if slash_idx != -1 else rest
            if "@" in host_part:
                raise Exception("E_INVALID_EVIDENCE_URL")

        if self.open_request.get(caller, 0) != 0:
            raise Exception("E_OPEN_REQUEST_EXISTS")

        now = self._now()
        last_time = self.last_request_at.get(caller, 0)
        if last_time != 0 and (now - last_time < self.member_cooldown_seconds):
            raise Exception("E_COOLDOWN_ACTIVE")

        self.request_count += 1
        rid = self.request_count

        self.requests[rid] = RequestRec(
            id=rid,
            requester=caller,
            amount_wei=amount_wei,
            purpose=purpose,
            evidence_urls_json=json.dumps(urls),
            state=REQ_SUBMITTED,
            created_at=now,
            ruled_at=0,
            appeal_deadline=0,
            retries=0,
            appealed=False,
            appellant=Address("0x" + "0" * 40),
            appeal_argument="",
            paid=False,
        )

        self.open_request[caller] = rid
        self.last_request_at[caller] = now
        return rid

    def _apply_ruling(
        self,
        request_id: int,
        decision: int,
        approved_amount_wei: int,
        cited_article_ids_json: str,
        charter_version: int,
        reason: str,
        is_appeal: bool,
    ):
        if request_id not in self.requests:
            raise Exception("E_REQUEST_NOT_FOUND")

        req = self.requests[request_id]

        if decision not in (DECISION_APPROVE, DECISION_PARTIAL, DECISION_DENY):
            raise Exception("E_INVALID_RULING")

        if decision == DECISION_APPROVE and approved_amount_wei != req.amount_wei:
            raise Exception("E_INVALID_RULING")
        if decision == DECISION_DENY and approved_amount_wei != 0:
            raise Exception("E_INVALID_RULING")
        if decision == DECISION_PARTIAL and not (0 < approved_amount_wei < req.amount_wei):
            raise Exception("E_INVALID_RULING")

        if not (1 <= len(reason) <= 500):
            raise Exception("E_INVALID_RULING")

        now = self._now()
        self.precedent_count += 1
        seq = self.precedent_count
        summary = f"{DECISION_NAMES[decision]}: {reason}"[:400]

        ruling = RulingRec(
            decision=decision,
            approved_amount_wei=approved_amount_wei,
            cited_article_ids_json=cited_article_ids_json,
            charter_version=charter_version,
            reason=reason,
            precedent_seq=seq,
        )

        if is_appeal:
            self.appeal_rulings[request_id] = ruling
            req.state = REQ_FINAL_RULED
        else:
            self.rulings[request_id] = ruling
            req.state = REQ_RULED
            req.ruled_at = now
            req.appeal_deadline = now + self.appeal_window_seconds

        precedent = PrecedentRec(
            seq=seq,
            request_id=request_id,
            decision=decision,
            requested_wei=req.amount_wei,
            approved_wei=approved_amount_wei,
            cited_article_ids_json=cited_article_ids_json,
            charter_version=charter_version,
            summary=summary,
            created_at=now,
            is_appeal=is_appeal,
        )
        self.precedents.append(precedent)

    @gl.public.write
    def adjudicate_request(self, request_id: int):
        if request_id not in self.requests:
            raise Exception("E_REQUEST_NOT_FOUND")

        req = self.requests[request_id]
        if req.state not in (REQ_SUBMITTED, REQ_APPEALED, REQ_UNDETERMINED):
            raise Exception("E_BAD_STATE")

        raise Exception("E_ADJUDICATION_NOT_WIRED")

    def _mark_undetermined(self, request_id: int):
        if request_id not in self.requests:
            raise Exception("E_REQUEST_NOT_FOUND")

        req = self.requests[request_id]
        req.retries += 1
        if req.retries <= 1:
            req.state = REQ_UNDETERMINED
        else:
            req.state = REQ_FAILED
            self.open_request[req.requester] = 0

    @gl.public.write
    def appeal_ruling(self, request_id: int, argument: str):
        if request_id not in self.requests:
            raise Exception("E_REQUEST_NOT_FOUND")

        req = self.requests[request_id]
        if req.state != REQ_RULED:
            raise Exception("E_BAD_STATE")

        now = self._now()
        if now >= req.appeal_deadline:
            raise Exception("E_APPEAL_WINDOW_CLOSED")

        if req.appealed:
            raise Exception("E_ALREADY_APPEALED")

        caller = gl.message.sender_address
        if not (caller == req.requester or self._is_active_member(caller)):
            raise Exception("E_NOT_ALLOWED")

        if not (20 <= len(argument) <= 1000):
            raise Exception("E_INVALID_ARGUMENT")

        req.appealed = True
        req.appellant = caller
        req.appeal_argument = argument
        req.state = REQ_APPEALED

    @gl.public.write
    def execute_payout(self, request_id: int):
        if request_id not in self.requests:
            raise Exception("E_REQUEST_NOT_FOUND")

        req = self.requests[request_id]
        if req.paid:
            raise Exception("E_ALREADY_PAID")

        now = self._now()
        eligible = (req.state == REQ_FINAL_RULED) or (
            req.state == REQ_RULED and now >= req.appeal_deadline
        )

        if not eligible:
            raise Exception("E_NOT_PAYABLE")

        ruling = (
            self.appeal_rulings[request_id]
            if request_id in self.appeal_rulings
            else self.rulings[request_id]
        )

        if ruling.approved_amount_wei > 0:
            if ruling.approved_amount_wei > self._balance():
                raise Exception("E_INSUFFICIENT_BALANCE")
            self._transfer(req.requester, ruling.approved_amount_wei)
            req.paid = True
            req.state = REQ_PAID
        else:
            req.state = REQ_CLOSED

        self.open_request[req.requester] = 0

    @gl.public.view
    def get_request(self, request_id: int) -> str:
        if request_id not in self.requests:
            raise Exception("E_REQUEST_NOT_FOUND")

        req = self.requests[request_id]

        init_r = None
        if request_id in self.rulings:
            r = self.rulings[request_id]
            init_r = {
                "decision": r.decision,
                "decision_name": DECISION_NAMES[r.decision],
                "approved_amount_wei": r.approved_amount_wei,
                "cited_article_ids": json.loads(r.cited_article_ids_json),
                "charter_version": r.charter_version,
                "reason": r.reason,
                "precedent_seq": r.precedent_seq,
            }

        app_r = None
        if request_id in self.appeal_rulings:
            r = self.appeal_rulings[request_id]
            app_r = {
                "decision": r.decision,
                "decision_name": DECISION_NAMES[r.decision],
                "approved_amount_wei": r.approved_amount_wei,
                "cited_article_ids": json.loads(r.cited_article_ids_json),
                "charter_version": r.charter_version,
                "reason": r.reason,
                "precedent_seq": r.precedent_seq,
            }

        req_hex = req.requester.as_hex if hasattr(req.requester, "as_hex") else str(req.requester)
        app_hex = req.appellant.as_hex if hasattr(req.appellant, "as_hex") else str(req.appellant)

        res = {
            "id": req.id,
            "requester": req_hex,
            "amount_wei": req.amount_wei,
            "purpose": req.purpose,
            "evidence_urls": json.loads(req.evidence_urls_json),
            "state": req.state,
            "state_name": STATE_NAMES[req.state],
            "created_at": req.created_at,
            "ruled_at": req.ruled_at,
            "appeal_deadline": req.appeal_deadline,
            "retries": req.retries,
            "appealed": req.appealed,
            "appellant": app_hex,
            "appeal_argument": req.appeal_argument,
            "paid": req.paid,
            "initial_ruling": init_r,
            "appeal_ruling": app_r,
        }
        return json.dumps(res)

    @gl.public.view
    def get_request_count(self) -> str:
        return json.dumps(self.request_count)

    @gl.public.view
    def get_precedents(self, offset: int, limit: int) -> str:
        limit = min(limit, 20)
        total = len(self.precedents)
        if offset >= total:
            return json.dumps([])

        newest = list(reversed(list(self.precedents)))
        page = newest[offset : offset + limit]

        res = []
        for p in page:
            res.append({
                "seq": p.seq,
                "request_id": p.request_id,
                "decision": p.decision,
                "decision_name": DECISION_NAMES[p.decision],
                "requested_wei": p.requested_wei,
                "approved_wei": p.approved_wei,
                "cited_article_ids": json.loads(p.cited_article_ids_json),
                "charter_version": p.charter_version,
                "summary": p.summary,
                "created_at": p.created_at,
                "is_appeal": p.is_appeal,
            })
        return json.dumps(res)

    @gl.public.view
    def get_precedent_count(self) -> str:
        return json.dumps(self.precedent_count)

    @gl.public.view
    def get_treasury_state(self) -> str:
        charter_hex = self.charter_address.as_hex if hasattr(self.charter_address, "as_hex") else str(self.charter_address)
        res = {
            "charter_address": charter_hex,
            "appeal_window_seconds": self.appeal_window_seconds,
            "member_cooldown_seconds": self.member_cooldown_seconds,
            "request_count": self.request_count,
            "precedent_count": self.precedent_count,
        }
        return json.dumps(res)
