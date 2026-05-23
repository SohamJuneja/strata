# Strata

Structured products vault built on DeepBook Predict. Sui Overflow 2026, DeepBook track ($35K).

## What we're building

Tokenized PLP+Hedge vault. User deposits dUSDC, vault routes ~90% to predict::supply for PLP yield and ~10% to predict::mint for out-of-the-money binary hedges (crash insurance). Depositors get vault share Sui objects representing a proportional NAV claim. Vault shares are designed to be usable as collateral on deepbook_margin (composability demo, the unique Sui story).

The pitch: "PLP yield minus crash insurance, with vault shares you can borrow against."

## Local references (read these before writing Predict-touching code)

- DeepBook Predict source: `~/projects/_refs/deepbookv3/packages/predict/`
  - On branch `predict-testnet-4-16` (NOT main)
  - Modules: predict.move, predict_manager.move, registry.move, oracle.move, oracle_config.move, plus subfolders config/, helper/, market_key/, vault/
- DeepBook sandbox (local stack): `~/projects/_refs/deepbook-sandbox/`
- Integration guide: `~/projects/_refs/deepbookv3/packages/predict/README.md`

## Current testnet deployment (use these exact IDs)

- Predict package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict shared object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- dUSDC type: `e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
- Public server: https://predict-server.testnet.mystenlabs.com
- dUSDC faucet form: https://tally.so/r/Xx102L

If you see other testnet IDs in old docs or examples, ignore them. The above are the current deployment.

## Predict model (essential facts)

- `Predict` is the top-level shared protocol object (one global instance)
- `PredictManager` is the per-account object. Our vault creates and owns ONE PredictManager. Users do NOT each get their own manager when going through Strata; they share the vault's.
- `OracleSVI` is per (underlying, expiry). Binary positions and ranges are keyed by (oracle_id, expiry, strike, ...).
- Positions and Ranges are NOT standalone objects. They are balances inside the PredictManager.
- `PLP` is the LP share token minted by predict::supply.

## Predict entry points we will call

All take generic `Quote` (we always use DUSDC):
- `predict::create_manager` returns a shared PredictManager
- `predict_manager::deposit` deposit quote into manager
- `predict::supply<Quote>` supply quote to vault, mint PLP, emits Supplied
- `predict::withdraw<Quote>` burn PLP, return quote, emits Withdrawn
- `predict::mint<Quote>` mint binary position into manager, emits PositionMinted
- `predict::redeem<Quote>` redeem position, emits PositionRedeemed
- `predict::redeem_permissionless<Quote>` redeem a SETTLED position permissionlessly (key for the keeper bot)
- `predict::mint_range<Quote>` mint vertical range
- `predict::redeem_range<Quote>` redeem range

## Planned Strata module structure

- `strata::vault` core vault state and accounting; owns the PredictManager
- `strata::vault_share` tokenized vault share Sui objects (one type per vault strategy)
- `strata::strategy_plp_hedge` PLP+Hedge strategy logic
- `strata::keeper` permissionless roll/redeem entrypoints
- `strata::config` vault configuration (hedge ratio, strike distance, rebalance policy)
- `strata::events` vault events for indexer
- `strata::errors` error codes

## Strategy parameters (initial defaults)

- `hedge_ratio_bps`: 1000 (10% of NAV in hedges)
- `hedge_strike_distance_bps`: 500 (hedge strike 5% out of the money)
- `min_deposit_dusdc`: 10_000_000 (10 dUSDC at 6 decimals, TBC)
- Rebalance: triggered on oracle settlement, called via keeper

## Critical gotchas

- Quote asset is dUSDC, NOT regular USDC.
- deepbookv3 must be referenced at branch `predict-testnet-4-16`. main does not contain Predict.
- Server is low-lag, not zero-lag. After a tx, refresh both on-chain reads and server endpoints.
- SVI updates are less frequent than price updates. Don't assume they're in lockstep.
- Mainnet redeploy is expected day one when Predict ships to mainnet. Keep all addresses in `strata::config` so we can swap them for mainnet without a logic rewrite.
- Use @mysten/codegen for the TypeScript integration layer, not hand-rolled BCS parsing.

## Build commands

From `~/projects/strata/`:
- `sui move build` compile
- `sui move test` run all unit tests
- `sui client publish --gas-budget 200000000` publish

## Where to ask for help

- DeepBook builder Telegram: https://go.sui.io/ofw-deepbook-tg
- Mentor contact: J (Telegram chat already open)