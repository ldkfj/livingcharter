// LivingCharter integration journey runner (Studionet dev instance).
// Usage: node scripts/integration/journey.mjs <step>
// Testnet-only bot accounts from .secrets/integration-accounts.json.
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RPC = "https://studio.genlayer.com/api";
const CHARTER = "0x0D22C5298ad1437DB715A543B485588a8e0fc9DB";
const TREASURY = "0xB984B0a79B9BC17C332017B0640Dc82eE6151393";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const keys = JSON.parse(readFileSync(join(root, ".secrets", "integration-accounts.json"), "utf8"));

const readClient = createClient({ chain: studionet, endpoint: RPC });
const clientFor = (who) =>
  createClient({ chain: studionet, endpoint: RPC, account: createAccount(keys[who].privateKey) });

function execResult(receipt) {
  const name = receipt?.txExecutionResultName ?? receipt?.tx_execution_result_name;
  if (name === "FINISHED_WITH_RETURN") return "SUCCESS";
  if (name === "FINISHED_WITH_ERROR") return "ERROR";
  const cd = receipt?.consensus_data ?? receipt?.consensusData;
  const lr = Array.isArray(cd?.leader_receipt) ? cd.leader_receipt : [];
  const leader = lr.find((r) => r?.mode === "leader") ?? lr[0];
  const raw = leader?.execution_result ?? leader?.executionResult;
  return raw === "SUCCESS" ? "SUCCESS" : raw === "ERROR" ? "ERROR" : `UNKNOWN(${name ?? raw ?? "?"})`;
}

async function write(who, address, functionName, args, valueWei = 0n, retries = 240) {
  const c = clientFor(who);
  const hash = await c.writeContract({ address, functionName, args, value: valueWei });
  process.stdout.write(`  ${who} -> ${functionName}(${JSON.stringify(args, (k,v) => typeof v === "bigint" ? v.toString() : v).slice(0, 90)}) tx=${hash} ...`);
  const receipt = await c.waitForTransactionReceipt({ hash, status: "FINALIZED", interval: 3000, retries });
  const res = execResult(receipt);
  const status = receipt?.statusName ?? receipt?.status;
  console.log(` [${status}/${res}]`);
  if (res !== "SUCCESS") {
    console.log("  RECEIPT DIAG:", JSON.stringify(receipt, (k, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 1500));
    throw new Error(`${functionName} failed: ${res}`);
  }
  return hash;
}

async function view(address, functionName, args = []) {
  const raw = await readClient.readContract({ address, functionName, args });
  try { return JSON.parse(raw); } catch { return raw; }
}

const dump = (label, obj) => console.log(label, JSON.stringify(obj, null, 1).slice(0, 2000));

const steps = {
  // Verify the user's 5 Studio calls, then B votes amendment 2 and finalizes -> C member.
  async step1() {
    dump("counts before:", await view(CHARTER, "get_counts"));
    dump("amendment 2:", await view(CHARTER, "get_amendment", [2]));
    await write("B", CHARTER, "vote", [2, true]);
    await write("B", CHARTER, "finalize_amendment", [2]);
    dump("counts after:", await view(CHARTER, "get_counts"));
    dump("member B:", await view(CHARTER, "get_member", [keys.B.address]));
    dump("member C:", await view(CHARTER, "get_member", [keys.C.address]));
  },

  // B submits request #1 (conference ticket, expect APPROVE per article 1)
  async step2() {
    await write("B", TREASURY, "submit_request", [
      20000000000000000n,
      "Reimburse one PyCon US conference ticket for software development training, per charter article 1. Requesting 0.02 GEN equivalent of the ticket price listed on the official event page.",
      "https://us.pycon.org/2026/",
      "", "",
    ]);
    dump("request 1:", await view(TREASURY, "get_request", [1]));
  },

  // C triggers AI adjudication of request #1 (heavy nondet tx)
  async step3() {
    await write("C", TREASURY, "adjudicate_request", [1], 0n, 400);
    dump("request 1:", await view(TREASURY, "get_request", [1]));
    dump("precedents:", await view(TREASURY, "get_precedents", [0, 5]));
  },

  // C submits request #2 (hardware @50%, expect PARTIAL per article 2), B adjudicates
  async step4() {
    await write("C", TREASURY, "submit_request", [
      40000000000000000n,
      "Reimburse a Keychron K2 mechanical keyboard purchased for development work, per charter article 2 which allows 50% of the listed price. Listed price equivalent 0.08 GEN; requesting 0.04 GEN (50%).",
      "https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard",
      "", "",
    ]);
    await write("B", TREASURY, "adjudicate_request", [2], 0n, 400);
    dump("request 2:", await view(TREASURY, "get_request", [2]));
  },

  // Execute payouts for #1 and #2 after their appeal windows
  async step5() {
    for (const id of [1, 2]) {
      const req = await view(TREASURY, "get_request", [id]);
      console.log(`request ${id}: state=${req.state_name} ruled_at=${req.ruled_at} appeal_deadline=${req.appeal_deadline}`);
      if (req.state_name === "RULED") {
        await write("C", TREASURY, "execute_payout", [id]);
        dump(`request ${id} after payout:`, await view(TREASURY, "get_request", [id]));
      } else {
        console.log(`  skip payout: state ${req.state_name}`);
      }
    }
    dump("treasury:", await view(TREASURY, "get_treasury_state"));
  },

  // B submits request #3 (team dinner, expect DENY per article 4), C adjudicates
  async step6() {
    await write("B", TREASURY, "submit_request", [
      20000000000000000n,
      "Reimburse a team dinner after the release milestone. Requesting 0.02 GEN equivalent; menu prices are on the linked page.",
      "https://www.mcdonalds.com/us/en-us/full-menu.html",
      "", "",
    ]);
    await write("C", TREASURY, "adjudicate_request", [3], 0n, 400);
    dump("request 3:", await view(TREASURY, "get_request", [3]));
  },

  // B appeals #3, C triggers appeal adjudication -> FINAL_RULED, then close (zero payout)
  async step7() {
    await write("B", TREASURY, "appeal_ruling", [3,
      "The dinner was a working session directly tied to shipping the release; article 1 supports development-related expenses and the denial reads article 4 too broadly.",
    ]);
    await write("C", TREASURY, "adjudicate_request", [3], 0n, 400);
    dump("request 3 after appeal ruling:", await view(TREASURY, "get_request", [3]));
    const req = await view(TREASURY, "get_request", [3]);
    if (req.state_name === "FINAL_RULED") {
      await write("C", TREASURY, "execute_payout", [3]);
      dump("request 3 closed:", await view(TREASURY, "get_request", [3]));
    }
  },

  // Living-charter moment: replace article 4 (B proposes, B+C vote, B finalizes)
  async step8() {
    await write("B", CHARTER, "propose_amendment", [1, 4,
      "Food and drinks for documented team events tied to project milestones are reimbursable up to 0.03 GEN equivalent per request, with the venue or menu page as public evidence. Entertainment remains non-reimbursable.",
      "0x0000000000000000000000000000000000000000",
      "Team meals at milestones proved development-related; the blanket food ban is too strict.",
    ]);
    const counts = await view(CHARTER, "get_counts");
    const aid = counts.amendments;
    console.log("amendment id:", aid);
    await write("B", CHARTER, "vote", [aid, true]);
    await write("C", CHARTER, "vote", [aid, true]);
    await write("B", CHARTER, "finalize_amendment", [aid]);
    dump("bundle after amendment:", await view(CHARTER, "get_charter_bundle"));
  },

  // C submits request #4 (team dinner AFTER amendment, expect APPROVE/PARTIAL), B adjudicates
  async step9() {
    await write("C", TREASURY, "submit_request", [
      20000000000000000n,
      "Reimburse the documented team dinner for the integration milestone, per amended charter article 4 (food for documented team events up to 0.03 GEN). Requesting 0.02 GEN; menu prices on the linked page.",
      "https://www.mcdonalds.com/us/en-us/full-menu.html",
      "", "",
    ]);
    await write("B", TREASURY, "adjudicate_request", [4], 0n, 400);
    dump("request 4:", await view(TREASURY, "get_request", [4]));
  },

  // Final payout + full state dump
  async step10() {
    const req = await view(TREASURY, "get_request", [4]);
    console.log(`request 4: state=${req.state_name}`);
    if (req.state_name === "RULED") {
      await write("C", TREASURY, "execute_payout", [4]);
    }
    dump("request 4 final:", await view(TREASURY, "get_request", [4]));
    dump("treasury final:", await view(TREASURY, "get_treasury_state"));
    dump("precedents:", await view(TREASURY, "get_precedents", [0, 10]));
    dump("counts:", await view(CHARTER, "get_counts"));
  },
};

const step = process.argv[2];
if (!steps[step]) {
  console.log("Usage: node journey.mjs <" + Object.keys(steps).join("|") + ">");
  process.exit(1);
}
await steps[step]();


