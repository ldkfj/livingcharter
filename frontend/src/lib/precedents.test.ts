import { describe, expect, it } from "vitest";
import { PrecedentInfo } from "../types/contract";
import { mergePrecedentPages } from "./precedents";

function precedent(seq: number, summary = `Precedent ${seq}`): PrecedentInfo {
  return {
    seq,
    request_id: seq,
    decision: 1,
    decision_name: "APPROVE",
    requested_wei: BigInt(seq),
    approved_wei: BigInt(seq),
    cited_article_ids: [1],
    charter_version: 1,
    summary,
    created_at: 1_722_000_000 + seq,
    is_appeal: false,
  };
}

describe("mergePrecedentPages", () => {
  it("appends pages, deduplicates by sequence, and preserves newest-first order", () => {
    const current = [precedent(5), precedent(4), precedent(3, "stale")];
    const incoming = [precedent(3, "refreshed"), precedent(2), precedent(1)];

    const merged = mergePrecedentPages(current, incoming);

    expect(merged.map((item) => item.seq)).toEqual([5, 4, 3, 2, 1]);
    expect(merged.find((item) => item.seq === 3)?.summary).toBe("refreshed");
  });

  it("places newly polled precedents ahead of already loaded pages", () => {
    const merged = mergePrecedentPages(
      [precedent(4), precedent(3), precedent(2), precedent(1)],
      [precedent(6), precedent(5), precedent(4)],
    );

    expect(merged.map((item) => item.seq)).toEqual([6, 5, 4, 3, 2, 1]);
  });
});
