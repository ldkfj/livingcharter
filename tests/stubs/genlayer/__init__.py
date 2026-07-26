"""Pure-Python GenLayer runtime stub for unit testing deterministic contract logic."""

from typing import Any, Iterator


def allow_storage(cls):
    """Stub decorator for storage-compatible dataclasses."""
    return cls


class Address:
    """Represents an Ethereum/GenLayer address (0x-prefixed 40 hex chars)."""

    def __init__(self, val: str):
        if not isinstance(val, str):
            raise ValueError(f"Address must be a string, got {type(val)}")
        val_lower = val.lower()
        if not (val_lower.startswith("0x") and len(val_lower) == 42):
            raise ValueError(f"Invalid Address format: {val}")
        try:
            int(val_lower[2:], 16)
        except ValueError:
            raise ValueError(f"Invalid hex string for Address: {val}")
        self._val = val_lower

    @property
    def as_hex(self) -> str:
        return self._val

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, Address):
            return self._val == other._val
        if isinstance(other, str):
            return self._val == other.lower()
        return False

    def __hash__(self) -> int:
        return hash(self._val)

    def __str__(self) -> str:
        return self._val

    def __repr__(self) -> str:
        return f"Address('{self._val}')"


class TreeMap:
    """Dict wrapper simulating GenVM TreeMap."""

    def __init__(self, *args, **kwargs):
        self._dict = dict(*args, **kwargs)

    def __class_getitem__(cls, item):
        return cls

    def __getitem__(self, key: Any) -> Any:
        return self._dict[key]

    def __setitem__(self, key: Any, value: Any) -> None:
        self._dict[key] = value

    def __delitem__(self, key: Any) -> None:
        del self._dict[key]

    def __contains__(self, key: Any) -> bool:
        return key in self._dict

    def __len__(self) -> int:
        return len(self._dict)

    def __iter__(self) -> Iterator:
        return iter(self._dict)

    def get(self, key: Any, default: Any = None) -> Any:
        return self._dict.get(key, default)

    def items(self):
        return self._dict.items()

    def keys(self):
        return self._dict.keys()

    def values(self):
        return self._dict.values()


class DynArray:
    """List wrapper simulating GenVM DynArray."""

    def __init__(self, initial: list = None):
        self._list = list(initial) if initial is not None else []

    def __class_getitem__(cls, item):
        return cls

    def append(self, item: Any) -> None:
        self._list.append(item)

    def __len__(self) -> int:
        return len(self._list)

    def __getitem__(self, index: Any) -> Any:
        return self._list[index]

    def __setitem__(self, index: int, value: Any) -> None:
        self._list[index] = value

    def __iter__(self) -> Iterator:
        return iter(self._list)

    def __contains__(self, item: Any) -> bool:
        return item in self._list

    def index(self, item: Any) -> int:
        return self._list.index(item)


class MessageContext:
    """Stub for gl.message context."""

    def __init__(self):
        self.sender_address: Address = Address("0x" + "1" * 40)


class PublicNamespace:
    """Stub for gl.public decorators."""

    @staticmethod
    def view(func):
        return func

    @staticmethod
    def write(func):
        return func


def _is_storage_type(field_type: Any, target_cls: type, type_name: str) -> bool:
    if field_type is target_cls or getattr(field_type, "__origin__", None) is target_cls:
        return True
    if isinstance(field_type, str):
        clean = field_type.strip()
        return clean == type_name or clean.startswith(type_name + "[")
    return False


class Contract:
    """Base class for gl.Contract with GenVM storage auto-initialization."""

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        orig_init = cls.__init__

        def __init__(self, *args, **kw):
            annotations = getattr(cls, "__annotations__", {})
            for field_name, field_type in annotations.items():
                if _is_storage_type(field_type, TreeMap, "TreeMap"):
                    setattr(self, field_name, TreeMap())
                elif _is_storage_type(field_type, DynArray, "DynArray"):
                    setattr(self, field_name, DynArray())
            orig_init(self, *args, **kw)

        cls.__init__ = __init__


class GenLayerNamespace:
    """Stub for gl namespace."""

    def __init__(self):
        self.Contract = Contract
        self.public = PublicNamespace()
        self.message = MessageContext()


gl = GenLayerNamespace()

u8 = int
u32 = int
u64 = int
u256 = int
