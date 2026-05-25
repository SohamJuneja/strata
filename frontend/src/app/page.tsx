import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { HomepageStatsRow } from "@/components/vault/LiveStats";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-24 lg:py-40">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-8">Structured Products</p>
                <h1 className="font-display text-6xl md:text-7xl lg:text-8xl leading-tight text-ink">
                  PLP yield, <span className="italic text-accent">with crash insurance.</span>
                </h1>
                <p className="mt-10 text-lg lg:text-xl leading-relaxed text-ink-secondary max-w-xl">
                  A volatility-selling vault on DeepBook Predict. Earn PLP yield from binary options traders. Hedge the left tail with the same options you are underwriting.
                </p>
                <div className="mt-12 flex flex-wrap gap-4">
                  <a href="/vault/strata-plp-hedge" className="inline-flex items-center bg-accent text-paper px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors">View the vault</a>
                  <a href="#thesis" className="inline-flex items-center border border-ink-secondary text-ink px-7 py-3.5 font-mono text-sm uppercase tracking-widest hover:bg-paper-raised transition-colors">Read the thesis</a>
                </div>
              </div>
              <div className="lg:col-span-5 lg:pt-16">
                <div className="border-l-2 border-accent pl-8">
                  <p className="font-display text-2xl md:text-3xl italic leading-relaxed text-ink">
                    Onchain options TVL is $100M across all of crypto. That is an empty market, not a competitive one.
                  </p>
                  <p className="mt-6 font-mono text-xs uppercase tracking-widest text-ink-muted">The opportunity</p>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section className="border-b border-border bg-paper-raised py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-8">The Vault</p>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              <div className="lg:col-span-5">
                <h2 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink">STRATA-PH</h2>
                <p className="mt-4 text-ink-secondary text-lg">PLP+Hedge strategy on dUSDC. Live on Sui testnet.</p>
              </div>
              <div className="lg:col-span-7">
                <HomepageStatsRow />
              </div>
            </div>
            <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-t border-border pt-8">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-positive" />
                <span className="font-mono text-xs uppercase tracking-widest text-ink-secondary">Open for deposits</span>
              </div>
              <a href="/vault/strata-plp-hedge" className="inline-flex items-center bg-accent text-paper px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors">Deposit dUSDC</a>
            </div>
          </Container>
        </section>

        <section id="thesis" className="py-24 lg:py-40">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-8">The Thesis</p>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
              <h2 className="lg:col-span-5 font-display text-4xl md:text-5xl lg:text-6xl leading-tight tracking-tight text-ink">
                Earn from <span className="italic text-accent">selling vol.</span> Floor your loss with <span className="italic text-accent">crash insurance.</span>
              </h2>
              <div className="lg:col-span-6 lg:col-start-7 space-y-6 text-base lg:text-lg leading-relaxed text-ink-secondary max-w-2xl">
                <p>Liquidity providers to DeepBook Predict earn yield from binary options traders. But raw PLP carries left-tail drawdown risk. If BTC drops 30% in a week, the binaries traders bought pay out heavily, and vault NAV suffers.</p>
                <p>Strata-PH solves this by writing the same out-of-the-money puts that LPs implicitly sell when they supply PLP, then buying back a small fraction of those puts as explicit insurance. The result is most of the PLP yield, with a defined floor on the worst-case loss.</p>
                <p>Shares are issued as standard Sui Coins, usable as collateral on DeepBook Margin. This composability, where vault, options, and borrowing stack atomically in a single Programmable Transaction Block, is structurally impossible on any other chain.</p>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-3 font-mono text-3xl lg:text-4xl tabular-nums text-ink">{value}</p>
    </div>
  );
}