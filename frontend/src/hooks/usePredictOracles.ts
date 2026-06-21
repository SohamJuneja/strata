"use client";
import { useState, useEffect } from "react";
import { PREDICT_SERVER_URL as PREDICT_SERVER } from "@/lib/constants";

interface OracleEntry {
  oracle_id: string;
  status: string;
  settlement_price: number;
  expiry: number;
  underlying_asset: string;
  settled_at: number;
}

export interface OracleFeedState {
  latestPrice: number | null;
  nextExpiry: number | null;
  recentPrices: number[];
  isLoading: boolean;
  error: string | null;
}

export function usePredictOracles(pollIntervalMs = 30_000): OracleFeedState {
  const [state, setState] = useState<OracleFeedState>({
    latestPrice: null,
    nextExpiry: null,
    recentPrices: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${PREDICT_SERVER}/oracles`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OracleEntry[];

        const settled = data
          .filter((o) => o.status === "settled")
          .sort((a, b) => b.settled_at - a.settled_at);

        const active = data
          .filter((o) => o.status === "active")
          .sort((a, b) => a.expiry - b.expiry);

        const latestPrice = settled[0] ? settled[0].settlement_price / 1e9 : null;
        const nextExpiry =
          active[0]
            ? active[0].expiry
            : settled[0]
            ? settled[0].expiry + 900_000
            : null;
        const recentPrices = settled.slice(0, 3).map((o) => o.settlement_price / 1e9);

        if (!cancelled) {
          setState({
            latestPrice,
            nextExpiry,
            recentPrices,
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : "Fetch failed",
          }));
        }
      }
    }

    load();
    const id = setInterval(load, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollIntervalMs]);

  return state;
}
