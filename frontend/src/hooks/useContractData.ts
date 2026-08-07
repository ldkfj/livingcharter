import { useState, useEffect, useCallback, useRef } from "react";
import { contractService } from "../services/contractService";
import {
  CharterBundle,
  CharterCounts,
  TreasuryState,
  RequestInfo,
  PrecedentInfo,
  AmendmentInfo,
} from "../types/contract";
import { mergePrecedentPages } from "../lib/precedents";
import { isTransientRpcError } from "../lib/rpcRead";

export interface DashboardData {
  charterBundle: CharterBundle;
  charterCounts: CharterCounts;
  treasuryState: TreasuryState;
}

export interface ContractDataOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function useSingleFlight(task: () => Promise<void>): () => Promise<void> {
  const inFlight = useRef<Promise<void> | null>(null);

  return useCallback(() => {
    if (inFlight.current) {
      return inFlight.current;
    }

    const current = task().finally(() => {
      if (inFlight.current === current) {
        inFlight.current = null;
      }
    });
    inFlight.current = current;
    return current;
  }, [task]);
}

function useCompletionPolling(
  fetchData: () => Promise<void>,
  enabled: boolean,
  pollIntervalMs: number,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      await fetchData();
      if (!cancelled) {
        timer = setTimeout(() => {
          void poll();
        }, pollIntervalMs);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [enabled, fetchData, pollIntervalMs]);
}

export function useDashboardData(
  charterAddress: string,
  treasuryAddress: string,
  options: ContractDataOptions = {},
) {
  const enabled = options.enabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? 15_000;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const performFetch = useCallback(async () => {
    if (!hasLoaded.current) {
      setLoading(true);
    }
    try {
      setError(null);
      const [charterBundle, charterCounts, treasuryState] = await Promise.all([
        contractService.getCharterBundle(charterAddress),
        contractService.getCharterCounts(charterAddress),
        contractService.getTreasuryState(treasuryAddress),
      ]);
      setData({ charterBundle, charterCounts, treasuryState });
      hasLoaded.current = true;
    } catch (err: unknown) {
      if (!hasLoaded.current || !isTransientRpcError(err)) {
        setError(errorMessage(err, "Failed to load dashboard data from GenLayer Studionet."));
      }
    } finally {
      setLoading(false);
    }
  }, [charterAddress, treasuryAddress]);
  const fetchData = useSingleFlight(performFetch);

  useCompletionPolling(fetchData, enabled, pollIntervalMs);

  return { data, loading, error, refetch: fetchData };
}

export function useRequests(
  treasuryAddress: string,
  options: ContractDataOptions = {},
) {
  const enabled = options.enabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? 15_000;
  const [requests, setRequests] = useState<RequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const performFetch = useCallback(async () => {
    if (!hasLoaded.current) {
      setLoading(true);
    }
    try {
      setError(null);
      const count = await contractService.getRequestCount(treasuryAddress);
      if (count === 0) {
        setRequests([]);
        hasLoaded.current = true;
        return;
      }

      const reqPromises: Promise<RequestInfo>[] = [];
      for (let i = 1; i <= count; i++) {
        reqPromises.push(contractService.getRequest(treasuryAddress, i));
      }
      const results = await Promise.all(reqPromises);
      setRequests(results.reverse()); // Newest first
      hasLoaded.current = true;
    } catch (err: unknown) {
      if (!hasLoaded.current || !isTransientRpcError(err)) {
        setError(errorMessage(err, "Failed to load spend requests."));
      }
    } finally {
      setLoading(false);
    }
  }, [treasuryAddress]);
  const fetchRequests = useSingleFlight(performFetch);

  useCompletionPolling(fetchRequests, enabled, pollIntervalMs);

  return { requests, loading, error, refetch: fetchRequests };
}

export function useAmendments(
  charterAddress: string,
  options: ContractDataOptions = {},
) {
  const enabled = options.enabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? 15_000;
  const [amendments, setAmendments] = useState<AmendmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const performFetch = useCallback(async () => {
    if (!hasLoaded.current) {
      setLoading(true);
    }
    try {
      setError(null);
      const counts = await contractService.getCharterCounts(charterAddress);
      const count = counts.amendments;
      if (count === 0) {
        setAmendments([]);
        hasLoaded.current = true;
        return;
      }

      const promises: Promise<AmendmentInfo>[] = [];
      for (let i = 1; i <= count; i++) {
        promises.push(contractService.getAmendment(charterAddress, i));
      }
      const results = await Promise.all(promises);
      setAmendments(results.reverse());
      hasLoaded.current = true;
    } catch (err: unknown) {
      if (!hasLoaded.current || !isTransientRpcError(err)) {
        setError(errorMessage(err, "Failed to load amendments."));
      }
    } finally {
      setLoading(false);
    }
  }, [charterAddress]);
  const fetchAmendments = useSingleFlight(performFetch);

  useCompletionPolling(fetchAmendments, enabled, pollIntervalMs);

  return { amendments, loading, error, refetch: fetchAmendments };
}

export function usePrecedents(
  treasuryAddress: string,
  options: ContractDataOptions = {},
) {
  const enabled = options.enabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? 15_000;
  const [precedents, setPrecedents] = useState<PrecedentInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const loadingMoreRef = useRef(false);

  const performFetch = useCallback(async () => {
    if (!hasLoaded.current) {
      setLoading(true);
    }
    try {
      setError(null);
      const [count, page] = await Promise.all([
        contractService.getPrecedentCount(treasuryAddress),
        contractService.getPrecedents(treasuryAddress, 0, limit),
      ]);
      setTotalCount(count);
      setPrecedents((current) => mergePrecedentPages(current, page));
      hasLoaded.current = true;
    } catch (err: unknown) {
      if (!hasLoaded.current || !isTransientRpcError(err)) {
        setError(errorMessage(err, "Failed to load precedent log."));
      }
    } finally {
      setLoading(false);
    }
  }, [treasuryAddress]);
  const fetchPrecedents = useSingleFlight(performFetch);

  useCompletionPolling(fetchPrecedents, enabled, pollIntervalMs);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || precedents.length >= totalCount) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await contractService.getPrecedents(
        treasuryAddress,
        precedents.length,
        limit,
      );
      setPrecedents((current) => mergePrecedentPages(current, page));
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load more precedents."));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [precedents.length, totalCount, treasuryAddress]);

  return {
    precedents,
    totalCount,
    hasMore: precedents.length < totalCount,
    loadMore,
    loading,
    loadingMore,
    error,
    refetch: fetchPrecedents,
  };
}
