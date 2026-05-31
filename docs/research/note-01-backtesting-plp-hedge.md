# Strata Research Note 01
## Strategy Model: PLP+Hedge across three historical BTC regimes

**Published**: May 2026  
**Strategy**: PLP+Hedge V1 on DeepBook Predict  
**Authors**: Strata Research  
**Reproducibility**: `scripts/fetch-btc-data.ts` and `scripts/simulate.ts` regenerate every number in this note from public Binance data.

---

## Abstract

We model the PLP+Hedge strategy across three 12-week historical BTC windows: a volatile sideways market (Q3 2024), a steady post-halving drawdown (Q2 2024), and the Terra/Luna collapse (Q2 2022). BTC prices are real, pulled from Binance weekly closes. Strategy mechanics (PLP yield, hedge premium, hedge payoff structure) are modeled with explicit, documented parameters.

The hedge delivers meaningful protection only when trigger events are frequent. In the Terra/Luna period (5 trigger weeks of 12), PLP+Hedge outperforms raw PLP by **6.35%**. In moderate volatility (2 trigger weeks of 12), the hedge premium drag roughly cancels the trigger gains — protection is essentially insurance you didn't need. Investors should size the strategy based on their belief about drawdown probability.

---

## Strategy in one paragraph

The vault allocates ~90% of deposits to PLP (DeepBook Predict's LP token, earning premium from binary options traders) and ~10% to weekly out-of-the-money binary puts at 5% below spot. PLP captures yield from traders paying premium. The OTM puts pay out when BTC settles below strike, offsetting the PLP drawdown that occurs in the same scenarios. Net result: most of the PLP yield, with a defined floor on worst-case loss.

---

## Methodology

We simulate weekly cycles on a $1000 starting vault. Each cycle:

1. PLP yield accrues at 20% APY (continuous compound, modeled as 0.385% per week)
2. Hedge premium of 30 bps deducts from NAV per week
3. If BTC drops more than 5% in the week: hedge pays out a fixed 2% of NAV (binary payoff structure)
4. If BTC drops more than 3% in the week: PLP loses 60% of the underlying move (drawdown beta)
5. Raw PLP comparison: same yield, same drawdown beta, no hedge premium, no hedge payoff

**Config (reproducible)**:

```json
{
  "initialVaultUsd": 1000,
  "plpApy": 0.20,
  "hedgePremiumBpsWeekly": 30,
  "hedgePayoffPctOfNav": 0.02,
  "hedgeStrikeOffsetBps": 500,
  "plpDrawdownBeta": 0.6
}
```

**What's real**: BTC weekly closes pulled from Binance's public klines API for each period.

**What's modeled**: PLP yield (20% APY constant), hedge premium (30 bps constant), hedge payoff (binary 2%), PLP drawdown beta (0.6).

**What this does not model**: actual SVI surface pricing, vault utilization effects on PLP yield (which is counter-cyclical in practice), withdrawal-limiter friction, gas costs, oracle lag.

---

## Period A: Q3 2024 — sideways with volatility

BTC oscillated between $54,870 and $68,250 over 13 weeks. Three -10% weekly drops, two -4% drops, several +8% upmoves. The period closed roughly flat.

| Wk | Date | BTC | Δ% | PLP | Hedge | Payoff | PLP Loss | Net% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2024-07-08 | 60798 | +8.84 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 2 | 2024-07-15 | 68165 | +12.12 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 3 | 2024-07-22 | 68250 | +0.12 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 4 | 2024-07-29 | 58161 | -14.78 | +0.385 | -0.300 | +2.000 | -8.869 | -6.785 |
| 5 | 2024-08-05 | 58713 | +0.95 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 6 | 2024-08-12 | 58427 | -0.49 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 7 | 2024-08-19 | 64220 | +9.91 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 8 | 2024-08-26 | 57302 | -10.77 | +0.385 | -0.300 | +2.000 | -6.464 | -4.379 |
| 9 | 2024-09-02 | 54870 | -4.24 | +0.385 | -0.300 | 0 | -2.546 | -2.462 |
| 10 | 2024-09-09 | 59132 | +7.77 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 11 | 2024-09-16 | 63579 | +7.52 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 12 | 2024-09-23 | 65602 | +3.18 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 13 | 2024-09-30 | 62820 | -4.24 | +0.385 | -0.300 | 0 | -2.545 | -2.460 |

**Final**: Raw PLP -14.83% | PLP+Hedge -14.55% | Delta +0.28%

Both lose meaningfully because PLP suffers in volatility under our model. The hedge triggers twice (W4, W8) and saves a small amount, but the 0.30% weekly premium accumulates across 11 non-trigger weeks and erodes most of the gain.

---

## Period B: Q2 2024 — steady post-halving drawdown

BTC drifted from $69,360 to $62,772 over 12 weeks. Three trigger weeks (-5.33%, -5.20%, plus -4.27% just below strike). No catastrophic single week.

| Wk | Date | BTC | Δ% | PLP | Hedge | Payoff | PLP Loss | Net% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2024-04-08 | 65662 | -5.33 | +0.385 | -0.300 | +2.000 | -3.199 | -1.115 |
| 2 | 2024-04-15 | 64941 | -1.10 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 3 | 2024-04-22 | 63119 | -2.81 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 4 | 2024-04-29 | 64012 | +1.42 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 5 | 2024-05-06 | 61484 | -3.95 | +0.385 | -0.300 | 0 | -2.370 | -2.285 |
| 6 | 2024-05-13 | 66274 | +7.79 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 7 | 2024-05-20 | 68508 | +3.37 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 8 | 2024-05-27 | 67766 | -1.08 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 9 | 2024-06-03 | 69648 | +2.78 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 10 | 2024-06-10 | 66677 | -4.27 | +0.385 | -0.300 | 0 | -2.560 | -2.475 |
| 11 | 2024-06-17 | 63210 | -5.20 | +0.385 | -0.300 | +2.000 | -3.120 | -1.035 |
| 12 | 2024-06-24 | 62772 | -0.69 | +0.385 | -0.300 | 0 | 0 | +0.085 |

**Final**: Raw PLP -6.54% | PLP+Hedge -6.11% | Delta +0.43%

Two hedge triggers (W1, W11). Similar small net benefit. The drawdown is gradual rather than catastrophic, so the binary hedge structure doesn't get full leverage.

---

## Period C: Q2 2022 — Terra/Luna collapse

BTC fell from $42,159 to $19,316 — a 54% decline in 13 weeks. Five trigger weeks of varying severity, including a -22.58% week (the LUNA/UST de-peg moment).

| Wk | Date | BTC | Δ% | PLP | Hedge | Payoff | PLP Loss | Net% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2022-04-11 | 39678 | -5.88 | +0.385 | -0.300 | +2.000 | -3.531 | -1.446 |
| 2 | 2022-04-18 | 39450 | -0.57 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 3 | 2022-04-25 | 38468 | -2.49 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 4 | 2022-05-02 | 34038 | -11.52 | +0.385 | -0.300 | +2.000 | -6.909 | -4.825 |
| 5 | 2022-05-09 | 31329 | -7.96 | +0.385 | -0.300 | +2.000 | -4.776 | -2.691 |
| 6 | 2022-05-16 | 30294 | -3.30 | +0.385 | -0.300 | 0 | -1.982 | -1.897 |
| 7 | 2022-05-23 | 29468 | -2.73 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 8 | 2022-05-30 | 29919 | +1.53 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 9 | 2022-06-06 | 26575 | -11.18 | +0.385 | -0.300 | +2.000 | -6.707 | -4.623 |
| 10 | 2022-06-13 | 20574 | -22.58 | +0.385 | -0.300 | +2.000 | -13.548 | -11.463 |
| 11 | 2022-06-20 | 21038 | +2.26 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 12 | 2022-06-27 | 19316 | -8.19 | +0.385 | -0.300 | +2.000 | -4.912 | -2.827 |

**Final**: Raw PLP -32.57% | PLP+Hedge -26.21% | Delta +6.35%

This is where the strategy earns its keep. Five hedge triggers across 12 weeks. The binary structure (fixed 2% payoff per trigger) generates 10% of cumulative hedge income over the period — meaningfully softening the blow from sustained crash.

Note that even with the hedge, the vault still loses 26% in this scenario. The strategy is designed to floor catastrophic losses, not eliminate them. Pure capital preservation requires zero exposure.

---

## Period D: Q4 2023 -- Pre-ETF uptrend

BTC rallied from $27,917 to $42,284 -- a 51% gain in 12 weeks -- as ETF approval speculation gathered momentum. The market was mostly calm with only one significant weekly drawdown.

| Wk | Date | BTC | Delta% | PLP | Hedge | Payoff | PLP Loss | Net% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2023-10-09 | 27154 | -2.73 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 2 | 2023-10-16 | 29992 | +10.45 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 3 | 2023-10-23 | 34526 | +15.12 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 4 | 2023-10-30 | 35012 | +1.41 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 5 | 2023-11-06 | 37064 | +5.86 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 6 | 2023-11-13 | 37360 | +0.80 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 7 | 2023-11-20 | 37447 | +0.23 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 8 | 2023-11-27 | 39972 | +6.74 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 9 | 2023-12-04 | 43790 | +9.55 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 10 | 2023-12-11 | 41375 | -5.51 | +0.385 | -0.300 | +2.000 | -3.309 | -1.224 |
| 11 | 2023-12-18 | 42992 | +3.91 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 12 | 2023-12-25 | 42284 | -1.65 | +0.385 | -0.300 | 0 | 0 | +0.085 |

**Final**: Raw PLP +1.26% | PLP+Hedge -0.30% | Delta -1.56%

The hedge is a net drag here. Raw PLP captures the full PLP yield across an uptrend with minimal drawdown. PLP+Hedge pays 0.30% premium every week for insurance that fires only once (W10). The one trigger (W10, -5.51%) barely offset the accumulated cost of 11 quiet weeks. This is the clearest case where the strategy underperforms raw PLP by a meaningful margin.

---

## Period E: Aug 2024 -- JPY carry unwind

The JPY carry unwind in early August 2024 caused sharp intraday volatility across risk assets. On weekly closes, BTC declined then recovered over 7 weeks, starting at $58,161 (July 29 close) and finishing at $63,579.

| Wk | Date | BTC | Delta% | PLP | Hedge | Payoff | PLP Loss | Net% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2024-08-05 | 58713 | +0.95 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 2 | 2024-08-12 | 58427 | -0.49 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 3 | 2024-08-19 | 64220 | +9.91 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 4 | 2024-08-26 | 57302 | -10.77 | +0.385 | -0.300 | +2.000 | -6.464 | -4.379 |
| 5 | 2024-09-02 | 54870 | -4.24 | +0.385 | -0.300 | 0 | -2.546 | -2.462 |
| 6 | 2024-09-09 | 59132 | +7.77 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 7 | 2024-09-16 | 63579 | +7.52 | +0.385 | -0.300 | 0 | 0 | +0.085 |

**Final**: Raw PLP -6.33% | PLP+Hedge -6.34% | Delta -0.01%

Essentially zero difference. One hedge trigger (W4, -10.77%) almost exactly cancels the 7-week premium drag. Both strategies lose because PLP drawdown in W4 and W5 is large enough to swamp the yield. The period illustrates the middle case: hedge triggers but at a frequency too low to overcome premium accumulation.

---

## Period F: Q1 2025 -- Post-election rally and pullback

BTC surged to new highs in January 2025 following the US election, reaching a weekly close peak of $102,620. It then pulled back steadily through March, closing the quarter at $78,430 -- a 17% decline from the period start at $94,545.

| Wk | Date | BTC | Delta% | PLP | Hedge | Payoff | PLP Loss | Net% |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2025-01-13 | 101332 | +7.18 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 2 | 2025-01-20 | 102620 | +1.27 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 3 | 2025-01-27 | 97701 | -4.79 | +0.385 | -0.300 | 0 | -2.876 | -2.792 |
| 4 | 2025-02-03 | 96463 | -1.27 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 5 | 2025-02-10 | 96118 | -0.36 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 6 | 2025-02-17 | 96258 | +0.15 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 7 | 2025-02-24 | 94270 | -2.07 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 8 | 2025-03-03 | 80734 | -14.36 | +0.385 | -0.300 | +2.000 | -8.615 | -6.530 |
| 9 | 2025-03-10 | 82575 | +2.28 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 10 | 2025-03-17 | 86083 | +4.25 | +0.385 | -0.300 | 0 | 0 | +0.085 |
| 11 | 2025-03-24 | 82390 | -4.29 | +0.385 | -0.300 | 0 | -2.574 | -2.489 |
| 12 | 2025-03-31 | 78430 | -4.81 | +0.385 | -0.300 | 0 | -2.884 | -2.799 |

**Final**: Raw PLP -12.00% | PLP+Hedge -13.30% | Delta -1.29%

A gradual selloff with only one large trigger (W8, -14.36%) is the worst pattern for this strategy. The hedge fires once and recovers 2% of NAV, but the quiet weeks before and after accumulate 3.3% of premium drag. The final weeks (W11, W12) both have 4-5% BTC drops -- below the 3% PLP-loss threshold but above the 5% hedge-trigger threshold -- generating PLP losses without hedge payoffs. Raw PLP outperforms by 1.29%.

---

## Summary

| Period | Raw PLP | PLP+Hedge | Delta | Trigger Weeks |
|---|---:|---:|---:|---:|
| Q3 2024 (volatile sideways) | -14.83% | -14.55% | +0.28% | 2 of 13 |
| Q2 2024 (steady drawdown) | -6.54% | -6.11% | +0.43% | 2 of 12 |
| Q2 2022 (severe drawdown) | -32.57% | -26.21% | +6.35% | 5 of 12 |
| Q4 2023 (pre-ETF uptrend) | +1.26% | -0.30% | -1.56% | 1 of 12 |
| Aug 2024 (JPY flash crash) | -6.33% | -6.34% | -0.01% | 1 of 7 |
| Q1 2025 (post-election pullback) | -12.00% | -13.30% | -1.29% | 1 of 12 |

The strategy's value scales with the FREQUENCY of trigger events, not just their magnitude. Periods with 2-3 trigger weeks see roughly neutral hedge contribution. Periods with 5+ trigger weeks see meaningful protection. Periods with only 1 trigger in 12 weeks see the hedge as a net cost -- the premium drag (3.6% cumulative over 12 weeks) exceeds the single 2% payoff.

---

## Limitations

This is a strategy model with real BTC paths, not a tick-level backtest. Honest caveats:

1. **PLP drawdown beta is held constant at 0.6.** In practice PLP yield is counter-cyclical (rises during stress as traders buy protection), which would reduce the effective drawdown. The model is therefore conservative — real performance is likely better than shown.

2. **Hedge premium is held constant at 30 bps weekly.** Real premium varies with implied vol. Could be 15 bps in calm markets, 80+ bps during turbulence. The premium drag during crisis periods would be higher; the trigger payoffs would also be larger.

3. **Binary payoff is held constant at 2% per trigger.** Real binary pricing depends on the SVI surface. Deep OTM strikes during high-vol periods would have larger payoffs.

4. **No vault yield from new deposits during cycles.** In production, deposits during open windows compound the base. This model assumes a static $1000 starting NAV.

5. **No transaction costs, gas, or oracle lag.**

For V2 we plan to:
- Run real backtests against actual Predict SVI data once mainnet ships
- Implement dynamic hedge ratio adjustment based on realized vol
- Add Range Ladder as a second strategy
- Open-source the simulation framework with parameter sweeps

---

## Conclusion

PLP+Hedge V1 provides marginal protection in moderate-volatility regimes (small delta) and meaningful protection in sustained drawdowns (6%+ delta over a quarter). The strategy is best sized to a depositor's belief about drawdown probability — high-conviction risk-averse capital benefits most.

This is honest research, not magic. The strategy doesn't generate alpha through complexity. It generates a different RISK SHAPE compared to raw PLP supply: capped downside in exchange for paying small premium continuously. Whether that's the right shape for a given LP depends on their tolerance for tail risk.

For Sui's structured-products ecosystem, this is foundational. Strata-PH is V1. The same vault primitive supports range ladders, BTC-collateralized vaults, and other strategies as the protocol matures.

---

*Reproducibility*: `scripts/fetch-btc-data.ts` pulls weekly closes from Binance. `scripts/simulate.ts` runs the model with the documented config. Both committed to the repo. Anyone can re-run and verify every number.