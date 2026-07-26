"""Full unit test suite for Treasury contract nondeterministic adjudication flow."""

import json
import pytest
from genlayer import gl, Address, ConsensusFailure
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
    REQ_UNDETERMINED,
    REQ_FAILED,
    REQ_APPEAL_UNDETERMINED,
    _evaluate_request,
)

DEPLOYER = "0x" + "1" * 40
MEMBER_2 = "0x" + "2" * 40
EVIDENCE_URL_1 = "https://conf.org/ticket"
EVIDENCE_URL_2 = "https://vendor.com/invoice"


def test_happy_path_approve_partial_deny(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt for Dev Conference 2026: 1000 wei</html>"

    # 1. APPROVE
    rid1 = treasury.submit_request(1000, "Dev Conference Ticket Reimbursement", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        # Leader response
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Valid dev conference per article 1"},
        # Validator response
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Valid dev conference per article 1"},
    ]

    treasury.adjudicate_request(rid1)
    req1 = json.loads(treasury.get_request(rid1))
    assert req1["state_name"] == "RULED"
    assert req1["initial_ruling"]["decision_name"] == "APPROVE"
    assert req1["initial_ruling"]["approved_amount_wei"] == 1000
    assert req1["initial_ruling"]["charter_version"] == 1
    assert req1["appeal_deadline"] == 1000 + 600

    p1 = json.loads(treasury.get_precedents(0, 10))
    assert len(p1) == 1
    assert p1[0]["charter_version"] == 1

    # 2. PARTIAL
    treasury._mock_time[0] = 2000
    set_sender(MEMBER_2)
    rid2 = treasury.submit_request(1000, "Hardware purchase claim text", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "PARTIAL", "approved_amount_wei": "500", "cited_article_ids": [2], "reason": "Reimbursing 50% per article 2"},
        {"decision": "PARTIAL", "approved_amount_wei": "500", "cited_article_ids": [2], "reason": "Reimbursing 50% per article 2"},
    ]

    treasury.adjudicate_request(rid2)
    req2 = json.loads(treasury.get_request(rid2))
    assert req2["state_name"] == "RULED"
    assert req2["initial_ruling"]["decision_name"] == "PARTIAL"
    assert req2["initial_ruling"]["approved_amount_wei"] == 500

    # 3. DENY
    treasury._mock_time[0] = 3000
    set_sender(DEPLOYER)
    treasury.open_request[Address(DEPLOYER)] = 0
    rid3 = treasury.submit_request(1000, "Food and drinks expense claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "DENY", "approved_amount_wei": "0", "cited_article_ids": [4], "reason": "Food is non-reimbursable per article 4"},
        {"decision": "DENY", "approved_amount_wei": "0", "cited_article_ids": [4], "reason": "Food is non-reimbursable per article 4"},
    ]

    treasury.adjudicate_request(rid3)
    req3 = json.loads(treasury.get_request(rid3))
    assert req3["state_name"] == "RULED"
    assert req3["initial_ruling"]["decision_name"] == "DENY"
    assert req3["initial_ruling"]["approved_amount_wei"] == 0


def test_partial_tolerance_boundary(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"

    # Requested amount = 1000 wei. 10% of requested = 100 wei.
    # Leader = 500, Validator = 600 -> diff = 100 -> abs(500-600)*10 = 1000 <= 1000 -> EXACTLY 10% -> ACCEPTED!
    rid1 = treasury.submit_request(1000, "Hardware purchase claim text", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "PARTIAL", "approved_amount_wei": "500", "cited_article_ids": [2], "reason": "Partial 500"},
        {"decision": "PARTIAL", "approved_amount_wei": "600", "cited_article_ids": [2], "reason": "Partial 600"},
    ]

    treasury.adjudicate_request(rid1)
    req1 = json.loads(treasury.get_request(rid1))
    assert req1["state_name"] == "RULED"
    assert req1["initial_ruling"]["approved_amount_wei"] == 500  # Accepted with leader's amount!

    # Just over 10% tolerance: Leader = 500, Validator = 601 -> diff = 101 -> 101*10 = 1010 > 1000 -> Consensus failure!
    treasury._mock_time[0] = 2000
    set_sender(MEMBER_2)
    rid2 = treasury.submit_request(1000, "Hardware purchase claim text 2", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "PARTIAL", "approved_amount_wei": "500", "cited_article_ids": [2], "reason": "Partial 500"},
        {"decision": "PARTIAL", "approved_amount_wei": "601", "cited_article_ids": [2], "reason": "Partial 601"},
    ]

    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid2)

    req2 = json.loads(treasury.get_request(rid2))
    assert req2["state_name"] == "SUBMITTED"  # State untouched on consensus rejection!


def test_decision_mismatch_and_retry(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"

    rid = treasury.submit_request(1000, "Dev Conference Ticket Reimbursement", EVIDENCE_URL_1)

    # Leader APPROVE, Validator DENY -> Mismatch -> ConsensusFailure
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve"},
        {"decision": "DENY", "approved_amount_wei": "0", "cited_article_ids": [3], "reason": "Deny"},
    ]

    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid)

    assert json.loads(treasury.get_request(rid))["state_name"] == "SUBMITTED"

    # Retry with matching responses -> succeeds!
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve"},
    ]
    treasury.adjudicate_request(rid)
    assert json.loads(treasury.get_request(rid))["state_name"] == "RULED"


def test_malformed_json_and_shared_failure_ladder(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"

    rid = treasury.submit_request(1000, "Dev Conference Ticket Reimbursement", EVIDENCE_URL_1)

    # 1. Leader malformed, Validator healthy -> Validator rejects leader's ok=False -> ConsensusFailure
    gl.nondet._prompt_queue = [
        "not a json response string",
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve"},
    ]
    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid)

    assert json.loads(treasury.get_request(rid))["state_name"] == "SUBMITTED"

    # 2. Both malformed -> accepted shared failure -> UNDETERMINED (retries=1)
    gl.nondet._prompt_queue = [
        "not a json response string",
        "also broken json",
    ]
    treasury.adjudicate_request(rid)
    req1 = json.loads(treasury.get_request(rid))
    assert req1["state_name"] == "UNDETERMINED"
    assert req1["retries"] == 1

    # 3. Second shared failure -> moves to FAILED and clears open_request
    gl.nondet._prompt_queue = [
        "broken json again",
        "broken json again",
    ]
    treasury.adjudicate_request(rid)
    req2 = json.loads(treasury.get_request(rid))
    assert req2["state_name"] == "FAILED"
    assert req2["retries"] == 2
    assert treasury.open_request[Address(DEPLOYER)] == 0


def test_injection_resistance_at_deterministic_layer(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"

    # 1. Extra keys in schema -> reject
    rid1 = treasury.submit_request(1000, "Conference ticket reimbursement claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve", "hacked_extra_key": "true"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve", "hacked_extra_key": "true"},
    ]
    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid1)

    # 2. Cited article id not in active bundle (e.g. 99) -> reject
    treasury._mock_time[0] = 2000
    set_sender(MEMBER_2)
    rid2 = treasury.submit_request(1000, "Conference ticket reimbursement claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [99], "reason": "Approve"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [99], "reason": "Approve"},
    ]
    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid2)

    # 3. Amount > requested on APPROVE (requested 1000, approved 1500) -> reject
    treasury._mock_time[0] = 3000
    set_sender(DEPLOYER)
    treasury.open_request[Address(DEPLOYER)] = 0
    rid3 = treasury.submit_request(1000, "Conference ticket reimbursement claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1500", "cited_article_ids": [1], "reason": "Approve"},
        {"decision": "APPROVE", "approved_amount_wei": "1500", "cited_article_ids": [1], "reason": "Approve"},
    ]
    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid3)

    # 4. Reason > 500 chars -> reject
    treasury._mock_time[0] = 4000
    set_sender(MEMBER_2)
    treasury.open_request[Address(MEMBER_2)] = 0
    rid4 = treasury.submit_request(1000, "Conference ticket reimbursement claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "R" * 501},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "R" * 501},
    ]
    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid4)


def test_evidence_fetch_exception_handling(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Valid evidence</html>"

    rid = treasury.submit_request(1000, "Conference ticket reimbursement claim", EVIDENCE_URL_1, EVIDENCE_URL_2)

    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approved with valid evidence 1"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approved with valid evidence 1"},
    ]
    gl.nondet._prompt_history = []

    treasury.adjudicate_request(rid)

    assert len(gl.nondet._prompt_history) >= 1
    prompt = gl.nondet._prompt_history[0]
    assert '<EVIDENCE 1 url="https://conf.org/ticket">' in prompt
    assert '<EVIDENCE 2 url="https://vendor.com/invoice">' in prompt
    assert "EVIDENCE UNAVAILABLE" in prompt
    assert (
        "Base factual claims only on the evidence blocks that are present. "
        "Treat UNAVAILABLE blocks as absent. If the available evidence does not substantiate "
        "the claimed cost, or contradicts it, DENY citing the relevant article."
    ) in prompt
    assert "If evidence is missing or unverified, DENY." not in prompt


def test_all_evidence_unavailable_uses_shared_failure_ladder(treasury):
    set_sender(DEPLOYER)
    failed_url = "https://unavailable.example/fail"
    empty_url = "https://unavailable.example/empty"
    gl.nondet.web._registry[failed_url] = Exception("network down")
    gl.nondet.web._registry[empty_url] = ""

    rid = treasury.submit_request(
        1000,
        "Conference ticket reimbursement claim",
        failed_url,
        empty_url,
    )
    gl.nondet._prompt_queue = []
    gl.nondet._prompt_history = []

    treasury.adjudicate_request(rid)
    first = json.loads(treasury.get_request(rid))
    assert first["state_name"] == "UNDETERMINED"
    assert first["retries"] == 1
    assert first["initial_ruling"] is None
    assert treasury.precedent_count == 0
    assert gl.nondet._prompt_history == []

    treasury.adjudicate_request(rid)
    second = json.loads(treasury.get_request(rid))
    assert second["state_name"] == "FAILED"
    assert second["retries"] == 2
    assert second["initial_ruling"] is None
    assert second["appeal_ruling"] is None
    assert treasury.precedent_count == 0


def test_initial_retry_reset_and_appeal_retry_preserves_context(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"
    rid = treasury.submit_request(1000, "Dev Conference Ticket Reimbursement", EVIDENCE_URL_1)

    gl.nondet._prompt_queue = ["broken leader", "broken validator"]
    treasury.adjudicate_request(rid)
    assert treasury.requests[rid].state == REQ_UNDETERMINED
    assert treasury.requests[rid].retries == 1

    gl.nondet._prompt_queue = [
        {"decision": "DENY", "approved_amount_wei": "0", "cited_article_ids": [3], "reason": "Evidence insufficient"},
        {"decision": "DENY", "approved_amount_wei": "0", "cited_article_ids": [3], "reason": "Evidence insufficient"},
    ]
    treasury.adjudicate_request(rid)
    assert treasury.requests[rid].state == REQ_RULED
    assert treasury.requests[rid].retries == 0

    treasury.appeal_ruling(rid, "Additional public proof supports the conference cost in full.")
    gl.nondet._prompt_queue = ["broken appeal leader", "broken appeal validator"]
    treasury.adjudicate_request(rid)
    assert treasury.requests[rid].state == REQ_APPEAL_UNDETERMINED
    assert treasury.requests[rid].retries == 1

    gl.nondet._prompt_history = []
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Appeal evidence substantiates cost"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Appeal evidence substantiates cost"},
    ]
    treasury.adjudicate_request(rid)

    result = json.loads(treasury.get_request(rid))
    assert result["state_name"] == "FINAL_RULED"
    assert result["appeal_ruling"]["decision_name"] == "APPROVE"
    assert len(gl.nondet._prompt_history) == 2
    assert all("=== APPEAL ARGUMENT ===" in prompt for prompt in gl.nondet._prompt_history)


def test_two_appeal_failures_finalize_with_initial_ruling_and_allow_payout(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"
    rid = treasury.submit_request(1000, "Hardware purchase reimbursement claim", EVIDENCE_URL_1)
    treasury._apply_ruling(rid, DECISION_PARTIAL, 400, "[2]", 1, "Initial partial approval", False)
    treasury.appeal_ruling(rid, "Additional evidence requests reconsideration of the approved amount.")

    gl.nondet._prompt_queue = ["broken leader", "broken validator"]
    treasury.adjudicate_request(rid)
    assert treasury.requests[rid].state == REQ_APPEAL_UNDETERMINED

    gl.nondet._prompt_queue = ["broken leader again", "broken validator again"]
    treasury.adjudicate_request(rid)
    result = json.loads(treasury.get_request(rid))
    assert result["state_name"] == "FINAL_RULED"
    assert result["appeal_ruling"] is None
    assert result["initial_ruling"]["approved_amount_wei"] == 400
    assert treasury.precedent_count == 1

    treasury.execute_payout(rid)
    paid = json.loads(treasury.get_request(rid))
    assert paid["state_name"] == "PAID"
    assert treasury._mock_transfers == [(Address(DEPLOYER), 400)]


@pytest.mark.parametrize(
    "payload",
    [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "reason": "Missing citations"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [], "reason": "Empty citations"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1, 1], "reason": "Duplicate citations"},
    ],
    ids=["missing-cited-key", "empty-citations", "duplicate-citations"],
)
def test_strict_schema_rejects_invalid_citations(treasury, payload):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"
    rid = treasury.submit_request(1000, "Conference ticket reimbursement claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [payload, payload]

    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid)

    assert treasury.requests[rid].state == REQ_SUBMITTED


def test_validator_payload_with_invalid_amount_is_rejected(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"
    rid = treasury.submit_request(1000, "Conference ticket reimbursement claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Leader approves"},
        {"decision": "APPROVE", "approved_amount_wei": "999", "cited_article_ids": [1], "reason": "Validator amount invalid"},
    ]

    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        treasury.adjudicate_request(rid)

    assert treasury.requests[rid].state == REQ_SUBMITTED


def test_oversize_response_returns_typed_failure(treasury):
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"
    gl.nondet._prompt_queue = ["x" * 20001]

    result = _evaluate_request(
        urls=[EVIDENCE_URL_1],
        active_articles=[{"id": 1, "version": 1, "text": "Conference expenses may be reimbursed."}],
        precedent_strs=[],
        requester_hex=DEPLOYER,
        requested_wei=1000,
        purpose="Conference ticket reimbursement claim",
        is_appeal=False,
    )

    assert result == {"ok": False, "err": "OversizeResponse"}


def test_appeal_adjudication_path(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"

    rid = treasury.submit_request(1000, "Dev Conference Ticket Reimbursement", EVIDENCE_URL_1)
    treasury._apply_ruling(rid, DECISION_DENY, 0, "[3]", 1, "Initial evidence unverified", False)

    set_sender(MEMBER_2)
    treasury.appeal_ruling(rid, "Additional proof provided showing dev conference attendance in full.")

    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Appeal accepted with additional proof"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Appeal accepted with additional proof"},
    ]
    gl.nondet._prompt_history = []

    treasury.adjudicate_request(rid)

    prompt = gl.nondet._prompt_history[0]
    assert "=== ORIGINAL RULING (UNDER APPEAL) ===" in prompt
    assert "Decision: DENY" in prompt
    assert "Reason: Initial evidence unverified" in prompt
    assert "=== APPEAL ARGUMENT ===" in prompt
    assert "<UNTRUSTED_APPEAL_ARGUMENT>Additional proof provided" in prompt

    req = json.loads(treasury.get_request(rid))
    assert req["state_name"] == "FINAL_RULED"
    assert req["appeal_ruling"]["decision_name"] == "APPROVE"
    assert req["appeal_ruling"]["approved_amount_wei"] == 1000

    precedents = json.loads(treasury.get_precedents(0, 10))
    assert precedents[0]["is_appeal"] is True


def test_precedent_context_window(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"

    treasury.precedent_count = 0
    treasury.precedents = type(treasury.precedents)()

    from treasury import PrecedentRec
    for i in range(1, 13):
        treasury.precedent_count += 1
        treasury.precedents.append(
            PrecedentRec(
                seq=i,
                request_id=i,
                decision=DECISION_APPROVE,
                requested_wei=1000,
                approved_wei=1000,
                cited_article_ids_json="[1]",
                charter_version=1,
                summary=f"APPROVE: Precedent summary number {i}",
                created_at=1000 + i,
                is_appeal=False,
            )
        )

    rid = treasury.submit_request(1000, "New conference reimbursement claim", EVIDENCE_URL_1)
    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve"},
        {"decision": "APPROVE", "approved_amount_wei": "1000", "cited_article_ids": [1], "reason": "Approve"},
    ]
    gl.nondet._prompt_history = []

    treasury.adjudicate_request(rid)

    prompt = gl.nondet._prompt_history[0]
    assert "seq=12 v=1 APPROVE: Precedent summary number 12" in prompt
    assert "seq=3 v=1 APPROVE: Precedent summary number 3" in prompt
    assert "seq=1 v=1" not in prompt
    assert "seq=2 v=1" not in prompt


def test_fractional_gen_amount_prompt_formatting(treasury):
    set_sender(DEPLOYER)
    gl.nondet.web._registry[EVIDENCE_URL_1] = "<html>Receipt</html>"

    amount_wei = 1_500_000_000_000_000_000  # 1.5 GEN
    treasury._mock_balance[0] = 2 * 10**18
    rid = treasury.submit_request(amount_wei, "Conference ticket reimbursement claim", EVIDENCE_URL_1)

    gl.nondet._prompt_queue = [
        {"decision": "APPROVE", "approved_amount_wei": str(amount_wei), "cited_article_ids": [1], "reason": "Approve"},
        {"decision": "APPROVE", "approved_amount_wei": str(amount_wei), "cited_article_ids": [1], "reason": "Approve"},
    ]
    gl.nondet._prompt_history = []

    treasury.adjudicate_request(rid)

    prompt = gl.nondet._prompt_history[0]
    assert "1.500000 GEN" in prompt
    assert f"Requested Amount: {amount_wei} wei (1.500000 GEN)" in prompt
