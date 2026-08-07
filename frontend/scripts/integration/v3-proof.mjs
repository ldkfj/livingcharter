// Treasury v3 live-proof runner. It reads existing testnet-only B/C keys at runtime
// but never prints them. Run one named step at a time from frontend/.
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { isLosslessNumber, parse } from "lossless-json";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RPC = "https://studio.genlayer.com/api";
const TREASURY = "0xa430f80c74cC90a1a75E3906055118e97CdC363b";
const UNAVAILABLE_EVIDENCE = "https://livingcharter-proof.invalid/evidence";
const PYCON_EVIDENCE = "https://us.pycon.org/2026/attend/information/";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const keys = JSON.parse(
  readFileSync(join(root, ".secrets", "integration-accounts.json"), "utf8"),
);

const readClient = createClient({ chain: studionet, endpoint: RPC });
const clientFor = (who) =>
  createClient({
    chain: studionet,
    endpoint: RPC,
    account: createAccount(keys[who].privateKey),
  });
const json = (value) =>
  JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
const WEI_FIELDS = new Set([
  "amount_wei",
  "approved_amount_wei",
  "requested_wei",
  "approved_wei",
  "balance_wei",
  "reserved_amount_wei",
  "reserved_wei",
  "available_balance_wei",
]);

function executionResult(receipt) {
  const name = receipt?.txExecutionResultName ?? receipt?.tx_execution_result_name;
  if (name === "FINISHED_WITH_RETURN") return "SUCCESS";
  if (name === "FINISHED_WITH_ERROR") return "ERROR";
  const consensus = receipt?.consensusData ?? receipt?.consensus_data;
  const receipts = Array.isArray(consensus?.leader_receipt)
    ? consensus.leader_receipt
    : [];
  const leader = receipts.find((item) => item?.mode === "leader") ?? receipts[0];
  return leader?.execution_result ?? leader?.executionResult ?? "UNKNOWN";
}

async function view(functionName, args = []) {
  const raw = await readClient.readContract({ address: TREASURY, functionName, args });
  return parse(raw, (key, value) => {
    if (!isLosslessNumber(value)) return value;
    return WEI_FIELDS.has(key) ? BigInt(value.toString()) : Number(value.toString());
  });
}

async function write(who, functionName, args) {
  const client = clientFor(who);
  const hash = await client.writeContract({
    address: TREASURY,
    functionName,
    args,
    value: 0n,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "FINALIZED",
    interval: 8_000,
    retries: 400,
  });
  const result = executionResult(receipt);
  console.log(`${who} ${functionName}: ${hash} [FINALIZED/${result}]`);
  if (result !== "SUCCESS") throw new Error(`${functionName} failed: ${result}`);
  return hash;
}

async function writeExpectedError(who, functionName, args, expectedCode) {
  const client = clientFor(who);
  const hash = await client.writeContract({
    address: TREASURY,
    functionName,
    args,
    value: 0n,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "FINALIZED",
    interval: 8_000,
    retries: 240,
  });
  const result = executionResult(receipt);
  let diagnostic = json(receipt);
  try {
    diagnostic += json(await client.debugTraceTransaction({ hash, round: 0 }));
  } catch {
    // The finalized receipt remains authoritative if trace retrieval is unavailable.
  }
  const code = diagnostic.match(/E_[A-Z0-9_]+/)?.[0] ?? "NO_ERROR_CODE";
  console.log(`${who} ${functionName}: ${hash} [FINALIZED/${result}/${code}]`);
  if (result !== "ERROR" || code !== expectedCode) {
    throw new Error(`Expected ${expectedCode}; received ${result}/${code}`);
  }
  return hash;
}

function assertState(condition, message) {
  if (!condition) throw new Error(`Proof precondition failed: ${message}`);
}

const step = process.argv[2];

if (step === "reserve") {
  const before = await view("get_treasury_state");
  assertState(before.balance_wei === 1_000_000_000_000_000_000n, "balance must be 1 GEN");
  assertState(before.reserved_wei === 0n, "reserved balance must start at zero");
  assertState(before.request_count === 0, "v3 must have no prior requests");

  await write("B", "submit_request", [
    600_000_000_000_000_000n,
    "Reservation proof request B using intentionally unavailable public evidence.",
    UNAVAILABLE_EVIDENCE,
    "",
    "",
  ]);
  await write("C", "submit_request", [
    400_000_000_000_000_000n,
    "Reservation proof request C using intentionally unavailable public evidence.",
    UNAVAILABLE_EVIDENCE,
    "",
    "",
  ]);

  const after = await view("get_treasury_state");
  assertState(after.reserved_wei === after.balance_wei, "all funded GEN must be reserved");
  assertState(after.available_balance_wei === 0n, "available balance must be zero");
  console.log(`state: ${json(after)}`);
} else if (step === "reserve-c") {
  const before = await view("get_treasury_state");
  assertState(before.request_count === 1, "request B must be the only request");
  assertState(before.reserved_wei === 600_000_000_000_000_000n, "request B must reserve 0.6 GEN");
  assertState(before.available_balance_wei === 400_000_000_000_000_000n, "0.4 GEN must remain available");

  await write("C", "submit_request", [
    400_000_000_000_000_000n,
    "Reservation proof request C using intentionally unavailable public evidence.",
    UNAVAILABLE_EVIDENCE,
    "",
    "",
  ]);

  const after = await view("get_treasury_state");
  assertState(after.request_count === 2, "request C must be recorded as request 2");
  assertState(after.reserved_wei === after.balance_wei, "all funded GEN must be reserved");
  assertState(after.available_balance_wei === 0n, "available balance must be zero");
  console.log(`state: ${json(after)}`);
} else if (step === "overcommit") {
  const before = await view("get_treasury_state");
  await writeExpectedError(
    "B",
    "submit_request",
    [1n, "Aggregate overcommit attempt must fail before any new state is written.", UNAVAILABLE_EVIDENCE, "", ""],
    "E_INVALID_AMOUNT",
  );
  const after = await view("get_treasury_state");
  assertState(json(after) === json(before), "failed overcommit must leave treasury state unchanged");
  console.log(`unchanged state: ${json(after)}`);
} else if (step === "fail-b" || step === "fail-c") {
  const requestId = step === "fail-b" ? 1 : 2;
  const actor = step === "fail-b" ? "C" : "B";
  await write(actor, "adjudicate_request", [requestId]);
  const retry = await view("get_request", [requestId]);
  assertState(retry.state_name === "UNDETERMINED", "first failure must be UNDETERMINED");
  assertState(retry.reservation_active === true, "retry must preserve reservation");
  console.log(`retry state: ${json(retry)}`);

  await write(actor, "adjudicate_request", [requestId]);
  const failed = await view("get_request", [requestId]);
  assertState(failed.state_name === "FAILED", "second failure must be FAILED");
  assertState(failed.reservation_active === false, "FAILED must release reservation");
  console.log(`failed state: ${json(failed)}`);
  console.log(`treasury: ${json(await view("get_treasury_state"))}`);
} else if (step === "replay") {
  const before = await view("get_treasury_state");
  const request = await view("get_request", [1]);
  assertState(request.state_name === "FAILED", "request 1 must already be FAILED");
  await writeExpectedError("B", "adjudicate_request", [1], "E_BAD_STATE");
  const after = await view("get_treasury_state");
  assertState(json(after) === json(before), "FAILED replay must leave treasury state unchanged");
  console.log(`unchanged state: ${json(after)}`);
} else if (step === "product-submit") {
  const before = await view("get_treasury_state");
  assertState(before.request_count === 2, "failure proofs must occupy requests 1 and 2");
  assertState(before.reserved_wei === 0n, "all proof reservations must be released");
  await write("B", "submit_request", [
    20_000_000_000_000_000n,
    "Reimburse one PyCon US 2026 ticket for a member attending software development training, using the official public registration information page as evidence.",
    PYCON_EVIDENCE,
    "",
    "",
  ]);
  const request = await view("get_request", [3]);
  assertState(request.state_name === "SUBMITTED", "request 3 must be SUBMITTED");
  assertState(request.reservation_active === true, "request 3 must reserve its full amount");
  console.log(`request 3: ${json(request)}`);
  console.log(`treasury: ${json(await view("get_treasury_state"))}`);
} else if (step === "product-adjudicate") {
  await write("C", "adjudicate_request", [3]);
  const request = await view("get_request", [3]);
  assertState(request.state_name === "RULED", "request 3 must receive an initial ruling");
  assertState(request.initial_ruling !== null, "initial ruling must be recorded");
  assertState(request.reservation_active === true, "initial ruling must retain reservation");
  console.log(`request 3: ${json(request)}`);
} else if (step === "product-appeal") {
  await write("C", "appeal_ruling", [
    3,
    "Please independently re-fetch the official PyCon registration page and re-evaluate the documented ticket reimbursement under the active charter.",
  ]);
  const request = await view("get_request", [3]);
  assertState(request.state_name === "APPEALED", "request 3 must be APPEALED");
  assertState(request.reservation_active === true, "appeal must retain reservation");
  console.log(`request 3: ${json(request)}`);
} else if (step === "product-appeal-adjudicate") {
  await write("B", "adjudicate_request", [3]);
  const request = await view("get_request", [3]);
  assertState(request.state_name === "FINAL_RULED", "appeal ruling must be final");
  assertState(request.appeal_ruling !== null, "appeal ruling must be recorded");
  assertState(request.reservation_active === true, "final ruling must retain reservation until execution");
  console.log(`request 3: ${json(request)}`);
} else if (step === "product-payout") {
  const before = await view("get_treasury_state");
  const requestBefore = await view("get_request", [3]);
  const ruling = requestBefore.appeal_ruling ?? requestBefore.initial_ruling;
  assertState(requestBefore.state_name === "FINAL_RULED", "request 3 must be FINAL_RULED");
  assertState(ruling !== null, "effective ruling must exist");
  const approved = ruling.approved_amount_wei;
  await write("C", "execute_payout", [3]);
  const requestAfter = await view("get_request", [3]);
  const after = await view("get_treasury_state");
  assertState(requestAfter.reservation_active === false, "payout/closure must release reservation");
  assertState(after.reserved_wei === before.reserved_wei - requestBefore.amount_wei, "full request reservation must be released");
  assertState(after.balance_wei === before.balance_wei - approved, "balance delta must equal effective approved amount");
  assertState(
    requestAfter.state_name === (approved > 0n ? "PAID" : "CLOSED"),
    "terminal state must match effective amount",
  );
  console.log(`effective approved wei: ${approved}`);
  console.log(`request 3: ${json(requestAfter)}`);
  console.log(`treasury: ${json(after)}`);
} else if (step === "product-replay") {
  const before = await view("get_treasury_state");
  const request = await view("get_request", [3]);
  const expectedCode = request.paid ? "E_ALREADY_PAID" : "E_NOT_PAYABLE";
  await writeExpectedError("B", "execute_payout", [3], expectedCode);
  const after = await view("get_treasury_state");
  assertState(json(after) === json(before), "payout replay must leave treasury state unchanged");
  console.log(`unchanged state: ${json(after)}`);
} else if (step === "state") {
  console.log(`treasury: ${json(await view("get_treasury_state"))}`);
  console.log(`request 1: ${json(await view("get_request", [1]))}`);
  console.log(`request 2: ${json(await view("get_request", [2]))}`);
  console.log(`precedents: ${json(await view("get_precedents", [0, 10]))}`);
} else {
  console.log("Usage: node scripts/integration/v3-proof.mjs <reserve|reserve-c|overcommit|fail-b|fail-c|replay|product-submit|product-adjudicate|product-appeal|product-appeal-adjudicate|product-payout|product-replay|state>");
}
