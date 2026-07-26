// Integration setup: generate two bot member accounts (B, C) with PERSISTED private keys,
// fund them via the Studionet faucet RPC (raw-wei amount embedded as a literal to avoid
// JS number precision loss). Testnet-only throwaway keys in .secrets/ (gitignored).
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const secretsDir = join(root, ".secrets");
const secretsFile = join(secretsDir, "integration-accounts.json");
const RPC = "https://studio.genlayer.com/api";
const FUND_WEI = "3000000000000000000"; // 3 GEN

let accounts;
if (existsSync(secretsFile)) {
  const saved = JSON.parse(readFileSync(secretsFile, "utf8"));
  if (saved.B?.privateKey && saved.C?.privateKey) {
    accounts = saved;
    console.log("Reusing persisted accounts.");
  }
}
if (!accounts) {
  const mk = () => {
    const pk = generatePrivateKey();
    return { privateKey: pk, address: privateKeyToAccount(pk).address };
  };
  accounts = { B: mk(), C: mk() };
  mkdirSync(secretsDir, { recursive: true });
  writeFileSync(secretsFile, JSON.stringify(accounts, null, 2));
  console.log("Generated fresh accounts with persisted keys.");
}
console.log("B:", accounts.B.address);
console.log("C:", accounts.C.address);

// sanity: genlayer-js accepts the key
createAccount(accounts.B.privateKey);
createAccount(accounts.C.privateKey);

async function rawRpc(bodyString) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyString,
  });
  return res.json();
}

for (const name of ["B", "C"]) {
  const addr = accounts[name].address;
  // embed the wei amount as a bare JSON number literal (server parses arbitrary-precision)
  const body = `{"jsonrpc":"2.0","id":1,"method":"sim_fundAccount","params":["${addr}",${FUND_WEI}]}`;
  const out = await rawRpc(body);
  console.log(`sim_fundAccount(${name}):`, JSON.stringify(out).slice(0, 160));
}

const client = createClient({ chain: studionet, endpoint: RPC });
for (const name of ["B", "C"]) {
  const bal = await client.getBalance({ address: accounts[name].address });
  console.log(`balance ${name} (wei):`, bal.toString());
}
