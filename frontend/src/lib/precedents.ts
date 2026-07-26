import { PrecedentInfo } from "../types/contract";

export function mergePrecedentPages(
  current: PrecedentInfo[],
  incoming: PrecedentInfo[],
): PrecedentInfo[] {
  const bySequence = new Map<number, PrecedentInfo>();

  for (const precedent of current) {
    bySequence.set(precedent.seq, precedent);
  }
  for (const precedent of incoming) {
    bySequence.set(precedent.seq, precedent);
  }

  return [...bySequence.values()].sort((left, right) => right.seq - left.seq);
}
