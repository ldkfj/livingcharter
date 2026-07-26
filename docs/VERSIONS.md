# Verified GenVM Header and Dependency Values

## Verified Header and Depends Values
- **Opening Comment Line Finding:** Official GenLayer documentation examples (`first-contract` and `introduction`) do not show a separate `# vX.Y.Z` version comment line. The contract's required opening line shown in official examples is verbatim:
  `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`
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

## Runtime API surface (verified 2026-07-26)
- **Block/transaction timestamp accessor:** `int(time.time())` | Signature: `time.time() -> float`, converted immediately to `int` for storage | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context
- **Web fetch (render/get):** `gl.nondet.web.render` / `gl.nondet.web.get` | Signatures: `gl.nondet.web.render(url: str, mode: str = 'html') -> str`, `gl.nondet.web.get(url: str) -> Response` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/web-access
- **LLM prompt execution:** `gl.nondet.exec_prompt` | Signature: `gl.nondet.exec_prompt(prompt: str, response_format: str = 'text', images: list = None) -> str | dict` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms
- **Nondet leader/validator execution wrapper:** `gl.vm.run_nondet_unsafe` | Signature: `gl.vm.run_nondet_unsafe(leader_fn: Callable, validator_fn: Callable) -> Any` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism
- **Validator result wrapper shape:** `gl.vm.Return` object containing `.calldata` property holding the leader's return value (`leader_res.calldata`), or `gl.vm.UserError` / `gl.vm.VMError` on error | Source URLs: https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism , https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms
- **Cross-contract view-call pattern:** `gl.get_contract_at(addr).view().method_name()` | Signature: `gl.get_contract_at(contract_address: Address) -> ContractRef` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-intelligent-contracts
- **Contract native balance accessor:** `self.balance` | Signature: `self.balance -> u256` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers
- **Native transfer to Intelligent Contract:** `gl.get_contract_at(recipient).emit_transfer(value=u256(amount))` | Signature: `gl.get_contract_at(to: Address).emit_transfer(value: u256, on: str = 'finalized') -> None` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers
- **Native transfer to EOA:** `@gl.evm.contract_interface class _Recipient: class View: pass; class Write: pass; _Recipient(Address(recipient)).emit_transfer(value=v)` | Signature: `_Recipient(Address(to)).emit_transfer(value: u256)` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers
- **Payable value accessor:** `gl.message.value` | Signature: `gl.message.value -> u256` | Source URL: https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context
- **Balances documentation page:** `https://docs.genlayer.com/developers/intelligent-contracts/features/balances` now exists and states that it moved to and links to `features/value-transfers`; native balances are documented under the value-transfers page.

## Frontend toolchain (verified installed 2026-07-27 via npm ls)
- **genlayer-js:** `v1.1.8`
- **React:** `v19.2.8`
- **React-DOM:** `v19.2.8`
- **Vite:** `v6.4.3`
- **TypeScript:** `v5.9.3`

## Frontend write path (verified 2026-07-27)
- **Create write client:** `createClient({ chain: studionet, endpoint: "https://studio.genlayer.com/api", account: accountAddress })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- **Request EIP-1193 accounts:** `ethereum.request({ method: "eth_requestAccounts" })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- **Switch EIP-1193 chain:** `ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xF22F" }] })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- **Add EIP-1193 chain:** `ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0xF22F", chainName: "GenLayer Studionet", ... }] })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- **Query EIP-1193 chain ID:** `ethereum.request({ method: "eth_chainId" })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- **Write contract transaction:** `client.writeContract({ address, functionName, args, value })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- **Wait for transaction receipt:** `client.waitForTransactionReceipt({ hash, status, interval, retries })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- **Fetch transaction status:** `client.getTransaction({ hash })` | Source URL: https://docs.genlayer.com/developers/decentralized-applications/querying-a-transaction

## Verification Metadata
- **Source URLs:**
  - https://docs.genlayer.com/developers/intelligent-contracts/first-contract
  - https://docs.genlayer.com/developers/intelligent-contracts/introduction
  - https://docs.genlayer.com/developers/intelligent-contracts/types/dataclasses
  - https://docs.genlayer.com/developers/intelligent-contracts/storage
  - https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism
  - https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms
  - https://docs.genlayer.com/developers/intelligent-contracts/features/web-access
  - https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context
  - https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-intelligent-contracts
  - https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers
  - https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle
  - https://docs.genlayer.com/developers/decentralized-applications/genlayer-js
  - https://docs.genlayer.com/developers/decentralized-applications/reading-data
  - https://docs.genlayer.com/developers/decentralized-applications/writing-data
  - https://docs.genlayer.com/developers/decentralized-applications/querying-a-transaction
- **Verification Date:** 2026-07-27

## Deployment Note
Re-verify against the running Studio instance at deployment (Phase 6).
