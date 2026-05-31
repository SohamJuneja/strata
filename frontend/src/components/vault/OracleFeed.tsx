"use client";
import { useState, useEffect } from "react";
import { usePredictOracles } from "@/hooks/usePredictOracles";

interface OracleFeedProps {
  className?: string;
}

function formatPrice(price: number): string {
  return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCountdown(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function OracleFeed({ className = "" }: OracleFeedProps) {
  const { latestPrice, nextExpiry, recentPrices, isLoading, error } = usePredictOracles(30_000);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (error && latestPrice === null) {
    return (
      <div className={`border border-border bg-paper-raised px-4 py-3 ${className}`}>
        <span className="font-mono text-xs text-ink-muted">Oracle feed unavailable</span>
      </div>
    );
  }

  const msLeft = nextExpiry !== null ? nextExpiry - now : null;
  const countdown =
    msLeft === null
      ? "--:--"
      : msLeft <= 0
      ? "Settling..."
      : formatCountdown(msLeft);

  return (
    <div className={`border border-border bg-paper-raised px-4 py-3 flex flex-wrap items-center gap-x-8 gap-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">BTC</span>
        <span className="font-mono text-sm tabular-nums text-accent">
          {isLoading && latestPrice === null ? "---" : latestPrice !== null ? formatPrice(latestPrice) : "---"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">Next expiry</span>
        <span className="font-mono text-sm tabular-nums text-ink">{countdown}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">Recent</span>
        <div className="flex items-center gap-1">
          {isLoading && recentPrices.length === 0
            ? ["---", "---", "---"].map((p, i) => (
                <span key={i} className="font-mono text-xs text-ink-muted px-1">{p}</span>
              ))
            : recentPrices.map((p, i) => (
                <span key={i} className="font-mono text-xs text-ink-muted px-1">{formatPrice(p)}</span>
              ))}
        </div>
      </div>
    </div>
  );
}
