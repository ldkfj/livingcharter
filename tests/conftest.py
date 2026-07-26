"""Pytest configuration and shared fixtures for LivingCharter testing."""

import os
import sys
import json
import pytest

# Ensure stubs and contracts directories are on sys.path
stubs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "stubs"))
contracts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "contracts"))

if stubs_dir not in sys.path:
    sys.path.insert(0, stubs_dir)
if contracts_dir not in sys.path:
    sys.path.insert(1, contracts_dir)

from genlayer import gl, Address
from charter import Charter

# Founding charter sample articles meeting 20-2000 char length rule
FOUNDING_ARTICLES = [
    "The treasury reimburses members for conference or workshop tickets directly related to software development.",
    "Hardware purchases are reimbursed at 50% of listed price up to 0.05 GEN equivalent per request.",
    "Requests without verifiable public evidence for the claimed cost must be denied in full.",
    "Food, drinks, and entertainment are strictly non-reimbursable expenses under any circumstances.",
]


def set_sender(addr_hex: str):
    """Helper to set gl.message.sender_address in tests."""
    gl.message.sender_address = Address(addr_hex)


@pytest.fixture
def default_deployer():
    addr = "0x" + "1" * 40
    set_sender(addr)
    return addr


@pytest.fixture
def charter_raw(default_deployer, monkeypatch):
    c = Charter()
    curr_time = 1000

    def mock_now():
        return curr_time

    monkeypatch.setattr(c, "_now", mock_now)
    return c


@pytest.fixture
def charter(charter_raw, default_deployer):
    charter_raw.bootstrap(json.dumps(FOUNDING_ARTICLES))
    return charter_raw


@pytest.fixture
def treasury_raw(default_deployer, monkeypatch):
    from treasury import Treasury

    charter_addr = "0x" + "a" * 40
    t = Treasury(
        charter_address=charter_addr,
        appeal_window_seconds=600,
        member_cooldown_seconds=300,
    )

    curr_time = [1000]
    balance = [10**18]
    transfers = []
    active_members = {("0x" + "1" * 40).lower(), ("0x" + "2" * 40).lower()}

    class MockCharter:
        def get_charter_bundle(self):
            return json.dumps({
                "charter_version": 1,
                "articles": [
                    {"id": 1, "version": 1, "text": FOUNDING_ARTICLES[0]},
                    {"id": 2, "version": 1, "text": FOUNDING_ARTICLES[1]},
                    {"id": 3, "version": 1, "text": FOUNDING_ARTICLES[2]},
                    {"id": 4, "version": 1, "text": FOUNDING_ARTICLES[3]},
                ],
            })

        def get_member(self, addr):
            addr_lower = addr.lower()
            return json.dumps({"active": addr_lower in active_members})

    mock_charter = MockCharter()
    gl._contracts_registry[charter_addr.lower()] = mock_charter

    def mock_now():
        return curr_time[0]

    def mock_is_active_member(addr):
        addr_hex = addr.as_hex if hasattr(addr, "as_hex") else str(addr)
        return addr_hex.lower() in active_members

    def mock_balance():
        return balance[0]

    def mock_transfer(to, amount):
        transfers.append((to, amount))
        balance[0] -= amount

    monkeypatch.setattr(t, "_now", mock_now)
    monkeypatch.setattr(t, "_is_active_member", mock_is_active_member)
    monkeypatch.setattr(t, "_balance", mock_balance)
    monkeypatch.setattr(t, "_transfer", mock_transfer)

    t._mock_time = curr_time
    t._mock_balance = balance
    t._mock_transfers = transfers
    t._mock_active_members = active_members
    t._mock_charter = mock_charter

    return t


@pytest.fixture
def treasury(treasury_raw):
    return treasury_raw
