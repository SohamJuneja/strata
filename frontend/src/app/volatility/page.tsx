"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";

interface SettlementPoint {
  oracleId: string;
  settledAt: string;
  price: number;
  expiryMs: number;
}

type HedgeAssessment = "CHEAP" | "FAIR" | "EXPENSIVE";

interface VolatilityResponse {
  settledCount: number;
  activeCount: number;
  settlementPrices: SettlementPoint[];
  realizedVol7d: number | null;
  realizedVol30d: number | null;
  currentAskPct: number | null;
  impliedVolEstimate: number | null;
  hedgeAssessment: HedgeAssessment;
  hedgeAssessmentReason: string;
}

const REFRESH_MS = 60_000;

function formatVol(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)}%`;
}

function formatPrice(v: number): string {
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatRelativeTime(iso: string, now: number): string {
  const deltaMs = now - new Date(iso).getTime();
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ASSESSMENT_STYLES: Record<HedgeAssessment, { bg: string; border: string; icon: string; headline: string }> = {
  CHEAP: {
    bg: "bg-positive/10",
    border: "border-positive",
    icon: "✅",
    headline: "Hedge premiums are cheap",
  },
  FAIR: {
    bg: "bg-paper-raised",
    border: "border-border",
    icon: "=",
    headline: "Hedge premiums are fairly priced",
  },
  EXPENSIVE: {
    bg: "bg-accent/10",
    border: "border-accent",
    icon: "⚠",
    headline: "Hedge premiums are elevated",
  },
};

const STRATA_IMPLICATION: Record<HedgeAssessment, string> = {
  CHEAP:
    "For Strata PLP+Hedge vault LPs, this means now is a good time to hold the vault — crash insurance is on sale relative to recent realized moves.",
  FAIR: "For Strata PLP+Hedge vault LPs, this means hedge cost is roughly in line with recent realized moves — no notable edge either way.",
  EXPENSIVE:
    "For Strata PLP+Hedge vault LPs, this means the hedge cost is elevated, reducing net yield relative to recent realized moves.",
};

export default function VolatilityPage() {
  const [data, setData] = useState<VolatilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/volatility");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as VolatilityResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const history = data
    ? [...data.settlementPrices].sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()).slice(0, 20)
    : [];

  const byOldestFirst = data ? [...data.settlementPrices].sort((a, b) => new Date(a.settledAt).getTime() - new Date(b.settledAt).getTime()) : [];

  function changeFor(point: SettlementPoint): number | null {
    const idx = byOldestFirst.findIndex((p) => p.oracleId === point.oracleId);
    if (idx <= 0) return null;
    const prev = byOldestFirst[idx - 1];
    return ((point.price - prev.price) / prev.price) * 100;
  }

  const assessment = data ? ASSESSMENT_STYLES[data.hedgeAssessment] : null;

  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Volatility</p>
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink">
                BTC Volatility Dashboard
              </h1>
              <span className="inline-flex items-center gap-2 border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink-secondary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-positive" />
                </span>
                Updates every 60s
              </span>
            </div>
            <p className="mt-4 text-lg text-ink-secondary max-w-2xl">
              Derived from DeepBook Predict oracle settlement history — the first on-chain vol benchmark on Sui.
            </p>
            {error && (
              <p className="mt-4 font-mono text-xs text-negative">Failed to load volatility data: {error}</p>
            )}
          </Container>
        </section>

        <section className="border-b border-border bg-paper-raised py-12">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <VolCard label="7-Day Realized Vol" value={formatVol(data?.realizedVol7d ?? null)} />
              <VolCard label="30-Day Realized Vol" value={formatVol(data?.realizedVol30d ?? null)} />
              <VolCard
                label="Implied Vol (est.)"
                value={formatVol(data?.impliedVolEstimate ?? null)}
                footnote="from current Predict ask pricing"
              />
            </div>
          </Container>
        </section>

        <section className="border-b border-border py-16">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Hedge Premium Assessment</p>
            {assessment && data && (
              <div className={`border ${assessment.border} ${assessment.bg} p-8`}>
                <p className="font-display text-3xl text-ink">
                  {assessment.icon} {assessment.headline}
                </p>
                <p className="mt-3 text-ink-secondary text-lg">{data.hedgeAssessmentReason}</p>
                <p className="mt-6 text-sm text-ink-secondary border-t border-border pt-6">
                  {STRATA_IMPLICATION[data.hedgeAssessment]}
                </p>
              </div>
            )}
          </Container>
        </section>

        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">
              Oracle Settlement History (last 20)
            </p>
            <div className="border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="font-mono text-xs uppercase tracking-widest text-ink-muted px-4 py-3">Time</th>
                    <th className="font-mono text-xs uppercase tracking-widest text-ink-muted px-4 py-3">BTC Price</th>
                    <th className="font-mono text-xs uppercase tracking-widest text-ink-muted px-4 py-3">Change</th>
                    <th className="font-mono text-xs uppercase tracking-widest text-ink-muted px-4 py-3">Oracle ID</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((point) => {
                    const change = changeFor(point);
                    return (
                      <tr key={point.oracleId} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3 font-mono text-xs text-ink-secondary">
                          {formatRelativeTime(point.settledAt, now)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm tabular-nums text-ink">{formatPrice(point.price)}</td>
                        <td className="px-4 py-3 font-mono text-sm tabular-nums">
                          {change === null ? (
                            <span className="text-ink-muted">—</span>
                          ) : change < 0 ? (
                            <span className="text-negative">▼ {Math.abs(change).toFixed(2)}%</span>
                          ) : (
                            <span className="text-positive">▲ {change.toFixed(2)}%</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <a
                            href={`https://suiscan.xyz/testnet/object/${point.oracleId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent-hover transition-colors"
                          >
                            {point.oracleId.slice(0, 8)}...
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center font-mono text-xs text-ink-muted">
                        {error ? "Unable to load settlement history." : "Loading…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Container>
        </section>

        <section className="py-16 lg:py-24">
          <Container>
            <details open className="border border-border bg-paper-raised p-8">
              <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-ink-muted">
                What is this?
              </summary>
              <p className="mt-6 text-lg leading-relaxed text-ink-secondary max-w-3xl">
                This dashboard computes realized volatility directly from DeepBook Predict&apos;s on-chain oracle
                settlement history — the sequence of BTC prices that have settled binary options on Sui testnet.
                Implied volatility is estimated from current option ask pricing. Together these form Sui&apos;s
                first on-chain volatility benchmark, readable by any protocol.
              </p>
            </details>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function VolCard({ label, value, footnote }: { label: string; value: string; footnote?: string }) {
  return (
    <div className="border border-border bg-paper p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-4 font-mono text-5xl tabular-nums text-ink">{value}</p>
      {footnote && <p className="mt-3 text-xs text-ink-muted">{footnote}</p>}
    </div>
  );
}
