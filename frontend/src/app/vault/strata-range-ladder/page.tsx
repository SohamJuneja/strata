import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { VaultNAVHero, PositionStateRowStrategyNeutral, CycleStatusBadge } from "@/components/vault/LiveStats";
import { OracleFeed } from "@/components/vault/OracleFeed";
import { DepositWithdrawCard } from "@/components/vault/DepositWithdrawCard";
import { SettleButton } from "@/components/vault/SettleButton";
import { RangeLadderMechanism } from "@/components/vault/RangeLadderMechanism";

export default function RangeLadderPage() {
  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Vault / V1</p>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              <div className="lg:col-span-7">
                <h1 className="font-display text-6xl lg:text-7xl leading-tight tracking-tight text-ink">STRATA-RL</h1>
                <span className="mt-3 inline-block font-mono text-xs uppercase tracking-widest border border-border px-3 py-1 text-ink-secondary">Strategy: Range Ladder</span>
                <p className="mt-4 text-xl text-ink-secondary">Range Ladder strategy on dUSDC. Live on Sui testnet.</p>
                <div className="mt-6 flex flex-wrap items-start gap-6">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-positive" />
                    <span className="font-mono text-xs uppercase tracking-widest text-positive">Open for deposits</span>
                  </div>
                  <CycleStatusBadge strategyLabel="Range Ladder" />
                </div>
              </div>
              <div className="lg:col-span-5 lg:text-right">
                <VaultNAVHero />
              </div>
            </div>
            <OracleFeed className="mt-8" />
          </Container>
        </section>

        <section className="border-b border-border bg-paper-raised py-12">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Position State</p>
            <PositionStateRowStrategyNeutral />
          </Container>
        </section>

        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
              <div className="lg:col-span-5">
                <DepositWithdrawCard />
                <SettleButton className="mb-8" />
              </div>

              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">The Strategy</p>
                <h2 className="font-display text-4xl lg:text-5xl leading-tight tracking-tight text-ink mb-8">Five bands. <span className="italic text-accent">One needs to settle.</span></h2>
                <div className="space-y-6 text-lg leading-relaxed text-ink-secondary">
                  <p>Strata-RL allocates deposits across a strip of vertical ranges around the current spot price. Each range pays $1 per unit if BTC settles within its band at expiry, $0 otherwise.</p>
                  <p><span className="font-mono text-sm uppercase tracking-widest text-ink">Direction-neutral.</span> The strategy bets that BTC will land somewhere in the ladder regardless of direction. Yield comes from at least one range paying out. A move up or down of equal magnitude inside the ladder produces the same positive result.</p>
                  <p><span className="font-mono text-sm uppercase tracking-widest text-ink">The trade-off.</span> Path dependence is the key risk. A sharp move that carries BTC outside all five rungs loses the entire premium. The strategy earns nothing if BTC gaps far in either direction.</p>
                  <p>At each expiry, the keeper rolls the ladder to the new at-the-money price, re-centering all five rungs automatically.</p>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">The Mechanism</p>
            <h2 className="font-display text-4xl lg:text-5xl leading-tight tracking-tight text-ink mb-4">Deposit split <span className="italic text-accent">across five rungs</span></h2>
            <p className="text-ink-secondary text-lg max-w-2xl mb-10">Animated trace of how a deposit fans out into five range positions. The in-the-money rung pays back at settlement; expired rungs return nothing.</p>
            <RangeLadderMechanism />
          </Container>
        </section>

        <section className="py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-8">Risk Profile</p>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-5">
                <h2 className="font-display text-4xl lg:text-5xl leading-tight tracking-tight text-ink">What if BTC <span className="italic text-accent">moves?</span></h2>
                <p className="mt-6 text-ink-secondary text-base">Indicative returns at expiry under different BTC price scenarios. Range Ladder payoffs are symmetric: BTC -5% produces the same result as BTC +5%. Actual results depend on oracle prices and rung sizing at each expiry.</p>
              </div>
              <div className="lg:col-span-7 space-y-4">
                <RiskRow label="BTC unchanged" value="+3.8%" tone="positive" note="ATM rung settles in band. Full ladder cost recovered." />
                <RiskRow label="BTC + 5%" value="+2.4%" tone="positive" note="Adjacent rung settles. Cheaper premium, same $1 payout." />
                <RiskRow label="BTC + 10%" value="+0.9%" tone="positive" note="Edge rung barely settles. Thin margin on the premium paid." />
                <RiskRow label="BTC + 20%" value="-4.5%" tone="negative" note="Outside all five rungs. Entire ladder premium lost." />
                <RiskRow label="BTC + 30%" value="-4.5%" tone="negative" note="Deep outside ladder. Loss capped at premium paid." />
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
