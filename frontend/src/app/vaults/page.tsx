"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import type { CommunityVaultSummary } from "@/lib/communityVaults";
import type { RiskLevel } from "@/lib/vaultCreator";

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "text-positive border-positive",
  MEDIUM: "text-[#D9A441] border-[#D9A441]",
  HIGH: "text-negative border-negative",
};

export default function CommunityVaultsPage() {
  const [vaults, setVaults] = useState<CommunityVaultSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/community-vaults");
        const data = (await res.json()) as { vaults: CommunityVaultSummary[]; error?: string };
        if (!cancelled) {
          setVaults(data.vaults);
          setError(data.error ?? null);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load community vaults");
          setIsLoading(false);
        }
      }
    }

    load();
  }, []);

  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Community</p>
            <h1 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink max-w-3xl">
              Vaults built by the community
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-secondary max-w-2xl">
              Every strategy here was configured with AI and registered on-chain via{" "}
              <span className="font-mono text-ink">strata::vault_factory::register_vault</span>. Anyone can launch
              one and earn 0.10% of its deposits.
            </p>
            <Link
              href="/create-vault"
              className="mt-8 inline-flex items-center bg-accent text-paper px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors"
            >
              Create a Vault →
            </Link>
          </Container>
        </section>

        <section className="py-16 lg:py-24">
          <Container>
            {isLoading && <p className="font-mono text-sm text-ink-muted">Loading community vaults…</p>}

            {error && <p className="font-mono text-sm text-negative mb-6">{error}</p>}

            {!isLoading && vaults.length === 0 && !error && (
              <p className="font-mono text-sm text-ink-muted">
                No community vaults registered yet. Be the first — <Link href="/create-vault" className="text-accent underline">create one</Link>.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vaults.map((v) => (
                <VaultCard key={v.vaultIndex} vault={v} />
              ))}
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function VaultCard({ vault }: { vault: CommunityVaultSummary }) {
  const shortAddr = `${vault.creatorAddress.slice(0, 6)}...${vault.creatorAddress.slice(-4)}`;

  return (
    <Link
      href={`/vault/community/${vault.vaultIndex}`}
      className="block border border-border bg-paper p-6 hover:border-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl leading-tight tracking-tight text-ink">{vault.name}</h2>
        <span
          className={`shrink-0 font-mono text-xs uppercase tracking-widest border px-2 py-0.5 ${RISK_STYLES[vault.riskLevel]}`}
        >
          {vault.riskLevel}
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
        <Stat label="Hedge ratio" value={`${vault.hedgeRatioBps / 100}%`} />
        <Stat label="Strike offset" value={`${vault.strikeOffsetBps / 100}% OTM`} />
        <Stat label="Deploy to PLP" value={`${vault.deployRatioBps / 100}%`} />
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <span className="font-mono text-xs text-ink-muted">by {shortAddr}</span>
        <span className="font-mono text-xs text-accent">View →</span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}
