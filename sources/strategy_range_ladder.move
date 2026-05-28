/// Strategy configuration for the Strata Range Ladder vault.
///
/// This module holds tunable parameters for the Range Ladder strategy.
/// It does NOT contain on-chain orchestration logic. The keeper bot reads
/// this config to decide how to lay down and roll a strip of vertical
/// ranges around the at-the-money strike at each new expiry, then calls
/// vault::mint_range_position and vault::redeem_range_position directly
/// via Programmable Transaction Blocks.
///
/// Putting orchestration off-chain lets us iterate on strike selection,
/// rung count, and oracle choice without contract upgrades during the
/// build phase.
module strata::strategy_range_ladder;

use sui::event;

/// Strategy parameters for a strip of vertical ranges around ATM.
///
/// ladder_width_bps: strike band width per rung in basis points
///   (1 bps = 0.01%). Initial default 1000 (10% of spot per rung).
///
/// num_rungs: number of range rungs deployed symmetrically around ATM.
///   Initial default 5.
public struct StrategyRangeConfig has key {
    id: UID,
    /// The vault this config governs. Off-chain readers pair them.
    vault_id: ID,
    /// Address authorized to update the config (matches vault operator).
    operator: address,
    ladder_width_bps: u64,
    num_rungs: u64,
}

// --- Events ---

public struct StrategyRangeConfigCreated has copy, drop {
    config_id: ID,
    vault_id: ID,
    operator: address,
    ladder_width_bps: u64,
    num_rungs: u64,
}

public struct LadderWidthUpdated has copy, drop {
    config_id: ID,
    old_bps: u64,
    new_bps: u64,
}

public struct NumRungsUpdated has copy, drop {
    config_id: ID,
    old_num: u64,
    new_num: u64,
}

// --- Errors ---

const E_NOT_OPERATOR: u64 = 0;
const E_BPS_OUT_OF_RANGE: u64 = 1;

const MIN_LADDER_WIDTH_BPS: u64 = 100;  // hard floor at 1%
const MAX_LADDER_WIDTH_BPS: u64 = 5000; // hard cap at 50%
const MIN_NUM_RUNGS: u64 = 1;
const MAX_NUM_RUNGS: u64 = 10;

// --- Constructor ---

/// Create a range ladder config bound to a vault. Initial defaults:
/// 10% width per rung, 5 rungs.
public fun create_range_config(
    vault_id: ID,
    operator: address,
    ctx: &mut TxContext,
) {
    let config = StrategyRangeConfig {
        id: object::new(ctx),
        vault_id,
        operator,
        ladder_width_bps: 1000,
        num_rungs: 5,
    };
    let config_id = object::id(&config);

    event::emit(StrategyRangeConfigCreated {
        config_id,
        vault_id,
        operator,
        ladder_width_bps: 1000,
        num_rungs: 5,
    });

    transfer::share_object(config);
}

// --- Operator-only updates ---

public fun set_ladder_width(config: &mut StrategyRangeConfig, new_bps: u64, ctx: &TxContext) {
    assert!(ctx.sender() == config.operator, E_NOT_OPERATOR);
    assert!(new_bps >= MIN_LADDER_WIDTH_BPS && new_bps <= MAX_LADDER_WIDTH_BPS, E_BPS_OUT_OF_RANGE);

    let old_bps = config.ladder_width_bps;
    config.ladder_width_bps = new_bps;

    event::emit(LadderWidthUpdated {
        config_id: object::id(config),
        old_bps,
        new_bps,
    });
}

public fun set_num_rungs(config: &mut StrategyRangeConfig, n: u64, ctx: &TxContext) {
    assert!(ctx.sender() == config.operator, E_NOT_OPERATOR);
    assert!(n >= MIN_NUM_RUNGS && n <= MAX_NUM_RUNGS, E_BPS_OUT_OF_RANGE);

    let old_num = config.num_rungs;
    config.num_rungs = n;

    event::emit(NumRungsUpdated {
        config_id: object::id(config),
        old_num,
        new_num: n,
    });
}

// --- View functions ---

public fun vault_id(config: &StrategyRangeConfig): ID { config.vault_id }
public fun operator(config: &StrategyRangeConfig): address { config.operator }
public fun ladder_width_bps(config: &StrategyRangeConfig): u64 { config.ladder_width_bps }
public fun num_rungs(config: &StrategyRangeConfig): u64 { config.num_rungs }
