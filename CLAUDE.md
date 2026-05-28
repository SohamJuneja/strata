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

### Strata testnet deployment

Bootstrap complete — fully live on testnet.

**Core**
- Strata Package (logical / original publish): `0x27466001865a80e5733ed4e16529375f063c602b6eb22b4ca86dda525797745a`
- Strata Package (current, after Range Ladder upgrade): `0xbfb9c946956d1843130a6cbae0475648e57bda3fb644d281c6d89b468437cba1`
- ShareTreasury (shared): `0xcbfcbda351fc696469532fb7590fc489fce6ece091a38e1f449180168c70e75d`
- VAULT_SHARE Currency object: `0x75628d2a40d0d44299eca9eea56e0f7bfe311da1683c9be20bae8b9d8072d2e2`

**Vault instance (V1 PLP+Hedge on dUSDC)**
- Vault<DUSDC> (shared): `0xaa1abbf4bc1328c41f1ce635cc4d974889bb90989244c248c40bb80f33a9206e`
- PredictManager (shared, owned by operator): `0x99b20ae30ba4bdc19e8e0d7d54d8ce84e55452dbd6ae046d10b1f062b80cec07`
- BalanceManager (inside PredictManager): `0x2390c219002889b6737be67cc9fadc885cdd412141a9d6b8c1e5f6348c01217f`
- StrategyConfig (shared, defaults: 1000 bps hedge ratio, 500 bps strike offset): `0xc6b1a0fd5d8ae153ab3099a7ba95dbc940edb2ff3f938c6748e27be8157e3172`
- StrategyRangeConfig (shared, defaults: 1000 bps ladder width, 5 rungs): `0x9745e85c0930a6d0c06bc9dbbf1fa9b498a28015426d3aa5796ad91f2ba9425f`

**Capabilities (held by operator)**
- MetadataCap: `0x3b612088a16ad07c655390c4379229a70c3cd4b9977ab61153a7213f14d18f39`
- UpgradeCap: `0xf486b33b08fb12b5876d91cd0315e02d862b66087531f0382d374aaeab2a1177`

**Operator address**: `0x18a1b106192a3fed987dd1b58ab5ce3de052a06234ee21afa830eccd793928d7`

Modules at current package: strategy_plp_hedge, strategy_range_ladder, vault, vault_share.

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

## Architecture decisions (V1)

### Operator-key pattern for strategy moves

PredictManager has a strict `ctx.sender() == owner` check on deposit, withdraw, and mint. This means a smart contract cannot act on behalf of a PredictManager. Our V1 workaround:

- The Vault struct has an explicit `operator: address` field, set at `create_vault` time.
- The PredictManager owned by that operator is linked to the vault via `setup_predict_manager`.
- All strategy moves (`deploy_to_predict`, `buy_hedge`, `roll`) require `ctx.sender() == vault.operator`.
- Users freely deposit and withdraw vault shares — no operator gate on user-facing flows.

Trust assumption: operator key compromise = vault drain. For V2 we target Sui multi-sig or threshold signing for the operator role. Feedback for the DeepBook team about a transferable OperatorCap pattern has been raised.

### Epoch deposit windows for share pricing correctness

Predict doesn't expose `vault_value()` or PLP total supply on its shared object, so external vaults can't compute PLP-to-quote value externally. We can't do continuous Yearn-style NAV pricing.

V1 workaround: epoch deposit windows. Vault has a `deposit_window_open` boolean. When true, deposits and withdrawals are accepted and the vault is 100% cash (cash-based NAV is exact). Before deploying capital, the operator closes the window. After redeeming back to cash, the operator reopens.

This is the Ribbon v1 pattern. Trade-off: deposits can only happen during quiet periods between cycles, not continuously. V2 either gets continuous deposits via Predict exposing the pricing accessors (raised with DeepBook team), or moves to an epoch-with-queue model where late deposits queue for the next window.

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