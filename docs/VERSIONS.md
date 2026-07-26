# Verified GenVM Header and Dependency Values

## Verified Header and Depends Values
- **Exact Contract First-Line Version Comment:** `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`
- **Exact Depends Line Verbatim:** `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`

## Storage Record Pattern
- **Source URL:** https://docs.genlayer.com/developers/intelligent-contracts/types/dataclasses
- **Verbatim Pattern:**
```python
from dataclasses import dataclass
from genlayer import *

@allow_storage
@dataclass
class UserData:
    name: str
    balance: u256
```

## Verification Metadata
- **Source URLs:**
  - https://docs.genlayer.com/developers/intelligent-contracts/first-contract
  - https://docs.genlayer.com/developers/intelligent-contracts/introduction
  - https://docs.genlayer.com/developers/intelligent-contracts/types/dataclasses
  - https://docs.genlayer.com/developers/intelligent-contracts/storage
- **Verification Date:** 2026-07-26

## Deployment Note
Re-verify against the running Studio instance at deployment (Phase 6).
