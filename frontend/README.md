# Strata

**The structured products vault layer for DeepBook Predict on Sui.**

Strata is two volatility strategies on one vault primitive, deployed live on Sui testnet. PLP+Hedge captures DeepBook Predict's LP yield while floor-capping crash risk. Range Ladder bets that BTC settles somewhere across five ATM strike bands. Both share one on-chain Vault<DUSDC>; the operator picks which strategy to run each cycle.

Built for [Sui Overflow 2026](https://overflow.sui.io/), DeepBook track.

## Why this exists

Onchain options TVL across all of crypto sits around $100M. That's not a competitive market, it's an empty one. DeepBook Predict launched on Sui testnet in May 2026 with sub-hour binary options priced from a live SVI surface. The protocol exposes structural primitives (vol-surface-priced binaries, composable LP token, programmable margin) that didn't exist on any chain before.

We're building the structured products layer that turns those primitives into products LPs actually want to hold. Same pattern Ribbon Finance pioneered on Ethereum, with one critical difference: on Sui our vault shares are first-class `Coin<VAULT_SHARE>` objects, usable as collateral on `deepbook_margin` inside a single Programmable Transaction Block. That composability is structurally impossible on Ethereum.

## Architecture
strata/
├── sources/                          # Move smart contracts
│   ├── vault_share.move              # Tokenized vault shares (Coin<VAULT_SHARE>)
│   ├── vault.move                    # Core vault + strategy primitives
│   ├── strategy_plp_hedge.move       # PLP+Hedge config (90% PLP, 10% OTM puts)
│   └── strategy_range_ladder.move    # Range Ladder config (5 rungs around ATM)
├── tests/                            # Move unit tests (18 passing)
├── docs/research/                    # Research notes
│   └── note-01-backtesting-plp-hedge.md
├── scripts/                          # Simulation and tooling
│   ├── fetch-btc-data.ts             # Pulls real BTC weekly closes from Binance
│   └── simulate.ts                   # Runs strategy model against real data
├── data/                             # Cached BTC historical data
└── frontend/                         # Next.js 16 editorial dApp
└── src/app/
├── page.tsx                  # Homepage with both vaults
├── vault/strata-plp-hedge/   # PLP+Hedge product page
├── vault/strata-range-ladder/# Range Ladder product page
├── operator/                 # Operator strategy controls (CLI-equivalent)
└── research/note-01/         # Research note rendered editorially

## Live on Sui testnet

| Component | Address |
|---|---|
| Strata Package (current) | `0xbfb9c946956d1843130a6cbae0475648e57bda3fb644d281c6d89b468437cba1` |
| Strata Package (original publish) | `0x27466001865a80e5733ed4e16529375f063c602b6eb22b4ca86dda525797745a` |
| Vault<DUSDC> | `0xaa1abbf4bc1328c41f1ce635cc4d974889bb90989244c248c40bb80f33a9206e` |
| ShareTreasury | `0xcbfcbda351fc696469532fb7590fc489fce6ece091a38e1f449180168c70e75d` |
| StrategyConfig (PLP+Hedge) | `0xc6b1a0fd5d8ae153ab3099a7ba95dbc940edb2ff3f938c6748e27be8157e3172` |
| StrategyRangeConfig | `0x9745e85c0930a6d0c06bc9dbbf1fa9b498a28015426d3aa5796ad91f2ba9425f` |
| PredictManager | `0x99b20ae30ba4bdc19e8e0d7d54d8ce84e55452dbd6ae046d10b1f062b80cec07` |

Browse on a testnet explorer or interact via the frontend.

## Proven on testnet

We have shipped, not stubbed. Real testnet activity:

- 1+ real `vault::deposit` calls with dUSDC, vault NAV updated, shares minted
- `vault::deploy_to_predict` called against the real DeepBook Predict shared object, supplying 50 dUSDC and receiving 49.95 PLP back
- `vault::close_deposit_window` and `vault::open_deposit_window` controlling user access during strategy cycles
- StrategyConfig and StrategyRangeConfig parameter updates by operator

Every transaction is publicly viewable on a Sui testnet explorer.

## Strategies

### STRATA-PH (PLP+Hedge)

Allocates ~90% of vault to `predict::supply` for PLP yield. Uses ~10% for OTM binary puts that pay out if BTC drops more than 5%. The result is most of the PLP yield with a defined floor on the worst-case loss.

See `sources/strategy_plp_hedge.move`. Default config: 1000 bps hedge ratio, 500 bps strike offset.

### STRATA-RL (Range Ladder)

Allocates across five vertical ranges centered on current BTC spot. At expiry, the rung BTC settles within pays $1 per unit. Direction-neutral by design.

See `sources/strategy_range_ladder.move`. Default config: 1000 bps ladder width, 5 rungs.

## Running locally

Requirements: Node 18+, sui CLI (via suiup), WSL2 if on Windows.

```bash
# Clone and install
git clone https://github.com/<repo>/strata && cd strata
cd frontend && npm install && cd ..

# Move tests
sui move build
sui move test

# Simulation against real BTC data
npx tsx scripts/fetch-btc-data.ts
npx tsx scripts/simulate.ts

# Frontend
cd frontend && npm run dev
# Open http://localhost:3000
```

## Research

`docs/research/note-01-backtesting-plp-hedge.md` models PLP+Hedge across three real historical BTC windows (Q3 2024 sideways, Q2 2024 post-halving drift, Q2 2022 Terra/Luna collapse). Real BTC closes from Binance. Strategy mechanics documented as parameters in `scripts/simulate.ts`. Reproducible end-to-end.

## V1 limitations (honest)

- **Operator key controls strategy moves.** DeepBook Predict's `PredictManager` is owner-gated, requiring a hot operator key. V2 targets multi-sig or threshold signing. Feedback raised with DeepBook team.
- **NAV uses epoch deposit windows.** Predict doesn't expose `vault_value` or PLP total supply on its shared object, so we cannot continuously price PLP externally. Deposits/withdrawals require the operator to open the window when the vault is 100% cash. Feedback raised.
- **Hedge `RangeKey` and `MarketKey` discovery is manual.** Production needs predict-server integration for automatic strike selection. V2.
- **Single vault primitive per quote asset.** Multiple strategies share one `Vault<DUSDC>`. The active strategy is whichever the operator most recently deployed.

## Architecture decisions

Detailed in `CLAUDE.md`. Key calls:

- One vault primitive, multiple strategy modules (vs. separate vault contracts per strategy)
- Vault shares as standard `Coin<VAULT_SHARE>` for `deepbook_margin` composability
- Off-chain strategy orchestration via PTBs (vs. on-chain strategy engines)
- Epoch deposit windows (vs. continuous NAV pricing — blocked by Predict accessor gap)
- Operator-key trust model for V1 (multi-sig planned for V2)

## What's next

- Three-Protocol Margin Loop demo: vault share -> `deepbook_margin` collateral -> `iron_bank` USDsui borrow -> redeploy. The flagship composability story.
- Keeper bot: Node.js daemon that auto-redeems settled positions and rolls strategies.
- Mainnet redeploy when DeepBook Predict ships to mainnet.

## Acknowledgements

DeepBook team (especially Tony) for direct office hours guidance. Mysten Labs for the Sui stack. Built in public, ~30 days, with AI pair programming.

## License

MIT.