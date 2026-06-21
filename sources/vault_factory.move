/// Registry for community-created vault strategies.
///
/// The AI Vault Creator (frontend `/create-vault`) lets anyone configure
/// a PLP+Hedge-shaped strategy and register it here. Registration only
/// records the strategy parameters on-chain — it does NOT create a new
/// Vault<T> object or move funds. A registered config is a claim plus a
/// creator-fee right; the actual vault deployment and capital flows are
/// handled the same way as the V1 Strata-PH/Strata-RL vaults (operator-key
/// pattern, see CLAUDE.md). Bounds on each parameter exist purely to keep
/// registered strategies within a sane operating range for that future
/// deployment step.
module strata::vault_factory;

use std::string::{Self, String};
use sui::clock::Clock;
use sui::event;
use sui::table::{Self, Table};

// --- Errors ---

const E_INVALID_HEDGE_RATIO: u64 = 1;
const E_INVALID_STRIKE_OFFSET: u64 = 2;
const E_INVALID_DEPLOY_RATIO: u64 = 3;
const E_NAME_TOO_LONG: u64 = 4;

public struct VaultRegistry has key {
    id: UID,
    vault_count: u64,
    vaults: Table<u64, CommunityVaultConfig>,
}

public struct CommunityVaultConfig has store {
    vault_index: u64,
    name: String,
    description: String,
    creator: address,
    hedge_ratio_bps: u64,
    strike_offset_bps: u64,
    deploy_ratio_bps: u64,
    creator_fee_bps: u64,
    risk_level: u8,
    created_at_ms: u64,
}

// --- Events ---

public struct VaultRegistered has copy, drop {
    vault_index: u64,
    creator: address,
    name: String,
    hedge_ratio_bps: u64,
    strike_offset_bps: u64,
    deploy_ratio_bps: u64,
    risk_level: u8,
}

// --- Constructor ---

// Modules added via a package upgrade can't use an automatic `init` —
// Sui only invokes `init` on the original publish transaction, so the
// upgrade is rejected outright if one is present. Matches the existing
// strategy_plp_hedge/strategy_range_ladder pattern: a manual constructor
// the operator calls once, right after this upgrade lands.
public fun create_registry(ctx: &mut TxContext) {
    transfer::share_object(VaultRegistry {
        id: object::new(ctx),
        vault_count: 0,
        vaults: table::new(ctx),
    });
}

// --- Registration ---

public entry fun register_vault(
    registry: &mut VaultRegistry,
    name: vector<u8>,
    description: vector<u8>,
    hedge_ratio_bps: u64,
    strike_offset_bps: u64,
    deploy_ratio_bps: u64,
    risk_level: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(hedge_ratio_bps >= 500 && hedge_ratio_bps <= 3000, E_INVALID_HEDGE_RATIO);
    assert!(strike_offset_bps >= 100 && strike_offset_bps <= 1000, E_INVALID_STRIKE_OFFSET);
    assert!(deploy_ratio_bps >= 5000 && deploy_ratio_bps <= 9800, E_INVALID_DEPLOY_RATIO);
    assert!(vector::length(&name) <= 64, E_NAME_TOO_LONG);

    let index = registry.vault_count;
    let name_str = string::utf8(name);
    let description_str = string::utf8(description);

    event::emit(VaultRegistered {
        vault_index: index,
        creator: ctx.sender(),
        name: copy name_str,
        hedge_ratio_bps,
        strike_offset_bps,
        deploy_ratio_bps,
        risk_level,
    });

    table::add(&mut registry.vaults, index, CommunityVaultConfig {
        vault_index: index,
        name: name_str,
        description: description_str,
        creator: ctx.sender(),
        hedge_ratio_bps,
        strike_offset_bps,
        deploy_ratio_bps,
        creator_fee_bps: 10,
        risk_level,
        created_at_ms: clock.timestamp_ms(),
    });

    registry.vault_count = index + 1;
}

// --- View functions ---

public fun vault_count(registry: &VaultRegistry): u64 { registry.vault_count }
public fun get_vault(registry: &VaultRegistry, index: u64): &CommunityVaultConfig {
    table::borrow(&registry.vaults, index)
}
public fun config_name(c: &CommunityVaultConfig): &String { &c.name }
public fun config_description(c: &CommunityVaultConfig): &String { &c.description }
public fun config_creator(c: &CommunityVaultConfig): address { c.creator }
public fun config_hedge_ratio_bps(c: &CommunityVaultConfig): u64 { c.hedge_ratio_bps }
public fun config_strike_offset_bps(c: &CommunityVaultConfig): u64 { c.strike_offset_bps }
public fun config_risk_level(c: &CommunityVaultConfig): u8 { c.risk_level }
public fun config_creator_fee_bps(c: &CommunityVaultConfig): u64 { c.creator_fee_bps }
public fun config_created_at_ms(c: &CommunityVaultConfig): u64 { c.created_at_ms }
