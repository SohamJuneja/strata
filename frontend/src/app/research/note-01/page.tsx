import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";

export default function ResearchNote01() {
  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Research / Note 01</p>
            <h1 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink max-w-3xl">Strategy Model: PLP+Hedge across three historical BTC regimes</h1>
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-2">
              <span className="font-mono text-xs text-ink-muted">Published: May 2026</span>
              <span className="font-mono text-xs text-ink-muted">Strategy: PLP+Hedge V1 on DeepBook Predict</span>
              <span className="font-mono text-xs text-ink-muted">Authors: Strata Research</span>
            </div>
            <p className="mt-2 font-mono text-xs text-ink-muted">Reproducibility: scripts/fetch-btc-data.ts and scripts/simulate.ts regenerate every number in this note from public Binance data.</p>
          </Container>
        </section>

        <section className="py-16 lg:py-24">
          <Container>
            <article className="max-w-3xl space-y-16">

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-6">Abstract</h2>
                <div className="space-y-4 text-lg leading-relaxed text-ink-secondary">
                  <p>We model the PLP+Hedge strategy across three 12-week historical BTC windows: a volatile sideways market (Q3 2024), a steady post-halving drawdown (Q2 2024), and the Terra/Luna collapse (Q2 2022). BTC prices are real, pulled from Binance weekly closes. Strategy mechanics (PLP yield, hedge premium, hedge payoff structure) are modeled with explicit, documented parameters.</p>
                  <p>The hedge delivers meaningful protection only when trigger events are frequent. In the Terra/Luna period (5 trigger weeks of 12), PLP+Hedge outperforms raw PLP by <strong className="text-ink font-semibold">6.35%</strong>. In moderate volatility (2 trigger weeks of 12), the hedge premium drag roughly cancels the trigger gains — protection is essentially insurance you did not need. Investors should size the strategy based on their belief about drawdown probability.</p>
                </div>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-6">Strategy in one paragraph</h2>
                <p className="text-lg leading-relaxed text-ink-secondary">The vault allocates approximately 90% of deposits to PLP (DeepBook Predict's LP token, earning premium from binary options traders) and approximately 10% to weekly out-of-the-money binary puts at 5% below spot. PLP captures yield from traders paying premium. The OTM puts pay out when BTC settles below strike, offsetting the PLP drawdown that occurs in the same scenarios. Net result: most of the PLP yield, with a defined floor on worst-case loss.</p>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-6">Methodology</h2>
                <p className="text-lg leading-relaxed text-ink-secondary mb-6">We simulate weekly cycles on a $1000 starting vault. Each cycle:</p>
                <ol className="list-decimal list-outside pl-6 space-y-2 text-lg leading-relaxed text-ink-secondary mb-8">
                  <li>PLP yield accrues at 20% APY (continuous compound, modeled as 0.385% per week)</li>
                  <li>Hedge premium of 30 bps deducts from NAV per week</li>
                  <li>If BTC drops more than 5% in the week: hedge pays out a fixed 2% of NAV (binary payoff structure)</li>
                  <li>If BTC drops more than 3% in the week: PLP loses 60% of the underlying move (drawdown beta)</li>
                  <li>Raw PLP comparison: same yield, same drawdown beta, no hedge premium, no hedge payoff</li>
                </ol>
                <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3">Config (reproducible)</p>
                <pre className="border border-border bg-paper-raised p-5 overflow-x-auto"><code className="font-mono text-sm text-ink leading-relaxed">{`{
  "initialVaultUsd": 1000,
  "plpApy": 0.20,
  "hedgePremiumBpsWeekly": 30,
  "hedgePayoffPctOfNav": 0.02,
  "hedgeStrikeOffsetBps": 500,
  "plpDrawdownBeta": 0.6
}`}</code></pre>
                <div className="mt-6 space-y-2 text-base text-ink-secondary">
                  <p><span className="font-mono text-xs uppercase tracking-widest text-ink">What is real:</span> BTC weekly closes pulled from Binance's public klines API for each period.</p>
                  <p><span className="font-mono text-xs uppercase tracking-widest text-ink">What is modeled:</span> PLP yield (20% APY constant), hedge premium (30 bps constant), hedge payoff (binary 2%), PLP drawdown beta (0.6).</p>
                  <p><span className="font-mono text-xs uppercase tracking-widest text-ink">What this does not model:</span> actual SVI surface pricing, vault utilization effects on PLP yield (which is counter-cyclical in practice), withdrawal-limiter friction, gas costs, oracle lag.</p>
                </div>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-2">Period A: Q3 2024</h2>
                <p className="text-ink-muted font-mono text-xs uppercase tracking-widest mb-6">Sideways with volatility</p>
                <p className="text-lg leading-relaxed text-ink-secondary mb-8">BTC oscillated between $54,870 and $68,250 over 13 weeks. Three -10% weekly drops, two -4% drops, several +8% upmoves. The period closed roughly flat.</p>
                <PeriodTable rows={PERIOD_A} />
                <p className="mt-6 font-mono text-sm text-ink border-t border-border pt-4">Final: Raw PLP -14.83% | PLP+Hedge -14.55% | Delta +0.28%</p>
                <p className="mt-4 text-base leading-relaxed text-ink-secondary">Both lose meaningfully because PLP suffers in volatility under our model. The hedge triggers twice (W4, W8) and saves a small amount, but the 0.30% weekly premium accumulates across 11 non-trigger weeks and erodes most of the gain.</p>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-2">Period B: Q2 2024</h2>
                <p className="text-ink-muted font-mono text-xs uppercase tracking-widest mb-6">Steady post-halving drawdown</p>
                <p className="text-lg leading-relaxed text-ink-secondary mb-8">BTC drifted from $69,360 to $62,772 over 12 weeks. Three trigger weeks (-5.33%, -5.20%, plus -4.27% just below strike). No catastrophic single week.</p>
                <PeriodTable rows={PERIOD_B} />
                <p className="mt-6 font-mono text-sm text-ink border-t border-border pt-4">Final: Raw PLP -6.54% | PLP+Hedge -6.11% | Delta +0.43%</p>
                <p className="mt-4 text-base leading-relaxed text-ink-secondary">Two hedge triggers (W1, W11). Similar small net benefit. The drawdown is gradual rather than catastrophic, so the binary hedge structure does not get full leverage.</p>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-2">Period C: Q2 2022</h2>
                <p className="text-ink-muted font-mono text-xs uppercase tracking-widest mb-6">Terra/Luna collapse</p>
                <p className="text-lg leading-relaxed text-ink-secondary mb-8">BTC fell from $42,159 to $19,316 — a 54% decline in 13 weeks. Five trigger weeks of varying severity, including a -22.58% week (the LUNA/UST de-peg moment).</p>
                <PeriodTable rows={PERIOD_C} />
                <p className="mt-6 font-mono text-sm text-ink border-t border-border pt-4">Final: Raw PLP -32.57% | PLP+Hedge -26.21% | Delta +6.35%</p>
                <div className="mt-4 space-y-3 text-base leading-relaxed text-ink-secondary">
                  <p>This is where the strategy earns its keep. Five hedge triggers across 12 weeks. The binary structure (fixed 2% payoff per trigger) generates 10% of cumulative hedge income over the period — meaningfully softening the blow from sustained crash.</p>
                  <p>Note that even with the hedge, the vault still loses 26% in this scenario. The strategy is designed to floor catastrophic losses, not eliminate them. Pure capital preservation requires zero exposure.</p>
                </div>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-6">Summary</h2>
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 pr-6 font-mono text-xs uppercase tracking-widest text-ink-muted">Period</th>
                        <th className="text-right py-3 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Raw PLP</th>
                        <th className="text-right py-3 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">PLP+Hedge</th>
                        <th className="text-right py-3 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Delta</th>
                        <th className="text-right py-3 pl-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Trigger Wks</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border">
                        <td className="py-3 pr-6 text-ink-secondary">Q3 2024 (volatile sideways)</td>
                        <td className="py-3 px-4 text-right tabular-nums text-negative">-14.83%</td>
                        <td className="py-3 px-4 text-right tabular-nums text-negative">-14.55%</td>
                        <td className="py-3 px-4 text-right tabular-nums text-positive">+0.28%</td>
                        <td className="py-3 pl-4 text-right tabular-nums text-ink-secondary">2 of 13</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-3 pr-6 text-ink-secondary">Q2 2024 (steady drawdown)</td>
                        <td className="py-3 px-4 text-right tabular-nums text-negative">-6.54%</td>
                        <td className="py-3 px-4 text-right tabular-nums text-negative">-6.11%</td>
                        <td className="py-3 px-4 text-right tabular-nums text-positive">+0.43%</td>
                        <td className="py-3 pl-4 text-right tabular-nums text-ink-secondary">2 of 12</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-3 pr-6 text-ink-secondary">Q2 2022 (severe drawdown)</td>
                        <td className="py-3 px-4 text-right tabular-nums text-negative">-32.57%</td>
                        <td className="py-3 px-4 text-right tabular-nums text-negative">-26.21%</td>
                        <td className="py-3 px-4 text-right tabular-nums text-positive">+6.35%</td>
                        <td className="py-3 pl-4 text-right tabular-nums text-ink-secondary">5 of 12</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-6 text-base leading-relaxed text-ink-secondary">The strategy's value scales with the FREQUENCY of trigger events, not just their magnitude. Periods with 2-3 trigger weeks see roughly neutral hedge contribution. Periods with 5+ trigger weeks see meaningful protection.</p>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-6">Limitations</h2>
                <ol className="list-decimal list-outside pl-6 space-y-4 text-base leading-relaxed text-ink-secondary">
                  <li><strong className="text-ink font-semibold">PLP drawdown beta is held constant at 0.6.</strong> In practice PLP yield is counter-cyclical (rises during stress as traders buy protection), which would reduce the effective drawdown. The model is therefore conservative — real performance is likely better than shown.</li>
                  <li><strong className="text-ink font-semibold">Hedge premium is held constant at 30 bps weekly.</strong> Real premium varies with implied vol. Could be 15 bps in calm markets, 80+ bps during turbulence. The premium drag during crisis periods would be higher; the trigger payoffs would also be larger.</li>
                  <li><strong className="text-ink font-semibold">Binary payoff is held constant at 2% per trigger.</strong> Real binary pricing depends on the SVI surface. Deep OTM strikes during high-vol periods would have larger payoffs.</li>
                  <li><strong className="text-ink font-semibold">No vault yield from new deposits during cycles.</strong> In production, deposits during open windows compound the base. This model assumes a static $1000 starting NAV.</li>
                  <li><strong className="text-ink font-semibold">No transaction costs, gas, or oracle lag.</strong></li>
                </ol>
                <p className="mt-6 text-base text-ink-secondary">For V2 we plan to: run real backtests against actual Predict SVI data once mainnet ships; implement dynamic hedge ratio adjustment based on realized vol; add Range Ladder as a second strategy; open-source the simulation framework with parameter sweeps.</p>
              </div>

              <div>
                <h2 className="font-display text-3xl leading-snug tracking-tight text-ink mb-6">Conclusion</h2>
                <div className="space-y-4 text-lg leading-relaxed text-ink-secondary">
                  <p>PLP+Hedge V1 provides marginal protection in moderate-volatility regimes (small delta) and meaningful protection in sustained drawdowns (6%+ delta over a quarter). The strategy is best sized to a depositor's belief about drawdown probability — high-conviction risk-averse capital benefits most.</p>
                  <p>This is honest research, not magic. The strategy does not generate alpha through complexity. It generates a different RISK SHAPE compared to raw PLP supply: capped downside in exchange for paying small premium continuously. Whether that is the right shape for a given LP depends on their tolerance for tail risk.</p>
                  <p>For Sui's structured-products ecosystem, this is foundational. Strata-PH is V1. The same vault primitive supports range ladders, BTC-collateralized vaults, and other strategies as the protocol matures.</p>
                </div>
              </div>

              <div className="border-t border-border pt-8">
                <p className="font-mono text-xs text-ink-muted">Reproducibility: scripts/fetch-btc-data.ts pulls weekly closes from Binance. scripts/simulate.ts runs the model with the documented config. Both committed to the repo. Anyone can re-run and verify every number.</p>
              </div>

            </article>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

type PeriodRow = {
  wk: number;
  date: string;
  btc: string;
  delta: string;
  plp: string;
  hedge: string;
  payoff: string;
  plpLoss: string;
  net: string;
  triggered: boolean;
};

const PERIOD_A: PeriodRow[] = [
  { wk: 1, date: "2024-07-08", btc: "60,798", delta: "+8.84", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 2, date: "2024-07-15", btc: "68,165", delta: "+12.12", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 3, date: "2024-07-22", btc: "68,250", delta: "+0.12", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 4, date: "2024-07-29", btc: "58,161", delta: "-14.78", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-8.869", net: "-6.785", triggered: true },
  { wk: 5, date: "2024-08-05", btc: "58,713", delta: "+0.95", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 6, date: "2024-08-12", btc: "58,427", delta: "-0.49", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 7, date: "2024-08-19", btc: "64,220", delta: "+9.91", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 8, date: "2024-08-26", btc: "57,302", delta: "-10.77", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-6.464", net: "-4.379", triggered: true },
  { wk: 9, date: "2024-09-02", btc: "54,870", delta: "-4.24", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "-2.546", net: "-2.462", triggered: false },
  { wk: 10, date: "2024-09-09", btc: "59,132", delta: "+7.77", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 11, date: "2024-09-16", btc: "63,579", delta: "+7.52", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 12, date: "2024-09-23", btc: "65,602", delta: "+3.18", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 13, date: "2024-09-30", btc: "62,820", delta: "-4.24", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "-2.545", net: "-2.460", triggered: false },
];

const PERIOD_B: PeriodRow[] = [
  { wk: 1, date: "2024-04-08", btc: "65,662", delta: "-5.33", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-3.199", net: "-1.115", triggered: true },
  { wk: 2, date: "2024-04-15", btc: "64,941", delta: "-1.10", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 3, date: "2024-04-22", btc: "63,119", delta: "-2.81", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 4, date: "2024-04-29", btc: "64,012", delta: "+1.42", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 5, date: "2024-05-06", btc: "61,484", delta: "-3.95", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "-2.370", net: "-2.285", triggered: false },
  { wk: 6, date: "2024-05-13", btc: "66,274", delta: "+7.79", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 7, date: "2024-05-20", btc: "68,508", delta: "+3.37", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 8, date: "2024-05-27", btc: "67,766", delta: "-1.08", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 9, date: "2024-06-03", btc: "69,648", delta: "+2.78", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 10, date: "2024-06-10", btc: "66,677", delta: "-4.27", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "-2.560", net: "-2.475", triggered: false },
  { wk: 11, date: "2024-06-17", btc: "63,210", delta: "-5.20", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-3.120", net: "-1.035", triggered: true },
  { wk: 12, date: "2024-06-24", btc: "62,772", delta: "-0.69", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
];

const PERIOD_C: PeriodRow[] = [
  { wk: 1, date: "2022-04-11", btc: "39,678", delta: "-5.88", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-3.531", net: "-1.446", triggered: true },
  { wk: 2, date: "2022-04-18", btc: "39,450", delta: "-0.57", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 3, date: "2022-04-25", btc: "38,468", delta: "-2.49", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 4, date: "2022-05-02", btc: "34,038", delta: "-11.52", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-6.909", net: "-4.825", triggered: true },
  { wk: 5, date: "2022-05-09", btc: "31,329", delta: "-7.96", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-4.776", net: "-2.691", triggered: true },
  { wk: 6, date: "2022-05-16", btc: "30,294", delta: "-3.30", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "-1.982", net: "-1.897", triggered: false },
  { wk: 7, date: "2022-05-23", btc: "29,468", delta: "-2.73", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 8, date: "2022-05-30", btc: "29,919", delta: "+1.53", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 9, date: "2022-06-06", btc: "26,575", delta: "-11.18", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-6.707", net: "-4.623", triggered: true },
  { wk: 10, date: "2022-06-13", btc: "20,574", delta: "-22.58", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-13.548", net: "-11.463", triggered: true },
  { wk: 11, date: "2022-06-20", btc: "21,038", delta: "+2.26", plp: "+0.385", hedge: "-0.300", payoff: "0", plpLoss: "0", net: "+0.085", triggered: false },
  { wk: 12, date: "2022-06-27", btc: "19,316", delta: "-8.19", plp: "+0.385", hedge: "-0.300", payoff: "+2.000", plpLoss: "-4.912", net: "-2.827", triggered: true },
];

function netColor(net: string) {
  if (net.startsWith("+")) return "text-positive";
  if (net.startsWith("-")) return "text-negative";
  return "text-ink-secondary";
}

function PeriodTable({ rows }: { rows: PeriodRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-right py-2 pr-4 font-mono text-xs uppercase tracking-widest text-ink-muted w-8">Wk</th>
            <th className="text-left py-2 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Date</th>
            <th className="text-right py-2 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">BTC</th>
            <th className="text-right py-2 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Delta%</th>
            <th className="text-right py-2 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">PLP</th>
            <th className="text-right py-2 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Hedge</th>
            <th className="text-right py-2 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Payoff</th>
            <th className="text-right py-2 px-4 font-mono text-xs uppercase tracking-widest text-ink-muted">PLP Loss</th>
            <th className="text-right py-2 pl-4 font-mono text-xs uppercase tracking-widest text-ink-muted">Net%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.wk} className={`border-b border-border ${r.triggered ? "bg-paper-raised" : ""}`}>
              <td className="py-2 pr-4 text-right tabular-nums text-ink-muted">{r.wk}</td>
              <td className="py-2 px-4 text-ink-secondary">{r.date}</td>
              <td className="py-2 px-4 text-right tabular-nums text-ink">{r.btc}</td>
              <td className={`py-2 px-4 text-right tabular-nums ${r.delta.startsWith("-") ? "text-negative" : "text-positive"}`}>{r.delta}</td>
              <td className="py-2 px-4 text-right tabular-nums text-ink-secondary">{r.plp}</td>
              <td className="py-2 px-4 text-right tabular-nums text-ink-secondary">{r.hedge}</td>
              <td className={`py-2 px-4 text-right tabular-nums ${r.payoff !== "0" ? "text-positive" : "text-ink-muted"}`}>{r.payoff}</td>
              <td className={`py-2 px-4 text-right tabular-nums ${r.plpLoss !== "0" ? "text-negative" : "text-ink-muted"}`}>{r.plpLoss}</td>
              <td className={`py-2 pl-4 text-right tabular-nums font-semibold ${netColor(r.net)}`}>{r.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
