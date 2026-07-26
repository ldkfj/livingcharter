# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Charter Intelligent Contract — Deterministic natural-language charter governance.

Storage Approach:
    Storage-compatible dataclasses (@allow_storage @dataclass) stored inside TreeMap collections.
    Flat voter tracking map (amendment_votes: TreeMap[str, bool]) keyed by f"{amendment_id}:{voter_hex}".

Ratification-Time Invalidation:
    If an amendment passed by vote but its preconditions are no longer satisfied at finalization time
    (e.g. target member already removed, target member already active, target article repealed), the
    amendment transitions to REJECTED without applying effects or incrementing charter_version.

Constants:
    Article status:
        ARTICLE_ACTIVE = 0
        ARTICLE_SUPERSEDED = 1
        ARTICLE_REPEALED = 2

    Amendment kinds:
        KIND_ADD_ARTICLE = 0
        KIND_REPLACE_ARTICLE = 1
        KIND_REPEAL_ARTICLE = 2
        KIND_ADD_MEMBER = 3
        KIND_REMOVE_MEMBER = 4

    Amendment states:
        AMENDMENT_PROPOSED = 0
        AMENDMENT_VOTING = 1
        AMENDMENT_RATIFIED = 2
        AMENDMENT_REJECTED = 3
        AMENDMENT_EXPIRED = 4
        AMENDMENT_CANCELLED = 5

Error Codes:
    E_NOT_DEPLOYER — Only deployer can perform bootstrap
    E_ALREADY_BOOTSTRAPPED — Bootstrap can only be called once
    E_INVALID_ARTICLES_JSON — Malformed articles JSON string or structure
    E_INVALID_ARTICLE_COUNT — Article count must be between 2 and 10
    E_INVALID_ARTICLE_LENGTH — Article text length must be between 20 and 2000 characters
    E_NOT_BOOTSTRAPPED — Charter has not been bootstrapped
    E_NOT_MEMBER — Caller is not an active member
    E_RATIONALE_TOO_LONG — Rationale exceeds 500 characters
    E_INVALID_KIND — Unknown amendment kind
    E_INVALID_ARTICLE_TARGET — Article target does not exist or is not active
    E_INVALID_MEMBER_ADDRESS — Target member is not a valid address string
    E_MEMBER_ALREADY_ACTIVE — Target member is already an active member
    E_MEMBER_NOT_ACTIVE — Target member is not an active member
    E_LAST_MEMBER — Cannot remove the last active member
    E_AMENDMENT_NOT_FOUND — Amendment ID does not exist
    E_AMENDMENT_NOT_OPEN — Amendment is not open for voting
    E_VOTING_CLOSED — Amendment voting deadline has passed
    E_ALREADY_VOTED — Caller has already voted on this amendment
    E_CANNOT_FINALIZE — Amendment conditions for finalization are not met
    E_ALREADY_FINALIZED — Amendment is already in a terminal state
    E_NOT_PROPOSER — Only proposer can cancel amendment
    E_CANNOT_CANCEL — Amendment cannot be cancelled after voting has started
"""

from __future__ import annotations
from dataclasses import dataclass
from genlayer import *
import json

ARTICLE_ACTIVE = 0
ARTICLE_SUPERSEDED = 1
ARTICLE_REPEALED = 2

KIND_ADD_ARTICLE = 0
KIND_REPLACE_ARTICLE = 1
KIND_REPEAL_ARTICLE = 2
KIND_ADD_MEMBER = 3
KIND_REMOVE_MEMBER = 4

AMENDMENT_PROPOSED = 0
AMENDMENT_VOTING = 1
AMENDMENT_RATIFIED = 2
AMENDMENT_REJECTED = 3
AMENDMENT_EXPIRED = 4
AMENDMENT_CANCELLED = 5

STATE_NAMES = ["PROPOSED", "VOTING", "RATIFIED", "REJECTED", "EXPIRED", "CANCELLED"]


@allow_storage
@dataclass
class MemberRec:
    active: bool
    joined_at: u64


@allow_storage
@dataclass
class ArticleRec:
    id: u32
    text: str
    status: u8
    version: u32
    updated_by_amendment: u32
    updated_at: u64


@allow_storage
@dataclass
class AmendmentRec:
    id: u32
    kind: u8
    target_article_id: u32
    new_text: str
    target_member: str
    proposer: Address
    rationale: str
    state: u8
    yes: u32
    no: u32
    deadline: u64
    created_at: u64


class Charter(gl.Contract):
    members: TreeMap[Address, MemberRec]
    member_count: u32
    articles: TreeMap[u32, ArticleRec]
    article_count: u32
    charter_version: u32
    amendments: TreeMap[u32, AmendmentRec]
    amendment_count: u32
    amendment_votes: TreeMap[str, bool]
    voting_period_seconds: u64
    deployer: Address
    bootstrapped: bool

    def __init__(self, voting_period_seconds: int = 600):
        self.deployer = gl.message.sender_address
        self.bootstrapped = False
        self.member_count = 0
        self.article_count = 0
        self.charter_version = 0
        self.amendment_count = 0
        self.voting_period_seconds = voting_period_seconds

    def _now(self) -> int:
        """Internal timestamp helper using deterministic transaction timestamp."""
        import time
        return int(time.time())


    @gl.public.write
    def bootstrap(self, articles_json: str):
        if self.bootstrapped:
            raise Exception("E_ALREADY_BOOTSTRAPPED")
        if gl.message.sender_address != self.deployer:
            raise Exception("E_NOT_DEPLOYER")

        try:
            articles = json.loads(articles_json)
        except Exception:
            raise Exception("E_INVALID_ARTICLES_JSON")

        if not isinstance(articles, list):
            raise Exception("E_INVALID_ARTICLES_JSON")

        if not (2 <= len(articles) <= 10):
            raise Exception("E_INVALID_ARTICLE_COUNT")

        for art in articles:
            if not isinstance(art, str) or not (20 <= len(art) <= 2000):
                raise Exception("E_INVALID_ARTICLE_LENGTH")

        now = self._now()
        self.bootstrapped = True
        self.members[self.deployer] = MemberRec(active=True, joined_at=now)
        self.member_count = 1

        for art_text in articles:
            self.article_count += 1
            self.articles[self.article_count] = ArticleRec(
                id=self.article_count,
                text=art_text,
                status=ARTICLE_ACTIVE,
                version=1,
                updated_by_amendment=0,
                updated_at=now,
            )

        self.charter_version = 1

    @gl.public.write
    def propose_amendment(
        self,
        kind: int,
        target_article_id: int,
        new_text: str,
        target_member: str,
        rationale: str,
    ) -> int:
        if not self.bootstrapped:
            raise Exception("E_NOT_BOOTSTRAPPED")

        caller = gl.message.sender_address
        if caller not in self.members or not self.members[caller].active:
            raise Exception("E_NOT_MEMBER")

        if len(rationale) > 500:
            raise Exception("E_RATIONALE_TOO_LONG")

        if kind in (KIND_ADD_ARTICLE, KIND_REPLACE_ARTICLE):
            if not (20 <= len(new_text) <= 2000):
                raise Exception("E_INVALID_ARTICLE_LENGTH")

        if kind in (KIND_REPLACE_ARTICLE, KIND_REPEAL_ARTICLE):
            if (
                target_article_id not in self.articles
                or self.articles[target_article_id].status != ARTICLE_ACTIVE
            ):
                raise Exception("E_INVALID_ARTICLE_TARGET")

        target_addr = None
        if kind in (KIND_ADD_MEMBER, KIND_REMOVE_MEMBER):
            try:
                target_addr = Address(target_member)
            except Exception:
                raise Exception("E_INVALID_MEMBER_ADDRESS")

            if kind == KIND_ADD_MEMBER:
                if target_addr in self.members and self.members[target_addr].active:
                    raise Exception("E_MEMBER_ALREADY_ACTIVE")

            if kind == KIND_REMOVE_MEMBER:
                if target_addr not in self.members or not self.members[target_addr].active:
                    raise Exception("E_MEMBER_NOT_ACTIVE")
                if self.member_count <= 1:
                    raise Exception("E_LAST_MEMBER")

        if kind not in (
            KIND_ADD_ARTICLE,
            KIND_REPLACE_ARTICLE,
            KIND_REPEAL_ARTICLE,
            KIND_ADD_MEMBER,
            KIND_REMOVE_MEMBER,
        ):
            raise Exception("E_INVALID_KIND")

        now = self._now()
        deadline = now + self.voting_period_seconds
        self.amendment_count += 1
        aid = self.amendment_count

        self.amendments[aid] = AmendmentRec(
            id=aid,
            kind=kind,
            target_article_id=target_article_id,
            new_text=new_text,
            target_member=target_addr.as_hex if target_addr else "",
            proposer=caller,
            rationale=rationale,
            state=AMENDMENT_PROPOSED,
            yes=0,
            no=0,
            deadline=deadline,
            created_at=now,
        )
        return aid

    @gl.public.write
    def vote(self, amendment_id: int, support: bool):
        if not self.bootstrapped:
            raise Exception("E_NOT_BOOTSTRAPPED")

        caller = gl.message.sender_address
        if caller not in self.members or not self.members[caller].active:
            raise Exception("E_NOT_MEMBER")

        if amendment_id not in self.amendments:
            raise Exception("E_AMENDMENT_NOT_FOUND")

        amd = self.amendments[amendment_id]
        if amd.state not in (AMENDMENT_PROPOSED, AMENDMENT_VOTING):
            raise Exception("E_AMENDMENT_NOT_OPEN")

        now = self._now()
        if now >= amd.deadline:
            raise Exception("E_VOTING_CLOSED")

        vote_key = f"{amendment_id}:{caller.as_hex}"
        if vote_key in self.amendment_votes:
            raise Exception("E_ALREADY_VOTED")

        if amd.state == AMENDMENT_PROPOSED:
            amd.state = AMENDMENT_VOTING

        self.amendment_votes[vote_key] = support
        if support:
            amd.yes += 1
        else:
            amd.no += 1

    @gl.public.write
    def finalize_amendment(self, amendment_id: int):
        if not self.bootstrapped:
            raise Exception("E_NOT_BOOTSTRAPPED")

        if amendment_id not in self.amendments:
            raise Exception("E_AMENDMENT_NOT_FOUND")

        amd = self.amendments[amendment_id]
        state = amd.state

        if state in (
            AMENDMENT_RATIFIED,
            AMENDMENT_REJECTED,
            AMENDMENT_EXPIRED,
            AMENDMENT_CANCELLED,
        ):
            raise Exception("E_ALREADY_FINALIZED")

        now = self._now()
        deadline_passed = now >= amd.deadline
        strict_majority = amd.yes > (self.member_count // 2)

        if state == AMENDMENT_PROPOSED:
            if not deadline_passed:
                raise Exception("E_CANNOT_FINALIZE")
        elif state == AMENDMENT_VOTING:
            if not (deadline_passed or strict_majority):
                raise Exception("E_CANNOT_FINALIZE")

        total_votes = amd.yes + amd.no
        if total_votes == 0 and deadline_passed:
            amd.state = AMENDMENT_EXPIRED
            return

        if amd.yes > amd.no:
            kind = amd.kind

            # Re-validate preconditions against current state at ratification time
            valid = True
            if kind in (KIND_REPLACE_ARTICLE, KIND_REPEAL_ARTICLE):
                if (
                    amd.target_article_id not in self.articles
                    or self.articles[amd.target_article_id].status != ARTICLE_ACTIVE
                ):
                    valid = False
            elif kind == KIND_ADD_MEMBER:
                t_addr = Address(amd.target_member)
                if t_addr in self.members and self.members[t_addr].active:
                    valid = False
            elif kind == KIND_REMOVE_MEMBER:
                t_addr = Address(amd.target_member)
                if t_addr not in self.members or not self.members[t_addr].active or self.member_count <= 1:
                    valid = False

            if not valid:
                amd.state = AMENDMENT_REJECTED
                return

            amd.state = AMENDMENT_RATIFIED

            if kind == KIND_ADD_ARTICLE:
                self.article_count += 1
                self.articles[self.article_count] = ArticleRec(
                    id=self.article_count,
                    text=amd.new_text,
                    status=ARTICLE_ACTIVE,
                    version=1,
                    updated_by_amendment=amendment_id,
                    updated_at=now,
                )
            elif kind == KIND_REPLACE_ARTICLE:
                art = self.articles[amd.target_article_id]
                art.status = ARTICLE_SUPERSEDED
                self.articles[amd.target_article_id] = ArticleRec(
                    id=amd.target_article_id,
                    text=amd.new_text,
                    status=ARTICLE_ACTIVE,
                    version=art.version + 1,
                    updated_by_amendment=amendment_id,
                    updated_at=now,
                )
            elif kind == KIND_REPEAL_ARTICLE:
                art = self.articles[amd.target_article_id]
                art.status = ARTICLE_REPEALED
                art.updated_by_amendment = amendment_id
                art.updated_at = now
            elif kind == KIND_ADD_MEMBER:
                t_addr = Address(amd.target_member)
                self.members[t_addr] = MemberRec(active=True, joined_at=now)
                self.member_count += 1
            elif kind == KIND_REMOVE_MEMBER:
                t_addr = Address(amd.target_member)
                self.members[t_addr].active = False
                self.member_count -= 1

            self.charter_version += 1
        else:
            amd.state = AMENDMENT_REJECTED

    @gl.public.write
    def cancel_amendment(self, amendment_id: int):
        if not self.bootstrapped:
            raise Exception("E_NOT_BOOTSTRAPPED")

        if amendment_id not in self.amendments:
            raise Exception("E_AMENDMENT_NOT_FOUND")

        amd = self.amendments[amendment_id]
        caller = gl.message.sender_address

        if caller != amd.proposer:
            raise Exception("E_NOT_PROPOSER")

        if amd.state != AMENDMENT_PROPOSED or (amd.yes + amd.no > 0):
            raise Exception("E_CANNOT_CANCEL")

        amd.state = AMENDMENT_CANCELLED

    @gl.public.view
    def get_charter_bundle(self) -> str:
        active_articles = []
        for aid in sorted(self.articles.keys()):
            art = self.articles[aid]
            if art.status == ARTICLE_ACTIVE:
                active_articles.append(
                    {"id": art.id, "version": art.version, "text": art.text}
                )

        bundle = {
            "charter_version": self.charter_version,
            "articles": active_articles,
        }
        return json.dumps(bundle)

    @gl.public.view
    def get_article(self, article_id: int) -> str:
        if article_id not in self.articles:
            raise Exception("E_INVALID_ARTICLE_TARGET")

        art = self.articles[article_id]
        return json.dumps({
            "id": art.id,
            "text": art.text,
            "status": art.status,
            "version": art.version,
            "updated_by_amendment": art.updated_by_amendment,
            "updated_at": art.updated_at,
        })

    @gl.public.view
    def get_amendment(self, amendment_id: int) -> str:
        if amendment_id not in self.amendments:
            raise Exception("E_AMENDMENT_NOT_FOUND")

        amd = self.amendments[amendment_id]
        proposer_hex = amd.proposer.as_hex if hasattr(amd.proposer, "as_hex") else str(amd.proposer)
        return json.dumps({
            "id": amd.id,
            "kind": amd.kind,
            "target_article_id": amd.target_article_id,
            "new_text": amd.new_text,
            "target_member": amd.target_member,
            "proposer": proposer_hex,
            "rationale": amd.rationale,
            "state": amd.state,
            "state_name": STATE_NAMES[amd.state],
            "yes": amd.yes,
            "no": amd.no,
            "deadline": amd.deadline,
            "created_at": amd.created_at,
        })

    @gl.public.view
    def get_member(self, addr: str) -> str:
        try:
            m_addr = Address(addr)
        except Exception:
            return json.dumps({"active": False})

        if m_addr in self.members:
            m_rec = self.members[m_addr]
            if m_rec.active:
                return json.dumps({"active": True, "joined_at": m_rec.joined_at})

        return json.dumps({"active": False})

    @gl.public.view
    def get_counts(self) -> str:
        active_articles = sum(
            1 for art in self.articles.values() if art.status == ARTICLE_ACTIVE
        )
        counts = {
            "members": self.member_count,
            "articles": active_articles,
            "amendments": self.amendment_count,
            "charter_version": self.charter_version,
        }
        return json.dumps(counts)
