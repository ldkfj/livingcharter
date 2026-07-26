import { useState, useEffect, useCallback } from "react";
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

export interface DashboardData {
  charterBundle: CharterBundle;
  charterCounts: CharterCounts;
  treasuryState: TreasuryState;
}

export function useDashboardData(charterAddress: string, treasuryAddress: string, pollIntervalMs = 15000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [charterBundle, charterCounts, treasuryState] = await Promise.all([
        contractService.getCharterBundle(charterAddress),
        contractService.getCharterCounts(charterAddress),
        contractService.getTreasuryState(treasuryAddress),
      ]);
      setData({ charterBundle, charterCounts, treasuryState });
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard data from GenLayer Studionet.");
    } finally {
      setLoading(false);
    }
  }, [charterAddress, treasuryAddress]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, pollIntervalMs]);

  return { data, loading, error, refetch: fetchData };
}

export function useRequests(treasuryAddress: string, pollIntervalMs = 15000) {
  const [requests, setRequests] = useState<RequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const count = await contractService.getRequestCount(treasuryAddress);
      if (count === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const reqPromises: Promise<RequestInfo>[] = [];
      for (let i = 1; i <= count; i++) {
        reqPromises.push(contractService.getRequest(treasuryAddress, i));
      }
      const results = await Promise.all(reqPromises);
      setRequests(results.reverse()); // Newest first
    } catch (err: any) {
      setError(err?.message || "Failed to load spend requests.");
    } finally {
      setLoading(false);
    }
  }, [treasuryAddress]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchRequests, pollIntervalMs]);

  return { requests, loading, error, refetch: fetchRequests };
}

export function useAmendments(charterAddress: string, pollIntervalMs = 15000) {
  const [amendments, setAmendments] = useState<AmendmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAmendments = useCallback(async () => {
    try {
      setError(null);
      const counts = await contractService.getCharterCounts(charterAddress);
      const count = counts.amendments;
      if (count === 0) {
        setAmendments([]);
        setLoading(false);
        return;
      }

      const promises: Promise<AmendmentInfo>[] = [];
      for (let i = 1; i <= count; i++) {
        promises.push(contractService.getAmendment(charterAddress, i));
      }
      const results = await Promise.all(promises);
      setAmendments(results.reverse());
    } catch (err: any) {
      setError(err?.message || "Failed to load amendments.");
    } finally {
      setLoading(false);
    }
  }, [charterAddress]);

  useEffect(() => {
    fetchAmendments();
    const interval = setInterval(fetchAmendments, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchAmendments, pollIntervalMs]);

  return { amendments, loading, error, refetch: fetchAmendments };
}

export function usePrecedents(treasuryAddress: string, pollIntervalMs = 15000) {
  const [precedents, setPrecedents] = useState<PrecedentInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrecedents = useCallback(async () => {
    try {
      setError(null);
      const [count, page] = await Promise.all([
        contractService.getPrecedentCount(treasuryAddress),
        contractService.getPrecedents(treasuryAddress, 0, limit),
      ]);
      setTotalCount(count);
      setPrecedents((current) => mergePrecedentPages(current, page));
    } catch (err: any) {
      setError(err?.message || "Failed to load precedent log.");
    } finally {
      setLoading(false);
    }
  }, [treasuryAddress]);

  useEffect(() => {
    fetchPrecedents();
    const interval = setInterval(fetchPrecedents, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchPrecedents, pollIntervalMs]);

  const loadMore = useCallback(async () => {
    if (loadingMore || precedents.length >= totalCount) {
      return;
    }

    setLoadingMore(true);
    setError(null);
    try {
      const page = await contractService.getPrecedents(
        treasuryAddress,
        precedents.length,
        limit,
      );
      setPrecedents((current) => mergePrecedentPages(current, page));
    } catch (err: any) {
      setError(err?.message || "Failed to load more precedents.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, precedents.length, totalCount, treasuryAddress]);

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
