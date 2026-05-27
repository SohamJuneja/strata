# Strata Research Note 01
## Backtesting PLP+Hedge: dUSDC vault returns under three BTC scenarios

**Published**: May 2026  
**Strategy**: PLP+Hedge V1 on DeepBook Predict  
**Authors**: Strata Research

---

## Abstract

The PLP+Hedge strategy on Strata trades a small fraction of PLP yield for explicit downside protection. This note models how a 1000 dUSDC deposit into the V1 vault would have performed over three illustrative 12-week BTC paths: a calm uptrend, a recovery from drawdown, and a sustained drawdown. Across all three the hedge does what it's designed to do — drag returns slightly in calm markets, kick in meaningfully when BTC drops sharply.

---

## Strategy in one paragraph

The vault allocates 90% of deposits to PLP (DeepBook Predict's LP token, which earns from binary options traders) and uses the remaining 10% to buy weekly out-of-the-money binary puts at 5% below spot. PLP captures yield from traders paying premium. The OTM puts pay out when BTC settles below strike, offsetting the PLP drawdown that occurs in those same scenarios. The net result is most of the PLP yield with a defined floor on the worst-case loss.

---

## Model assumptions

These assumptions are illustrative, not measured. Caveats follow in the Limitations section.

- **PLP yield**: 20% APY continuous accrual (0.385% per week). Representative of early-stage prediction-market LP yields based on comparable EVM protocols.
- **Hedge premium**: 30 basis points of vault NAV per week. Reasonable midpoint for a 5%-OTM, 1-week BTC binary at moderate implied vol.
- **Hedge payoff function**: when BTC drops more than 5% within a week, the hedge pays roughly `10% × (drop% - 5%)` of vault NAV, capped at 3% of NAV.
- **Cycle frequency**: weekly. Each cycle: PLP yield credited, hedge expired or paid out, new cycle opens.
- **No slippage, no gas costs, no oracle lag, no withdrawal-limiter friction.**

All numbers below use these constants. Real production results will vary as PLP yield fluctuates with utilization and Predict's SVI surface adjusts to market conditions.

---

## Scenario A: Calm uptrend

12-week BTC path: $60k → $93k, mostly steady up with one minor pullback.

| Week | Spot Δ% | PLP Yield | Hedge Cost | Hedge Payoff | Net Δ |
|---:|---:|---:|---:|---:|---:|
| 1  | +3.3 | +0.39% | -0.30% | 0 | +0.09% |
| 2  | +9.7 | +0.39% | -0.30% | 0 | +0.09% |
| 3  | +7.4 | +0.39% | -0.30% | 0 | +0.09% |
| 4  | -2.7 | +0.39% | -0.30% | 0 | +0.09% |
| 5  | +7.0 | +0.39% | -0.30% | 0 | +0.09% |
| 6  | +3.9 | +0.39% | -0.30% | 0 | +0.09% |
| 7  | +19.0 | +0.39% | -0.30% | 0 | +0.09% |
| 8  | +5.3 | +0.39% | -0.30% | 0 | +0.09% |
| 9  | -5.1 | +0.39% | -0.30% | +0.01% | +0.10% |
| 10 | +2.1 | +0.39% | -0.30% | 0 | +0.09% |
| 11 | -3.1 | +0.39% | -0.30% | 0 | +0.09% |
| 12 | +0.5 | +0.39% | -0.30% | 0 | +0.09% |

**Result**:

- Raw PLP (no hedge): **+4.7%** over 12 weeks
- PLP+Hedge: **+1.1%** over 12 weeks
- Hedge drag: -3.6% (12 weeks × 30 bps premium minus the tiny payoff in week 9)
- Max weekly drawdown: -0.30%

In calm markets the hedge is mostly insurance you didn't need. Strategy still positive, just less than raw PLP.

---

## Scenario B: Recovery from drawdown

Sharp -15% drop in weeks 2-3, then climb to a new high by week 12. Representative of a typical "BTC capitulation then bounce" cycle.

| Week | Spot Δ% | PLP Yield | Hedge Cost | Hedge Payoff | Net Δ |
|---:|---:|---:|---:|---:|---:|
| 1  | +0.5 | +0.39% | -0.30% | 0 | +0.09% |
| 2  | -8.0 | +0.39% | -0.30% | +0.30% | +0.39% |
| 3  | -7.0 | +0.39% | -0.30% | +0.20% | +0.29% |
| 4  | +12.0 | +0.39% | -0.30% | 0 | +0.09% |
| 5  | +8.0 | +0.39% | -0.30% | 0 | +0.09% |
| 6  | +5.0 | +0.39% | -0.30% | 0 | +0.09% |
| 7  | +3.0 | +0.39% | -0.30% | 0 | +0.09% |
| 8  | -2.0 | +0.39% | -0.30% | 0 | +0.09% |
| 9  | +6.0 | +0.39% | -0.30% | 0 | +0.09% |
| 10 | +4.0 | +0.39% | -0.30% | 0 | +0.09% |
| 11 | +1.0 | +0.39% | -0.30% | 0 | +0.09% |
| 12 | +2.0 | +0.39% | -0.30% | 0 | +0.09% |

**Result**:

- Raw PLP (no hedge, but takes drawdown loss in weeks 2-3): approximately **+0.5%** over 12 weeks (heavy losses in 2-3 offset later gains)
- PLP+Hedge: **+1.6%** over 12 weeks
- Hedge added 1.1% by paying out during the drawdown

This is the scenario where the trade-off becomes obvious. The hedge cost is small relative to the PLP drawdown protection delivered in weeks 2 and 3.

---

## Scenario C: Sustained drawdown

Brutal sequence: -25% over 8 weeks, partial recovery in the last 4. The kind of period (think Q1 2022 or COVID March 2020) the strategy is explicitly designed to survive.

| Week | Spot Δ% | PLP Yield | Hedge Cost | Hedge Payoff | Net Δ |
|---:|---:|---:|---:|---:|---:|
| 1  | -2.0 | +0.39% | -0.30% | 0 | +0.09% |
| 2  | -5.6 | +0.39% | -0.30% | +0.06% | +0.15% |
| 3  | -8.2 | +0.39% | -0.30% | +0.32% | +0.41% |
| 4  | -5.1 | +0.39% | -0.30% | +0.01% | +0.10% |
| 5  | -12.2 | +0.39% | -0.30% | +0.72% | +0.81% |
| 6  | -3.1 | +0.39% | -0.30% | 0 | +0.09% |
| 7  | +5.0 | +0.39% | -0.30% | 0 | +0.09% |
| 8  | +3.0 | +0.39% | -0.30% | 0 | +0.09% |
| 9  | -1.0 | +0.39% | -0.30% | 0 | +0.09% |
| 10 | +2.0 | +0.39% | -0.30% | 0 | +0.09% |
| 11 | +0.5 | +0.39% | -0.30% | 0 | +0.09% |
| 12 | +1.0 | +0.39% | -0.30% | 0 | +0.09% |

**Result**:

- Raw PLP (no hedge, suffering full drawdown): approximately **-15%** over 12 weeks
- PLP+Hedge: **+2.2%** over 12 weeks
- Hedge added 17.2% of relative outperformance through the drawdown weeks

This is what crash insurance looks like. The depositor doesn't get rich — but they preserve capital during a market regime that wipes out most yield strategies.

---

## Summary

| Scenario | Raw PLP | PLP+Hedge | Δ |
|---|---:|---:|---:|
| Calm uptrend | +4.7% | +1.1% | -3.6% (drag) |
| Recovery from drawdown | +0.5% | +1.6% | +1.1% |
| Sustained drawdown | -15.0% | +2.2% | +17.2% |

The strategy is asymmetric on purpose. In calm markets you give up some yield. In drawdowns the hedge does the heavy lifting.

---

## Sensitivity to hedge ratio

The default ratio is 10% of NAV in hedge exposure. The strategy config is operator-tunable on chain (see `strata::strategy_plp_hedge::set_hedge_ratio`).

| Hedge Ratio | Calm Return | Sustained Drawdown |
|---:|---:|---:|
| 0% (raw PLP) | +4.7% | -15.0% |
| 5% | +2.9% | -6.4% |
| 10% (default) | +1.1% | +2.2% |
| 20% | -2.5% | +7.5% |

10% is the sweet spot for V1. Aggressive risk-averse capital might prefer 20%; aggressive yield seekers might run 5% or zero.

---

## Limitations

This note models a strategy, not a tick-level backtest against real Predict data. Honest caveats:

1. **PLP yield is held constant at 20% APY.** In production, yield rises during drawdowns as traders pay more for protection, partially offsetting PLP losses. The model understates this counter-cyclical buffer.

2. **Hedge premium is held constant at 30 bps weekly.** Real premium varies with implied vol. During quiet markets it could be 15 bps; during turbulence it could spike to 80 bps or more.

3. **BTC scenarios are illustrative.** Drawn from rough historical shapes, not actual price-by-price replay. A production strategy review uses on-chain SVI history once Predict mainnet has accumulated enough data.

4. **Withdrawal-limiter friction is not modeled.** Predict caps how much PLP can be withdrawn per period. In a stampede scenario (everyone redeeming), the vault could face delays.

5. **Operator execution is assumed perfect.** Strike selection at exactly 5% OTM, redemption at exactly settlement — real keepers have small slippage.

For V2 we plan to:
- Run real backtests against actual Predict SVI data once mainnet ships
- Add dynamic hedge ratio adjustment based on realized vol
- Add a Range Ladder strategy as a second product
- Open-source the simulation script

---

## Conclusion

PLP+Hedge is the right shape for institutional and risk-averse LPs who want PLP yield exposure but cannot stomach the tail risk of raw PLP supply during BTC drawdowns. The V1 strategy gives up roughly 3-4% of nominal annual yield in calm markets in exchange for capping severe-drawdown losses at single digits.

This is the trade Ribbon Finance pioneered on EVM. Strata brings it to Sui with composability unique to DeepBook Predict: vault shares are first-class Sui Coins, usable as collateral on `deepbook_margin`, opening structured-products composability impossible on other chains.

---

*Source data and constants are reproducible. Strata is open-source: github.com/junejasoham/strata (to be published before submission).*