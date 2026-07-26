"""Full unit test suite for Charter contract storage and amendment state machine."""

import json
import pytest
from genlayer import gl, Address
from conftest import set_sender, FOUNDING_ARTICLES
from charter import (
    Charter,
    MemberRec,
    ARTICLE_ACTIVE,
    ARTICLE_SUPERSEDED,
    ARTICLE_REPEALED,
    KIND_ADD_ARTICLE,
    KIND_REPLACE_ARTICLE,
    KIND_REPEAL_ARTICLE,
    KIND_ADD_MEMBER,
    KIND_REMOVE_MEMBER,
    AMENDMENT_PROPOSED,
    AMENDMENT_VOTING,
    AMENDMENT_RATIFIED,
    AMENDMENT_REJECTED,
    AMENDMENT_EXPIRED,
    AMENDMENT_CANCELLED,
)

DEPLOYER = "0x" + "1" * 40
MEMBER_2 = "0x" + "2" * 40
MEMBER_3 = "0x" + "3" * 40
MEMBER_4 = "0x" + "4" * 40
NON_MEMBER = "0x" + "9" * 40


def test_bootstrap_happy_path(charter_raw):
    set_sender(DEPLOYER)
    articles_json = json.dumps(FOUNDING_ARTICLES)
    charter_raw.bootstrap(articles_json)

    assert charter_raw.bootstrapped is True
    assert charter_raw.member_count == 1
    assert charter_raw.article_count == 4
    assert charter_raw.charter_version == 1

    counts = json.loads(charter_raw.get_counts())
    assert counts == {"members": 1, "articles": 4, "amendments": 0, "charter_version": 1}

    bundle = json.loads(charter_raw.get_charter_bundle())
    assert bundle["charter_version"] == 1
    assert len(bundle["articles"]) == 4
    assert bundle["articles"][0]["id"] == 1
    assert bundle["articles"][0]["version"] == 1
    assert bundle["articles"][0]["text"] == FOUNDING_ARTICLES[0]


def test_bootstrap_rejections(charter_raw):
    # 1. Non-deployer rejection: E_NOT_DEPLOYER
    set_sender(MEMBER_2)
    with pytest.raises(Exception, match="E_NOT_DEPLOYER"):
        charter_raw.bootstrap(json.dumps(FOUNDING_ARTICLES))

    # 2. Malformed JSON: E_INVALID_ARTICLES_JSON
    set_sender(DEPLOYER)
    with pytest.raises(Exception, match="E_INVALID_ARTICLES_JSON"):
        charter_raw.bootstrap("not a json string")
    with pytest.raises(Exception, match="E_INVALID_ARTICLES_JSON"):
        charter_raw.bootstrap("12345")

    # 3. Wrong article counts (<2 or >10): E_INVALID_ARTICLE_COUNT
    with pytest.raises(Exception, match="E_INVALID_ARTICLE_COUNT"):
        charter_raw.bootstrap(json.dumps(["Only one article text meeting twenty character limit."]))
    too_many = [f"Article number {i} text long enough" for i in range(11)]
    with pytest.raises(Exception, match="E_INVALID_ARTICLE_COUNT"):
        charter_raw.bootstrap(json.dumps(too_many))

    # 4. Wrong article lengths (<20 or >2000): E_INVALID_ARTICLE_LENGTH
    with pytest.raises(Exception, match="E_INVALID_ARTICLE_LENGTH"):
        charter_raw.bootstrap(json.dumps(["Too short", "Valid article text that is long enough to pass."]))
    too_long_art = "A" * 2001
    with pytest.raises(Exception, match="E_INVALID_ARTICLE_LENGTH"):
        charter_raw.bootstrap(json.dumps([FOUNDING_ARTICLES[0], too_long_art]))

    # Bootstrap correctly
    charter_raw.bootstrap(json.dumps(FOUNDING_ARTICLES))

    # 5. Second call rejection: E_ALREADY_BOOTSTRAPPED
    with pytest.raises(Exception, match="E_ALREADY_BOOTSTRAPPED"):
        charter_raw.bootstrap(json.dumps(FOUNDING_ARTICLES))


def test_unbootstrapped_method_rejections(charter_raw):
    set_sender(DEPLOYER)
    with pytest.raises(Exception, match="E_NOT_BOOTSTRAPPED"):
        charter_raw.propose_amendment(KIND_ADD_ARTICLE, 0, "Valid new article text here...", "", "Rationale")

    with pytest.raises(Exception, match="E_NOT_BOOTSTRAPPED"):
        charter_raw.vote(1, True)

    with pytest.raises(Exception, match="E_NOT_BOOTSTRAPPED"):
        charter_raw.finalize_amendment(1)

    with pytest.raises(Exception, match="E_NOT_BOOTSTRAPPED"):
        charter_raw.cancel_amendment(1)


def test_amendment_kind_0_add_article_happy_path(charter):
    set_sender(DEPLOYER)
    new_text = "New Article 5: All claims must be submitted within 30 days of expense date."
    aid = charter.propose_amendment(KIND_ADD_ARTICLE, 0, new_text, "", "Adding claim time limit")

    assert aid == 1
    amd_info = json.loads(charter.get_amendment(aid))
    assert amd_info["kind"] == KIND_ADD_ARTICLE
    assert amd_info["state_name"] == "PROPOSED"

    # Vote yes (deployer is sole active member, so 1 vote is 100% > member_count // 2)
    charter.vote(aid, True)
    amd_info = json.loads(charter.get_amendment(aid))
    assert amd_info["state_name"] == "VOTING"
    assert amd_info["yes"] == 1

    # Early finalization due to strict majority
    charter.finalize_amendment(aid)
    amd_info = json.loads(charter.get_amendment(aid))
    assert amd_info["state_name"] == "RATIFIED"

    # Verify state effects
    assert charter.charter_version == 2
    assert charter.article_count == 5

    art5 = json.loads(charter.get_article(5))
    assert art5["id"] == 5
    assert art5["version"] == 1
    assert art5["text"] == new_text
    assert art5["status"] == ARTICLE_ACTIVE
    assert art5["updated_by_amendment"] == aid

    bundle = json.loads(charter.get_charter_bundle())
    assert bundle["charter_version"] == 2
    assert len(bundle["articles"]) == 5


def test_amendment_kind_1_replace_article_happy_path(charter):
    set_sender(DEPLOYER)
    new_text = "Food and non-alcoholic drinks for official team syncs are reimbursable up to 0.02 GEN."
    aid = charter.propose_amendment(KIND_REPLACE_ARTICLE, 4, new_text, "", "Allowing team sync food")

    charter.vote(aid, True)
    charter.finalize_amendment(aid)

    amd_info = json.loads(charter.get_amendment(aid))
    assert amd_info["state_name"] == "RATIFIED"
    assert charter.charter_version == 2

    art4 = json.loads(charter.get_article(4))
    assert art4["id"] == 4
    assert art4["version"] == 2
    assert art4["text"] == new_text
    assert art4["status"] == ARTICLE_ACTIVE
    assert art4["updated_by_amendment"] == aid


def test_amendment_kind_2_repeal_article_happy_path(charter):
    set_sender(DEPLOYER)
    aid = charter.propose_amendment(KIND_REPEAL_ARTICLE, 3, "", "", "Repealing strict evidence rule")

    charter.vote(aid, True)
    charter.finalize_amendment(aid)

    art3 = json.loads(charter.get_article(3))
    assert art3["id"] == 3
    assert art3["status"] == ARTICLE_REPEALED

    bundle = json.loads(charter.get_charter_bundle())
    # Article 3 should be omitted from active articles bundle
    article_ids = [a["id"] for a in bundle["articles"]]
    assert 3 not in article_ids
    assert len(bundle["articles"]) == 3


def test_amendment_kind_3_add_member_happy_path(charter):
    set_sender(DEPLOYER)
    aid = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Adding member 2")

    charter.vote(aid, True)
    charter.finalize_amendment(aid)

    assert charter.member_count == 2
    m2_info = json.loads(charter.get_member(MEMBER_2))
    assert m2_info["active"] is True

    counts = json.loads(charter.get_counts())
    assert counts["members"] == 2


def test_amendment_kind_4_remove_member_happy_path(charter):
    set_sender(DEPLOYER)
    # First add MEMBER_2
    aid1 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Adding member 2")
    charter.vote(aid1, True)
    charter.finalize_amendment(aid1)
    assert charter.member_count == 2

    # Now remove MEMBER_2
    aid2 = charter.propose_amendment(KIND_REMOVE_MEMBER, 0, "", MEMBER_2, "Removing member 2")
    # Member 1 votes yes
    charter.vote(aid2, True)
    # Member 2 votes no
    set_sender(MEMBER_2)
    charter.vote(aid2, False)

    # 1 yes out of 2 members is not strict majority > 1, so wait deadline
    set_sender(DEPLOYER)
    current_time = 1000
    charter._now = lambda: current_time + 601  # past deadline 600s

    charter.finalize_amendment(aid2)
    # 1 yes vs 1 no -> tie -> REJECTED!
    amd2_info = json.loads(charter.get_amendment(aid2))
    assert amd2_info["state_name"] == "REJECTED"

    # Now propose remove again and vote yes from both
    charter._now = lambda: current_time
    aid3 = charter.propose_amendment(KIND_REMOVE_MEMBER, 0, "", MEMBER_2, "Removing member 2 attempt 2")
    set_sender(DEPLOYER)
    charter.vote(aid3, True)
    set_sender(MEMBER_2)
    charter.vote(aid3, True)
    charter.finalize_amendment(aid3)

    amd3_info = json.loads(charter.get_amendment(aid3))
    assert amd3_info["state_name"] == "RATIFIED"
    assert charter.member_count == 1
    assert json.loads(charter.get_member(MEMBER_2))["active"] is False


def test_rejected_on_tie(charter):
    set_sender(DEPLOYER)
    # Add member 2
    aid_m = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Add member 2")
    charter.vote(aid_m, True)
    charter.finalize_amendment(aid_m)

    # Propose new article
    aid = charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Valid new article text here...", "", "New article")
    set_sender(DEPLOYER)
    charter.vote(aid, True)
    set_sender(MEMBER_2)
    charter.vote(aid, False)

    # Advance past deadline
    charter._now = lambda: 1000 + 601
    charter.finalize_amendment(aid)

    amd_info = json.loads(charter.get_amendment(aid))
    assert amd_info["state_name"] == "REJECTED"
    assert amd_info["yes"] == 1
    assert amd_info["no"] == 1


def test_expired_on_zero_votes_past_deadline(charter):
    set_sender(DEPLOYER)
    aid = charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Valid new article text here...", "", "No votes test")

    # Advance past deadline without voting
    charter._now = lambda: 1000 + 601
    charter.finalize_amendment(aid)

    amd_info = json.loads(charter.get_amendment(aid))
    assert amd_info["state_name"] == "EXPIRED"


def test_cancel_amendment_proposer_only(charter):
    set_sender(DEPLOYER)
    # Add member 2
    aid_m = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Add member 2")
    charter.vote(aid_m, True)
    charter.finalize_amendment(aid_m)

    # Deployer proposes amendment
    aid = charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Valid new article text here...", "", "Cancel test")

    # Non-proposer tries to cancel: E_NOT_PROPOSER
    set_sender(MEMBER_2)
    with pytest.raises(Exception, match="E_NOT_PROPOSER"):
        charter.cancel_amendment(aid)

    # Proposer cancels before votes
    set_sender(DEPLOYER)
    charter.cancel_amendment(aid)

    amd_info = json.loads(charter.get_amendment(aid))
    assert amd_info["state_name"] == "CANCELLED"


def test_all_error_codes_asserted(charter):
    set_sender(DEPLOYER)

    # E_INVALID_ARTICLE_LENGTH
    with pytest.raises(Exception, match="E_INVALID_ARTICLE_LENGTH"):
        charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Short text", "", "Rationale")

    # E_NOT_MEMBER
    set_sender(NON_MEMBER)
    with pytest.raises(Exception, match="E_NOT_MEMBER"):
        charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Valid new article text here...", "", "Rationale")
    with pytest.raises(Exception, match="E_NOT_MEMBER"):
        charter.vote(1, True)

    set_sender(DEPLOYER)
    # E_RATIONALE_TOO_LONG
    with pytest.raises(Exception, match="E_RATIONALE_TOO_LONG"):
        charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Valid new article text here...", "", "R" * 501)

    # E_INVALID_KIND
    with pytest.raises(Exception, match="E_INVALID_KIND"):
        charter.propose_amendment(99, 0, "Valid new article text here...", "", "Rationale")

    # E_INVALID_ARTICLE_TARGET
    with pytest.raises(Exception, match="E_INVALID_ARTICLE_TARGET"):
        charter.propose_amendment(KIND_REPLACE_ARTICLE, 99, "Valid new article text here...", "", "Rationale")

    # E_INVALID_MEMBER_ADDRESS
    with pytest.raises(Exception, match="E_INVALID_MEMBER_ADDRESS"):
        charter.propose_amendment(KIND_ADD_MEMBER, 0, "", "not_an_address", "Rationale")

    # E_MEMBER_ALREADY_ACTIVE
    with pytest.raises(Exception, match="E_MEMBER_ALREADY_ACTIVE"):
        charter.propose_amendment(KIND_ADD_MEMBER, 0, "", DEPLOYER, "Rationale")

    # E_MEMBER_NOT_ACTIVE
    with pytest.raises(Exception, match="E_MEMBER_NOT_ACTIVE"):
        charter.propose_amendment(KIND_REMOVE_MEMBER, 0, "", MEMBER_2, "Rationale")

    # E_LAST_MEMBER
    # First add MEMBER_2 then remove MEMBER_2 so MEMBER_2 exists in storage
    aid_m2 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Add member 2")
    charter.vote(aid_m2, True)
    charter.finalize_amendment(aid_m2)
    # Now remove MEMBER_2
    aid_rem = charter.propose_amendment(KIND_REMOVE_MEMBER, 0, "", MEMBER_2, "Remove member 2")
    set_sender(DEPLOYER)
    charter.vote(aid_rem, True)
    set_sender(MEMBER_2)
    charter.vote(aid_rem, True)
    charter.finalize_amendment(aid_rem)
    # Now deployer is sole member again
    set_sender(DEPLOYER)
    with pytest.raises(Exception, match="E_LAST_MEMBER"):
        charter.propose_amendment(KIND_REMOVE_MEMBER, 0, "", DEPLOYER, "Rationale")

    # E_AMENDMENT_NOT_FOUND
    with pytest.raises(Exception, match="E_AMENDMENT_NOT_FOUND"):
        charter.vote(999, True)
    with pytest.raises(Exception, match="E_AMENDMENT_NOT_FOUND"):
        charter.finalize_amendment(999)
    with pytest.raises(Exception, match="E_AMENDMENT_NOT_FOUND"):
        charter.cancel_amendment(999)

    # Create an amendment for voting tests
    aid = charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Valid new article text here...", "", "Test amd")

    # E_ALREADY_VOTED
    charter.vote(aid, True)
    with pytest.raises(Exception, match="E_ALREADY_VOTED"):
        charter.vote(aid, True)

    # E_CANNOT_CANCEL
    with pytest.raises(Exception, match="E_CANNOT_CANCEL"):
        charter.cancel_amendment(aid)

    # Finalize aid
    charter.finalize_amendment(aid)

    # E_AMENDMENT_NOT_OPEN
    with pytest.raises(Exception, match="E_AMENDMENT_NOT_OPEN"):
        charter.vote(aid, True)

    # E_ALREADY_FINALIZED
    with pytest.raises(Exception, match="E_ALREADY_FINALIZED"):
        charter.finalize_amendment(aid)

    # E_VOTING_CLOSED
    aid2 = charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Another valid new article text...", "", "Amd 2")
    charter._now = lambda: 1000 + 601
    with pytest.raises(Exception, match="E_VOTING_CLOSED"):
        charter.vote(aid2, True)

    # E_CANNOT_FINALIZE
    charter._now = lambda: 1000
    current_members = [DEPLOYER]
    for new_m in [MEMBER_2, MEMBER_3, MEMBER_4]:
        set_sender(DEPLOYER)
        a = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", new_m, "Add member")
        for active_m in current_members:
            set_sender(active_m)
            charter.vote(a, True)
        charter.finalize_amendment(a)
        current_members.append(new_m)

    # Total members = 4. member_count // 2 = 2. Strict majority requires yes > 2 (i.e. 3 or 4 votes).
    set_sender(DEPLOYER)
    aid3 = charter.propose_amendment(KIND_ADD_ARTICLE, 0, "Third valid new article text...", "", "Amd 3")
    charter.vote(aid3, True)
    with pytest.raises(Exception, match="E_CANNOT_FINALIZE"):
        charter.finalize_amendment(aid3)

    # E_INVALID_ARTICLE_TARGET for REPLACE on repealed article
    aid_rep = charter.propose_amendment(KIND_REPEAL_ARTICLE, 1, "", "", "Repeal art 1")
    for active_m in current_members:
        set_sender(active_m)
        charter.vote(aid_rep, True)
    charter.finalize_amendment(aid_rep)

    set_sender(DEPLOYER)
    with pytest.raises(Exception, match="E_INVALID_ARTICLE_TARGET"):
        charter.propose_amendment(KIND_REPLACE_ARTICLE, 1, "Valid new text replacing repealed...", "", "Replace repealed")


def test_views_and_get_member(charter):
    set_sender(DEPLOYER)
    dep_mem = json.loads(charter.get_member(DEPLOYER))
    assert dep_mem["active"] is True

    unk_mem = json.loads(charter.get_member(NON_MEMBER))
    assert unk_mem["active"] is False

    inv_mem = json.loads(charter.get_member("invalid"))
    assert inv_mem["active"] is False

    art1 = json.loads(charter.get_article(1))
    assert art1["id"] == 1
    assert art1["status"] == ARTICLE_ACTIVE

    with pytest.raises(Exception, match="E_INVALID_ARTICLE_TARGET"):
        charter.get_article(99)


def test_invalidation_duplicate_remove_member(charter):
    set_sender(DEPLOYER)
    aid_m2 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Add M2")
    charter.vote(aid_m2, True)
    charter.finalize_amendment(aid_m2)

    aid_m3 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_3, "Add M3")
    charter.vote(aid_m3, True)
    set_sender(MEMBER_2)
    charter.vote(aid_m3, True)
    charter.finalize_amendment(aid_m3)
    assert charter.member_count == 3

    set_sender(DEPLOYER)
    aid_rem1 = charter.propose_amendment(KIND_REMOVE_MEMBER, 0, "", MEMBER_3, "Remove M3 first")
    aid_rem2 = charter.propose_amendment(KIND_REMOVE_MEMBER, 0, "", MEMBER_3, "Remove M3 second")

    for aid in (aid_rem1, aid_rem2):
        set_sender(DEPLOYER)
        charter.vote(aid, True)
        set_sender(MEMBER_2)
        charter.vote(aid, True)

    charter.finalize_amendment(aid_rem1)
    assert json.loads(charter.get_amendment(aid_rem1))["state_name"] == "RATIFIED"
    assert charter.member_count == 2
    assert json.loads(charter.get_member(MEMBER_3))["active"] is False

    charter.finalize_amendment(aid_rem2)
    assert json.loads(charter.get_amendment(aid_rem2))["state_name"] == "REJECTED"
    assert charter.member_count == 2


def test_invalidation_add_already_active_member(charter):
    set_sender(DEPLOYER)
    aid_m2 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Add M2")
    charter.vote(aid_m2, True)
    charter.finalize_amendment(aid_m2)

    aid_m3 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_3, "Add M3 proposal")
    charter.vote(aid_m3, True)
    set_sender(MEMBER_2)
    charter.vote(aid_m3, True)

    charter.members[Address(MEMBER_3)] = MemberRec(active=True, joined_at=1000)
    charter.member_count = 3

    set_sender(DEPLOYER)
    charter.finalize_amendment(aid_m3)
    assert json.loads(charter.get_amendment(aid_m3))["state_name"] == "REJECTED"
    assert charter.member_count == 3


def test_invalidation_replace_since_repealed_article(charter):
    set_sender(DEPLOYER)
    aid_replace = charter.propose_amendment(
        KIND_REPLACE_ARTICLE, 1, "New text replacing article 1 meeting twenty chars requirement.", "", "Replace art 1"
    )
    charter.vote(aid_replace, True)

    aid_repeal = charter.propose_amendment(KIND_REPEAL_ARTICLE, 1, "", "", "Repeal art 1 first")
    charter.vote(aid_repeal, True)
    charter.finalize_amendment(aid_repeal)

    assert json.loads(charter.get_article(1))["status"] == ARTICLE_REPEALED

    charter.finalize_amendment(aid_replace)
    assert json.loads(charter.get_amendment(aid_replace))["state_name"] == "REJECTED"
    assert json.loads(charter.get_article(1))["status"] == ARTICLE_REPEALED


def test_early_finalization_strict_majority_3_members_2_yes(charter):
    set_sender(DEPLOYER)
    aid_m2 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_2, "Add M2")
    charter.vote(aid_m2, True)
    charter.finalize_amendment(aid_m2)

    aid_m3 = charter.propose_amendment(KIND_ADD_MEMBER, 0, "", MEMBER_3, "Add M3")
    charter.vote(aid_m3, True)
    set_sender(MEMBER_2)
    charter.vote(aid_m3, True)
    charter.finalize_amendment(aid_m3)

    assert charter.member_count == 3

    set_sender(DEPLOYER)
    aid = charter.propose_amendment(
        KIND_ADD_ARTICLE, 0, "New Article 5: Test early finalization strict majority with 3 members.", "", "Add art 5"
    )

    charter.vote(aid, True)
    with pytest.raises(Exception, match="E_CANNOT_FINALIZE"):
        charter.finalize_amendment(aid)

    set_sender(MEMBER_2)
    charter.vote(aid, True)

    charter.finalize_amendment(aid)
    assert json.loads(charter.get_amendment(aid))["state_name"] == "RATIFIED"
    assert charter.article_count == 5
