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


def set_sender(addr_hex: str):
    """Helper to set gl.message.sender_address in tests."""
    gl.message.sender_address = Address(addr_hex)


@pytest.fixture
def default_deployer():
    addr = "0x" + "1" * 40
    set_sender(addr)
    return addr


@pytest.fixture
def set_caller():
    return set_sender
