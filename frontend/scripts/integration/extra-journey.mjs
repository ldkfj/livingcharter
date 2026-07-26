// One fresh pre-submission journey: B requests a Student-ticket reimbursement.
// Usage: node scripts/integration/extra-journey.mjs <submit|adjudicate|payout|state>
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RPC = "https://studio.genlayer.com/api";
const TREASURY = "0x99A0b62199b412421c6466E1C60e0C0D220D2F16";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const keys = JSON.parse(readFileSync(join(root, ".secrets", "integration-accounts.json"), "utf8"));

const read = createClient({ chain: studionet, endpoint: RPC });
const clientFor = (who) => createClient({ chain: studionet, endpoint: RPC, account: createAccount(keys[who].privateKey) });

async function write(who, fn, args, value = 0n) {
  const c = clientFor(who);
  const hash = await c.writeContract({ address: TREASURY, functionName: fn, args, value });
  const r = await c.waitForTransactionReceipt({ hash, status: "FINALIZED", interval: 3000, retries: 400 });
  const lr = r?.consensus_data?.leader_receipt;
  const leader = Array.isArray(lr) ? (lr.find((x) => x?.mode === "leader") ?? lr[0]) : null;
  console.log(`${fn} tx=${hash} [${r?.statusName ?? r?.status}/${leader?.execution_result}]`);
  if ((leader?.execution_result) !== "SUCCESS") throw new Error(`${fn} failed`);
  return hash;
}
const view = async (fn, args = []) => JSON.parse(await read.readContract({ address: TREASURY, functionName: fn, args }));

const action = process.argv[2];
if (action === "submit") {
  await write("B", "submit_request", [
    10000000000000000n,
    "Reimburse one PyCon US 2026 Student ticket for a member attending for software development training, per charter article 1. Requesting 0.01 GEN equivalent of the Student ticket price listed on the official registration information page.",
    "https://us.pycon.org/2026/attend/information/",
    "", "",
  ]);
  console.log(JSON.stringify(await view("get_request", [5]), null, 1));
} else if (action === "adjudicate") {
  await write("C", "adjudicate_request", [5]);
  console.log(JSON.stringify(await view("get_request", [5]), null, 1));
} else if (action === "payout") {
  await write("C", "execute_payout", [5]);
  console.log(JSON.stringify(await view("get_treasury_state"), null, 1));
} else {
  console.log(JSON.stringify(await view("get_request", [5]), null, 1));
}
