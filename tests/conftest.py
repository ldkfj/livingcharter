"""Pytest configuration and shared fixtures for LivingCharter testing."""

import os
import sys
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
    import json

    charter_raw.bootstrap(json.dumps(FOUNDING_ARTICLES))
    return charter_raw
