"""Smoke tests for the pure-Python GenLayer stub."""

import pytest
from genlayer import gl, Address, TreeMap, DynArray, u8, u32, u64, u256


def test_address_validation():
    valid = Address("0x1111111111111111111111111111111111111111")
    assert valid.as_hex == "0x1111111111111111111111111111111111111111"
    assert valid == "0x1111111111111111111111111111111111111111"
    assert valid == Address("0x1111111111111111111111111111111111111111")

    with pytest.raises(ValueError):
        Address("0xinvalid")

    with pytest.raises(ValueError):
        Address("0x123")  # too short

    with pytest.raises(ValueError):
        Address("1111111111111111111111111111111111111111")  # missing 0x


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

    assert sample_view() == 42
    assert sample_write() == 100
    assert u8 is int
    assert u32 is int
    assert u64 is int
    assert u256 is int
