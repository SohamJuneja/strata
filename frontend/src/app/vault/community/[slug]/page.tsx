import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import type { CommunityVaultEntry, RiskLevel } from "@/lib/vaultCreator";

const VAULTS_PATH = path.join(process.cwd(), "community-vaults.json");

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "text-positive border-positive",
  MEDIUM: "text-[#D9A441] border-[#D9A441]",
  HIGH: "text-negative border-negative",
};

async function getVault(slug: string): Promise<CommunityVaultEntry | null> {
  try {
    const raw = await fs.readFile(VAULTS_PATH, "utf-8");
    const vaults = JSON.parse(raw) as CommunityVaultEntry[];
    return vaults.find((v) => v.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export default async function CommunityVaultPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vault = await getVault(slug);

  if (!vault) {
    return (
      <>
        <Header />
        <main>
          <section className="py-32">
            <Container>
              <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Community Vault</p>
              <h1 className="font-display text-5xl text-ink">Vault not found</h1>
              <p className="mt-4 text-ink-secondary">
                This vault doesn&apos;t exist yet, or hasn&apos;t finished deploying.
              </p>
              <Link
                href="/create-vault"
                className="mt-8 inline-flex items-center bg-accent text-paper px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors"
              >
                Create one →
              </Link>
            </Container>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const shortAddr = `${vault.creatorAddress.slice(0, 6)}...${vault.creatorAddress.slice(-4)}`;

  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Vault / Community</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-6xl lg:text-7xl leading-tight tracking-tight text-ink">
                {vault.name}
              </h1>
              <span className="font-mono text-xs uppercase tracking-widest border border-accent text-accent px-3 py-1">
                Community Vault
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`font-mono text-xs uppercase tracking-widest border px-3 py-1 ${RISK_STYLES[vault.riskLevel]}`}>
                {vault.riskLevel} risk
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                Created by {shortAddr}
              </span>
            </div>
            <p className="mt-6 text-xl italic text-ink-secondary max-w-2xl">{vault.description}</p>
          </Container>
        </section>

        <section className="border-b border-border bg-paper-raised py-12">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Strategy Parameters</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <ParamStat label="Hedge ratio" value={`${vault.hedgeRatioBps / 100}%`} />
              <ParamStat label="Hedge strike offset" value={`${vault.strikeOffsetBps / 100}% OTM`} />
              <ParamStat label="Est. weekly yield" value={`${vault.estimatedWeeklyYieldPct}%`} />
              <ParamStat label="Creator fee" value={`${vault.creatorFeeBps / 100}%`} />
            </div>
          </Container>
        </section>

        <section className="py-16 lg:py-24">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
              <div className="lg:col-span-5">
                <div className="border border-border bg-paper p-8">
                  <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Deposit</p>
                  <div className="border border-dashed border-border bg-paper-sunken p-4 mb-4">
                    <p className="text-sm text-ink-secondary">
                      ⏳ This vault is pending on-chain deployment — deposits open soon.
                    </p>
                  </div>
                  <input
                    disabled
                    placeholder="0.00 dUSDC"
                    className="w-full bg-paper-sunken border border-border px-4 py-3 text-ink-muted font-mono text-sm mb-4 cursor-not-allowed"
                  />
                  <button
                    disabled
                    className="w-full bg-paper-raised border border-border text-ink-muted px-6 py-3 font-mono text-sm uppercase tracking-widest cursor-not-allowed"
                  >
                    Deposit (coming soon)
                  </button>
                  <p className="mt-4 text-xs text-ink-muted">
                    {vault.creatorFeeBps / 100}% of deposits go to the vault creator.
                  </p>
                </div>
                <p className="mt-4 font-mono text-xs text-ink-muted break-all">Vault ID: {vault.vaultId}</p>
              </div>

              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">The Strategy</p>
                <h2 className="font-display text-4xl leading-tight tracking-tight text-ink mb-8">
                  AI-configured, <span className="italic text-accent">community-launched.</span>
                </h2>
                <div className="space-y-6 text-lg leading-relaxed text-ink-secondary">
                  <p>{vault.description}</p>
                  <p>
                    This vault routes {vault.deployRatioBps / 100}% of deposits to PLP supply on DeepBook Predict
                    and reserves the rest for OTM put hedges, struck {vault.strikeOffsetBps / 100}% out of the
                    money.
                  </p>
                </div>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ParamStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-3 font-mono text-2xl tabular-nums text-ink">{value}</p>
    </div>
  );
}
