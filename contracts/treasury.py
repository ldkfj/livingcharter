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
