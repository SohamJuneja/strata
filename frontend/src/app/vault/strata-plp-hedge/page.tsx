import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { VaultNAVHero, PositionStateRow } from "@/components/vault/LiveStats";
import { DepositWithdrawCard } from "@/components/vault/DepositWithdrawCard";

export default function VaultDetailPage() {
  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Vault / V1</p>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              <div className="lg:col-span-7">
                <h1 className="font-display text-6xl lg:text-7xl leading-tight tracking-tight text-ink">STRATA-PH</h1>
                <p className="mt-4 text-xl text-ink-secondary">PLP+Hedge strategy on dUSDC. Live on Sui testnet.</p>
                <div className="mt-6 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-positive" />
                  <span className="font-mono text-xs uppercase tracking-widest text-positive">Open for deposits</span>
                </div>
              </div>
              <div className="lg:col-span-5 lg:text-right">
                <VaultNAVHero />
              </div>
            </div>
          </Container>
        </section>

        <section className="border-b border-border bg-paper-raised py-12">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Position State</p>
            <PositionStateRow />
          </Container>
        </section>

        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
              <div className="lg:col-span-5">
                <DepositWithdrawCard />
              </div>

              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">The Strategy</p>
                <h2 className="font-display text-4xl lg:text-5xl leading-tight tracking-tight text-ink mb-8">
                  Two legs. <span className="italic text-accent">Yield from one,</span> protection from the other.
                </h2>
                <div className="space-y-6 text-lg leading-relaxed text-ink-secondary">
                  <p>Strata-PH allocates your deposit across two complementary legs of DeepBook Predict.</p>
                  <p><span className="font-mono text-sm uppercase tracking-widest text-ink">Yield leg.</span> The vault supplies dUSDC to the Predict liquidity vault. In return it receives PLP, which earns a proportional claim on the protocol vault as binary options traders pay premiums.</p>
                  <p><span className="font-mono text-sm uppercase tracking-widest text-ink">Hedge leg.</span> A small fraction (10% by default) is used to buy out-of-the-money binary puts. These act as crash insurance. If BTC drops sharply, the hedge appreciates and offsets PLP drawdown.</p>
                  <p>The result is most of the PLP yield with a defined floor on the worst-case loss. The trade-off is a small drag during calm markets when the hedge expires worthless.</p>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section className="py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-8">Risk Profile</p>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-5">
                <h2 className="font-display text-4xl lg:text-5xl leading-tight tracking-tight text-ink">
                  What happens if BTC <span className="italic text-accent">moves?</span>
                </h2>
                <p className="mt-6 text-ink-secondary text-base">Indicative returns at expiry under different BTC price scenarios. Based on historical PLP yield and binary option payoffs. Actual results depend on oracle prices at each expiry.</p>
              </div>
              <div className="lg:col-span-7 space-y-4">
                <RiskRow label="BTC + 20%" value="+5.2%" tone="positive" note="Hedge expires worthless. Full PLP yield captured." />
                <RiskRow label="BTC unchanged" value="+4.8%" tone="positive" note="PLP yield collected. Hedge expires unused." />
                <RiskRow label="BTC - 10%" value="+2.1%" tone="positive" note="Mild drawdown. Hedge starts to kick in." />
                <RiskRow label="BTC - 20%" value="-3.4%" tone="negative" note="Hedge offsets significant PLP loss." />
                <RiskRow label="BTC - 30%" value="-8.0%" tone="negative" note="Worst case. Hedge floors the loss vs. ~ -18% unhedged." />
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function RiskRow({ label, value, tone, note }: { label: string; value: string; tone: "positive" | "negative"; note: string }) {
  const valueColor = tone === "positive" ? "text-positive" : "text-negative";
  return (
    <div className="grid grid-cols-12 gap-4 items-baseline border-b border-border pb-4">
      <div className="col-span-4 font-mono text-sm uppercase tracking-widest text-ink-secondary">{label}</div>
      <div className={`col-span-3 font-mono text-2xl tabular-nums ${valueColor}`}>{value}</div>
      <div className="col-span-5 font-mono text-xs text-ink-muted">{note}</div>
    </div>
  );
}