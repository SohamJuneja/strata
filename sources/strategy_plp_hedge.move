/// Strategy configuration for the Strata PLP+Hedge vault.
///
/// This module holds tunable parameters for the V1 strategy. It does
/// NOT contain on-chain orchestration logic. The keeper bot reads
/// this config to decide how to deploy and hedge each cycle, then
/// calls the vault primitives directly via Programmable Transaction
/// Blocks.
///
/// Putting orchestration off-chain lets us iterate on strike selection,
/// quantity math, and oracle choice without contract upgrades during
/// the build phase.
module strata::strategy_plp_hedge;

use sui::event;

/// Strategy parameters in basis points (1 bps = 0.01%).
///
/// hedge_ratio_bps: fraction of NAV the keeper targets for hedge
///   exposure. Initial default 1000 (10%).
///
/// hedge_strike_offset_bps: how far out of the money the hedge strike
///   sits relative to current spot. Initial default 500 (5% OTM).
public struct StrategyConfig has key {
    id: UID,
    /// The vault this config governs. Off-chain readers pair them.
    vault_id: ID,
    /// Address authorized to update the config (matches vault operator).
    operator: address,
    hedge_ratio_bps: u64,
    hedge_strike_offset_bps: u64,
}

// --- Events ---

public struct StrategyConfigCreated has copy, drop {
    config_id: ID,
    vault_id: ID,
    operator: address,
    hedge_ratio_bps: u64,
    hedge_strike_offset_bps: u64,
}

public struct HedgeRatioUpdated has copy, drop {
    config_id: ID,
    old_bps: u64,
    new_bps: u64,
}

public struct StrikeOffsetUpdated has copy, drop {
    config_id: ID,
    old_bps: u64,
    new_bps: u64,
}

// --- Errors ---

const E_NOT_OPERATOR: u64 = 0;
const E_BPS_OUT_OF_RANGE: u64 = 1;

const MAX_HEDGE_RATIO_BPS: u64 = 5000; // hard cap at 50% in hedges
const MAX_STRIKE_OFFSET_BPS: u64 = 5000; // hard cap at 50% OTM

// --- Constructor ---

/// Create a strategy config bound to a vault. Initial defaults:
/// 10% hedge ratio, 5% strike OTM.
public fun create_config(
    vault_id: ID,
    operator: address,
    ctx: &mut TxContext,
) {
    let config = StrategyConfig {
        id: object::new(ctx),
        vault_id,
        operator,
        hedge_ratio_bps: 1000,
        hedge_strike_offset_bps: 500,
    };
    let config_id = object::id(&config);

    event::emit(StrategyConfigCreated {
        config_id,
        vault_id,
        operator,
        hedge_ratio_bps: 1000,
        hedge_strike_offset_bps: 500,
    });

    transfer::share_object(config);
}

// --- Operator-only updates ---

public fun set_hedge_ratio(config: &mut StrategyConfig, new_bps: u64, ctx: &TxContext) {
    assert!(ctx.sender() == config.operator, E_NOT_OPERATOR);
    assert!(new_bps <= MAX_HEDGE_RATIO_BPS, E_BPS_OUT_OF_RANGE);

    let old_bps = config.hedge_ratio_bps;
    config.hedge_ratio_bps = new_bps;

    event::emit(HedgeRatioUpdated {
        config_id: object::id(config),
        old_bps,
        new_bps,
    });
}

public fun set_hedge_strike_offset(
    config: &mut StrategyConfig,
    new_bps: u64,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == config.operator, E_NOT_OPERATOR);
    assert!(new_bps <= MAX_STRIKE_OFFSET_BPS, E_BPS_OUT_OF_RANGE);

    let old_bps = config.hedge_strike_offset_bps;
    config.hedge_strike_offset_bps = new_bps;

    event::emit(StrikeOffsetUpdated {
        config_id: object::id(config),
        old_bps,
        new_bps,
    });
}

// --- View functions ---

public fun vault_id(config: &StrategyConfig): ID { config.vault_id }
public fun operator(config: &StrategyConfig): address { config.operator }
public fun hedge_ratio_bps(config: &StrategyConfig): u64 { config.hedge_ratio_bps }
public fun hedge_strike_offset_bps(config: &StrategyConfig): u64 { config.hedge_strike_offset_bps }