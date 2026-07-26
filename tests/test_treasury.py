"""Full unit test suite for Treasury contract deterministic core."""

import json
import pytest
from genlayer import gl, Address
from conftest import set_sender
from treasury import (
    Treasury,
    DECISION_APPROVE,
    DECISION_PARTIAL,
    DECISION_DENY,
    REQ_SUBMITTED,
    REQ_RULED,
    REQ_APPEALED,
    REQ_FINAL_RULED,
    REQ_PAID,
    REQ_CLOSED,
    REQ_UNDETERMINED,
    REQ_FAILED,
)

DEPLOYER = "0x" + "1" * 40
MEMBER_2 = "0x" + "2" * 40
STRANGER = "0x" + "9" * 40


def test_fund_happy_path_and_rejection(treasury):
    set_sender(DEPLOYER)
    # Rejection: gl.message.value <= 0
    gl.message.value = 0
    with pytest.raises(Exception, match="E_ZERO_FUNDING"):
        treasury.fund()

    # Happy path: gl.message.value > 0
    gl.message.value = 10**18
    treasury.fund()


def test_submit_request_happy_path_and_guards(treasury):
    set_sender(DEPLOYER)

    # 1. E_NOT_MEMBER
    set_sender(STRANGER)
    with pytest.raises(Exception, match="E_NOT_MEMBER"):
        treasury.submit_request(100, "Valid purpose for expense", "https://example.com/item")

    set_sender(DEPLOYER)

    # 2. E_INVALID_AMOUNT (0 or > balance)
    with pytest.raises(Exception, match="E_INVALID_AMOUNT"):
        treasury.submit_request(0, "Valid purpose for expense", "https://example.com/item")
    with pytest.raises(Exception, match="E_INVALID_AMOUNT"):
        treasury.submit_request(10**18 + 1, "Valid purpose for expense", "https://example.com/item")

    # 3. E_INVALID_PURPOSE (<10 or >600)
    with pytest.raises(Exception, match="E_INVALID_PURPOSE"):
        treasury.submit_request(100, "Too short", "https://example.com/item")
    with pytest.raises(Exception, match="E_INVALID_PURPOSE"):
        treasury.submit_request(100, "P" * 601, "https://example.com/item")

    # 4. E_NO_EVIDENCE
    with pytest.raises(Exception, match="E_NO_EVIDENCE"):
        treasury.submit_request(100, "Valid purpose for expense", "", "", "")

    # 5. E_INVALID_EVIDENCE_URL
    # Bad scheme
    with pytest.raises(Exception, match="E_INVALID_EVIDENCE_URL"):
        treasury.submit_request(100, "Valid purpose for expense", "ftp://example.com/item")
    # Credentials in URL
    with pytest.raises(Exception, match="E_INVALID_EVIDENCE_URL"):
        treasury.submit_request(100, "Valid purpose for expense", "https://user@evil.com/x")
    # URL > 300 chars
    long_url = "https://example.com/" + "a" * 290
    with pytest.raises(Exception, match="E_INVALID_EVIDENCE_URL"):
        treasury.submit_request(100, "Valid purpose for expense", long_url)

    # Happy path submission 1
    rid = treasury.submit_request(500, "Conference ticket reimbursement claim", "https://conf.org/ticket")
    assert rid == 1

    req1 = json.loads(treasury.get_request(1))
    assert req1["id"] == 1
    assert req1["state_name"] == "SUBMITTED"
    assert req1["amount_wei"] == 500
    assert req1["evidence_urls"] == ["https://conf.org/ticket"]

    # 6. E_OPEN_REQUEST_EXISTS
    with pytest.raises(Exception, match="E_OPEN_REQUEST_EXISTS"):
        treasury.submit_request(200, "Another expense purpose text...", "https://example.com/2")

    # Finalize request 1 to terminal state (DENY -> execute_payout -> CLOSED) to test cooldown
    treasury._apply_ruling(1, DECISION_DENY, 0, "[1]", 1, "Deny reason", False)
    treasury._mock_time[0] += 601
    treasury.execute_payout(1)

    # 7. E_COOLDOWN_ACTIVE (cooldown boundary test: 300s required, last request was at t=1000, now t=1200 -> 200s elapsed)
    treasury._mock_time[0] = 1200
    with pytest.raises(Exception, match="E_COOLDOWN_ACTIVE"):
        treasury.submit_request(200, "Another expense purpose text...", "https://example.com/2")

    # Exact cooldown boundary test: at t=1300 (300s elapsed), submission succeeds!
    treasury._mock_time[0] = 1300
    rid2 = treasury.submit_request(200, "Another expense purpose text...", "https://example.com/2")
    assert rid2 == 2


def test_apply_ruling_happy_paths_and_violations(treasury):
    set_sender(DEPLOYER)
    rid = treasury.submit_request(1000, "Hardware purchase reimbursement claim", "https://vendor.com/laptop")

    # Violation combos for E_INVALID_RULING:
    # 1. APPROVE with amount != requested
    with pytest.raises(Exception, match="E_INVALID_RULING"):
        treasury._apply_ruling(rid, DECISION_APPROVE, 500, "[1]", 1, "Approve wrong amount", False)

    # 2. DENY with amount != 0
    with pytest.raises(Exception, match="E_INVALID_RULING"):
        treasury._apply_ruling(rid, DECISION_DENY, 100, "[1]", 1, "Deny non-zero amount", False)

    # 3. PARTIAL with amount <= 0
    with pytest.raises(Exception, match="E_INVALID_RULING"):
        treasury._apply_ruling(rid, DECISION_PARTIAL, 0, "[1]", 1, "Partial zero amount", False)

    # 4. PARTIAL with amount >= requested
    with pytest.raises(Exception, match="E_INVALID_RULING"):
        treasury._apply_ruling(rid, DECISION_PARTIAL, 1000, "[1]", 1, "Partial full amount", False)

    # 5. Invalid decision code
    with pytest.raises(Exception, match="E_INVALID_RULING"):
        treasury._apply_ruling(rid, 99, 500, "[1]", 1, "Invalid code", False)

    # 6. Reason length 0 or > 500
    with pytest.raises(Exception, match="E_INVALID_RULING"):
        treasury._apply_ruling(rid, DECISION_PARTIAL, 500, "[1]", 1, "", False)
    with pytest.raises(Exception, match="E_INVALID_RULING"):
        treasury._apply_ruling(rid, DECISION_PARTIAL, 500, "[1]", 1, "R" * 501, False)

    # E_REQUEST_NOT_FOUND
    with pytest.raises(Exception, match="E_REQUEST_NOT_FOUND"):
        treasury._apply_ruling(999, DECISION_APPROVE, 100, "[1]", 1, "Valid reason", False)

    # Happy path: PARTIAL ruling
    treasury._apply_ruling(rid, DECISION_PARTIAL, 500, "[2]", 1, "Reimbursing 50% hardware per article 2", False)

    req = json.loads(treasury.get_request(rid))
    assert req["state_name"] == "RULED"
    assert req["initial_ruling"]["decision_name"] == "PARTIAL"
    assert req["initial_ruling"]["approved_amount_wei"] == 500
    assert req["appeal_deadline"] == 1000 + 600

    # Verify precedent log growth
    precedents = json.loads(treasury.get_precedents(0, 10))
    assert len(precedents) == 1
    assert precedents[0]["seq"] == 1
    assert precedents[0]["decision_name"] == "PARTIAL"
    assert precedents[0]["is_appeal"] is False
    assert "PARTIAL: Reimbursing 50% hardware" in precedents[0]["summary"]


def test_adjudicate_request_and_undetermined_ladder(treasury):
    set_sender(DEPLOYER)
    rid = treasury.submit_request(300, "Workshop registration fee claim", "https://workshop.org/reg")

    # Acceptance of SUBMITTED state -> raises E_ADJUDICATION_NOT_WIRED
    with pytest.raises(Exception, match="E_ADJUDICATION_NOT_WIRED"):
        treasury.adjudicate_request(rid)

    # E_REQUEST_NOT_FOUND
    with pytest.raises(Exception, match="E_REQUEST_NOT_FOUND"):
        treasury.adjudicate_request(999)

    # Test _mark_undetermined ladder
    treasury._mark_undetermined(rid)
    req1 = json.loads(treasury.get_request(rid))
    assert req1["state_name"] == "UNDETERMINED"
    assert req1["retries"] == 1

    # adjudicate_request accepts REQ_UNDETERMINED state -> raises E_ADJUDICATION_NOT_WIRED
    with pytest.raises(Exception, match="E_ADJUDICATION_NOT_WIRED"):
        treasury.adjudicate_request(rid)

    # Second failure moves to REQ_FAILED and clears open request
    treasury._mark_undetermined(rid)
    req2 = json.loads(treasury.get_request(rid))
    assert req2["state_name"] == "FAILED"
    assert req2["retries"] == 2
    assert treasury.open_request[Address(DEPLOYER)] == 0

    # E_BAD_STATE when calling adjudicate_request on FAILED state
    with pytest.raises(Exception, match="E_BAD_STATE"):
        treasury.adjudicate_request(rid)


def test_appeal_ruling_happy_paths_and_rejections(treasury):
    set_sender(DEPLOYER)
    rid = treasury.submit_request(600, "Software license reimbursement claim", "https://software.com/buy")
    treasury._apply_ruling(rid, DECISION_DENY, 0, "[3]", 1, "Evidence unverified", False)

    # 1. E_BAD_STATE (cannot appeal SUBMITTED request)
    set_sender(MEMBER_2)
    rid_sub = treasury.submit_request(100, "Another expense purpose text...", "https://example.com/x")
    with pytest.raises(Exception, match="E_BAD_STATE"):
        treasury.appeal_ruling(rid_sub, "Valid appeal argument text meeting length requirement...")

    # 2. E_NOT_ALLOWED (stranger cannot appeal)
    set_sender(STRANGER)
    with pytest.raises(Exception, match="E_NOT_ALLOWED"):
        treasury.appeal_ruling(rid, "Valid appeal argument text meeting length requirement...")

    # 3. E_INVALID_ARGUMENT (<20 or >1000)
    set_sender(MEMBER_2)
    with pytest.raises(Exception, match="E_INVALID_ARGUMENT"):
        treasury.appeal_ruling(rid, "Too short")
    with pytest.raises(Exception, match="E_INVALID_ARGUMENT"):
        treasury.appeal_ruling(rid, "A" * 1001)

    # 4. E_APPEAL_WINDOW_CLOSED
    treasury._mock_time[0] = 1000 + 601
    with pytest.raises(Exception, match="E_APPEAL_WINDOW_CLOSED"):
        treasury.appeal_ruling(rid, "Valid appeal argument text meeting length requirement...")

    # Reset time to within window
    treasury._mock_time[0] = 1200
    # Happy path: MEMBER_2 (other active member) appeals
    treasury.appeal_ruling(rid, "Member 2 appealing on behalf of requester with valid rationale.")

    req = json.loads(treasury.get_request(rid))
    assert req["state_name"] == "APPEALED"
    assert req["appealed"] is True
    assert req["appellant"] == MEMBER_2.lower()

    # 5. E_ALREADY_APPEALED
    with pytest.raises(Exception, match="E_BAD_STATE"):  # state is now APPEALED, not RULED
        treasury.appeal_ruling(rid, "Valid appeal argument text meeting length requirement...")

    # adjudicate_request accepts REQ_APPEALED state
    with pytest.raises(Exception, match="E_ADJUDICATION_NOT_WIRED"):
        treasury.adjudicate_request(rid)

    # Apply appeal ruling -> APPROVE 600
    treasury._apply_ruling(rid, DECISION_APPROVE, 600, "[1, 3]", 1, "Appeal upheld per article 1", True)

    req_final = json.loads(treasury.get_request(rid))
    assert req_final["state_name"] == "FINAL_RULED"
    assert req_final["appeal_ruling"]["decision_name"] == "APPROVE"
    assert req_final["appeal_ruling"]["approved_amount_wei"] == 600

    # Verify second precedent appended
    precedents = json.loads(treasury.get_precedents(0, 10))
    assert len(precedents) == 2
    assert precedents[0]["is_appeal"] is True


def test_payout_happy_paths_and_rejections(treasury):
    set_sender(DEPLOYER)
    rid = treasury.submit_request(400, "Conference ticket reimbursement claim", "https://conf.org/ticket")

    # Initial ruling -> PARTIAL 200
    treasury._apply_ruling(rid, DECISION_PARTIAL, 200, "[1]", 1, "Partial 50%", False)

    # 1. E_NOT_PAYABLE (appeal window still open)
    with pytest.raises(Exception, match="E_NOT_PAYABLE"):
        treasury.execute_payout(rid)

    # 2. Appeal window passes -> payout allowed with initial ruling
    treasury._mock_time[0] = 1000 + 601
    treasury.execute_payout(rid)

    req = json.loads(treasury.get_request(rid))
    assert req["state_name"] == "PAID"
    assert req["paid"] is True
    assert len(treasury._mock_transfers) == 1
    assert treasury._mock_transfers[0] == (Address(DEPLOYER), 200)
    assert treasury.open_request[Address(DEPLOYER)] == 0

    # 3. E_ALREADY_PAID
    with pytest.raises(Exception, match="E_ALREADY_PAID"):
        treasury.execute_payout(rid)

    # Test payout immediately on REQ_FINAL_RULED overriding initial amount
    treasury._mock_time[0] = 2000
    rid2 = treasury.submit_request(500, "Hardware purchase reimbursement claim", "https://vendor.com/ram")
    treasury._apply_ruling(rid2, DECISION_PARTIAL, 250, "[2]", 1, "Initial partial", False)
    treasury.appeal_ruling(rid2, "Requesting full approval with additional evidence...")
    treasury._apply_ruling(rid2, DECISION_APPROVE, 500, "[1, 2]", 1, "Appeal approved full", True)

    # Payout immediately without waiting for window
    treasury.execute_payout(rid2)
    req2 = json.loads(treasury.get_request(rid2))
    assert req2["state_name"] == "PAID"
    assert treasury._mock_transfers[1] == (Address(DEPLOYER), 500)

    # Test E_INSUFFICIENT_BALANCE
    treasury._mock_time[0] = 3000
    rid3 = treasury.submit_request(100, "Workshop fee reimbursement claim", "https://workshop.org/fee")
    treasury._apply_ruling(rid3, DECISION_APPROVE, 100, "[1]", 1, "Approved", False)
    treasury._mock_time[0] = 3000 + 601
    # Balance drops below approved amount right before payout!
    treasury._mock_balance[0] = 50
    with pytest.raises(Exception, match="E_INSUFFICIENT_BALANCE"):
        treasury.execute_payout(rid3)


def test_views_and_state_summary(treasury):
    set_sender(DEPLOYER)
    # get_request_count
    assert json.loads(treasury.get_request_count()) == 0

    rid = treasury.submit_request(300, "Conference ticket reimbursement claim", "https://conf.org/ticket")
    assert json.loads(treasury.get_request_count()) == 1

    # get_treasury_state
    state = json.loads(treasury.get_treasury_state())
    assert state["charter_address"] == ("0x" + "a" * 40).lower()
    assert state["appeal_window_seconds"] == 600
    assert state["member_cooldown_seconds"] == 300
    assert state["request_count"] == 1
    assert state["precedent_count"] == 0

    # get_precedent_count
    assert json.loads(treasury.get_precedent_count()) == 0

    treasury._apply_ruling(rid, DECISION_APPROVE, 300, "[1]", 1, "Approved in full", False)
    assert json.loads(treasury.get_precedent_count()) == 1

    # Paging get_precedents
    precedents = json.loads(treasury.get_precedents(0, 10))
    assert len(precedents) == 1
    assert precedents[0]["request_id"] == 1

    empty_page = json.loads(treasury.get_precedents(10, 10))
    assert empty_page == []
