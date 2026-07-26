"""Smoke tests for the pure-Python GenLayer stub."""

import pytest
from genlayer import gl, Address, TreeMap, DynArray, allow_storage, u8, u32, u64, u256, ConsensusFailure, Return


def test_address_validation():
    valid = Address("0x1111111111111111111111111111111111111111")
    assert valid.as_hex == "0x1111111111111111111111111111111111111111"
    assert valid == "0x1111111111111111111111111111111111111111"
    assert valid == Address("0x1111111111111111111111111111111111111111")

    with pytest.raises(ValueError):
        Address("0xinvalid")

    with pytest.raises(ValueError):
        Address("0x123")

    with pytest.raises(ValueError):
        Address("1111111111111111111111111111111111111111")


def test_treemap_behavior():
    m = TreeMap()
    m["key1"] = "val1"
    m["key2"] = "val2"
    assert len(m) == 2
    assert "key1" in m
    assert m["key1"] == "val1"
    assert m.get("key2") == "val2"
    assert m.get("key3", "default") == "default"
    assert list(m.keys()) == ["key1", "key2"]


def test_dynarray_behavior():
    arr = DynArray()
    arr.append(10)
    arr.append(20)
    assert len(arr) == 2
    assert arr[0] == 10
    assert 20 in arr
    assert arr.index(20) == 1
    items = [x for x in arr]
    assert items == [10, 20]


def test_gl_namespace_and_types():
    assert issubclass(gl.Contract, object)
    setattr(gl.message, "sender_address", Address("0x" + "2" * 40))
    assert gl.message.sender_address == Address("0x" + "2" * 40)

    @gl.public.view
    def sample_view():
        return 42

    @gl.public.write
    def sample_write():
        return 100

    @gl.public.write.payable
    def sample_payable():
        return 200

    assert sample_view() == 42
    assert sample_write() == 100
    assert sample_payable() == 200

    gl.message.value = 500
    assert gl.message.value == 500

    assert u8 is int
    assert u32 is int
    assert u64 is int
    assert u256 is int


def test_contract_storage_auto_initialization():
    class DummyContract(gl.Contract):
        map_field: TreeMap[str, int]
        arr_field: DynArray[str]

        def __init__(self):
            pass

    c1 = DummyContract()
    c2 = DummyContract()

    assert isinstance(c1.map_field, TreeMap)
    assert isinstance(c1.arr_field, DynArray)
    assert isinstance(c2.map_field, TreeMap)
    assert isinstance(c2.arr_field, DynArray)

    c1.map_field["a"] = 1
    c1.arr_field.append("x")

    assert "a" in c1.map_field
    assert "a" not in c2.map_field
    assert len(c1.arr_field) == 1
    assert len(c2.arr_field) == 0


def test_stub_nondet_surface():
    # Web fetch registry
    gl.nondet.web._registry["https://example.com"] = "<html>Hello Web</html>"
    assert gl.nondet.web.render("https://example.com") == "<html>Hello Web</html>"
    assert gl.nondet.web.get("https://example.com").body == b"<html>Hello Web</html>"

    with pytest.raises(Exception, match="404"):
        gl.nondet.web.render("https://nonexistent.com")

    # Prompt queue
    gl.nondet._prompt_queue = ['{"decision": "APPROVE"}']
    gl.nondet._prompt_history = []

    res = gl.nondet.exec_prompt("Test prompt")
    assert res == '{"decision": "APPROVE"}'
    assert gl.nondet._prompt_history == ["Test prompt"]

    # run_nondet_unsafe happy path
    def leader_fn():
        return 123

    def validator_fn(ret):
        return isinstance(ret, Return) and ret.calldata == 123

    val = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
    assert val == 123

    # run_nondet_unsafe rejection
    def validator_reject(ret):
        return False

    with pytest.raises(ConsensusFailure, match="Consensus rejected"):
        gl.vm.run_nondet_unsafe(leader_fn, validator_reject)

    # Cross-contract registry
    addr = "0x" + "a" * 40
    class TargetContract:
        def get_value(self):
            return 999

    gl._contracts_registry[addr.lower()] = TargetContract()
    ref = gl.get_contract_at(addr)
    assert ref.view().get_value() == 999
