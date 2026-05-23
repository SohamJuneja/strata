/// Core vault for Strata. Holds user-deposited quote asset, mints and
/// burns vault shares against current NAV, owns a PredictManager (via
/// the linked manager ID) for binary positions, and accumulates PLP
/// from the supply leg of the strategy.
///
/// User flows (deposit, withdraw) are unrestricted. Strategy flows
/// (deploy_to_predict, buy_hedge, roll) require ctx.sender() == operator.
/// See CLAUDE.md "Architecture decisions" for the V1 operator-key
/// rationale.
module strata::vault;

use std::option::{Self, Option};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;

use deepbook_predict::plp::PLP;
use deepbook_predict::predict::{Self, Predict};
use strata::vault_share::{Self, ShareTreasury, VAULT_SHARE};

/// Vault state. Generic over quote asset T. V1 runs a single dUSDC-typed
/// vault. Future strategies could instantiate vaults over BTC, SUI, etc.
public struct Vault<phantom T> has key {
    id: UID,
    /// Cash sitting in the vault, not yet deployed to the strategy.
    cash: Balance<T>,
    /// PLP minted by predict::supply. Each unit redeems for
    /// vault_value / plp_total_supply of quote (via predict::withdraw).
    plp_balance: Balance<PLP>,
    /// ID of the ShareTreasury this vault is paired with.
    share_treasury_id: ID,
    /// Address authorized to perform strategy moves.
    operator: address,
    /// PredictManager linked to this vault. None until
    /// setup_predict_manager is called.
    predict_manager_id: Option<ID>,
}

// --- Events ---

public struct Deposited has copy, drop {
    vault_id: ID,
    depositor: address,
    amount_in: u64,
    shares_minted: u64,
}

public struct Withdrawn has copy, drop {
    vault_id: ID,
    withdrawer: address,
    shares_burned: u64,
    amount_out: u64,
}

public struct PredictManagerLinked has copy, drop {
    vault_id: ID,
    manager_id: ID,
    operator: address,
}

public struct DeployedToPredict has copy, drop {
    vault_id: ID,
    operator: address,
    cash_in: u64,
    plp_minted: u64,
}

// --- Errors ---

const E_ZERO_AMOUNT: u64 = 0;
const E_WRONG_TREASURY: u64 = 1;
const E_INSUFFICIENT_LIQUIDITY: u64 = 2;
const E_NOT_OPERATOR: u64 = 3;
const E_MANAGER_ALREADY_SET: u64 = 4;

// --- Constructor ---

/// Create and share a new vault paired with the given ShareTreasury and
/// operator. The operator is responsible for setting up the PredictManager
/// and for all subsequent strategy moves.
public fun create_vault<T>(
    share_treasury: &ShareTreasury,
    operator: address,
    ctx: &mut TxContext,
) {
    let vault = Vault<T> {
        id: object::new(ctx),
        cash: balance::zero(),
        plp_balance: balance::zero(),
        share_treasury_id: object::id(share_treasury),
        operator,
        predict_manager_id: option::none(),
    };
    transfer::share_object(vault);
}

/// Create a PredictManager owned by the operator and link it to this
/// vault. Only callable by the operator. Can only succeed once.
public fun setup_predict_manager<T>(vault: &mut Vault<T>, ctx: &mut TxContext) {
    assert!(ctx.sender() == vault.operator, E_NOT_OPERATOR);
    assert!(option::is_none(&vault.predict_manager_id), E_MANAGER_ALREADY_SET);

    let manager_id = predict::create_manager(ctx);
    vault.predict_manager_id = option::some(manager_id);

    event::emit(PredictManagerLinked {
        vault_id: object::id(vault),
        manager_id,
        operator: vault.operator,
    });
}

// --- User flows (unrestricted) ---

/// Deposit quote asset into the vault and receive vault shares.
public fun deposit<T>(
    vault: &mut Vault<T>,
    share_treasury: &mut ShareTreasury,
    payment: Coin<T>,
    ctx: &mut TxContext,
): Coin<VAULT_SHARE> {
    assert!(object::id(share_treasury) == vault.share_treasury_id, E_WRONG_TREASURY);

    let amount_in = coin::value(&payment);
    assert!(amount_in > 0, E_ZERO_AMOUNT);

    let nav_before = balance::value(&vault.cash);
    let total_supply = vault_share::total_supply(share_treasury);

    let shares_to_mint = if (total_supply == 0 || nav_before == 0) {
        amount_in
    } else {
        (((amount_in as u128) * (total_supply as u128)) / (nav_before as u128)) as u64
    };

    balance::join(&mut vault.cash, coin::into_balance(payment));

    let shares = vault_share::mint(share_treasury, shares_to_mint, ctx);

    event::emit(Deposited {
        vault_id: object::id(vault),
        depositor: ctx.sender(),
        amount_in,
        shares_minted: shares_to_mint,
    });

    shares
}

/// Burn vault shares and receive proportional quote asset back.
public fun withdraw<T>(
    vault: &mut Vault<T>,
    share_treasury: &mut ShareTreasury,
    shares: Coin<VAULT_SHARE>,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(object::id(share_treasury) == vault.share_treasury_id, E_WRONG_TREASURY);

    let shares_amount = coin::value(&shares);
    assert!(shares_amount > 0, E_ZERO_AMOUNT);

    let nav_before = balance::value(&vault.cash);
    let total_supply = vault_share::total_supply(share_treasury);

    let amount_out =
        (((shares_amount as u128) * (nav_before as u128)) / (total_supply as u128)) as u64;
    assert!(amount_out > 0, E_ZERO_AMOUNT);
    assert!(balance::value(&vault.cash) >= amount_out, E_INSUFFICIENT_LIQUIDITY);

    vault_share::burn(share_treasury, shares);

    let out_balance = balance::split(&mut vault.cash, amount_out);
    let out_coin = coin::from_balance(out_balance, ctx);

    event::emit(Withdrawn {
        vault_id: object::id(vault),
        withdrawer: ctx.sender(),
        shares_burned: shares_amount,
        amount_out,
    });

    out_coin
}

// --- Strategy flows (operator-gated) ---

/// Move `amount` of cash from the vault into PLP via predict::supply.
/// The minted PLP is held by the vault as a Balance<PLP> and counts
/// toward NAV (per Predict's vault accounting).
///
/// Operator-only.
public fun deploy_to_predict<T>(
    vault: &mut Vault<T>,
    predict: &mut Predict,
    clock: &Clock,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == vault.operator, E_NOT_OPERATOR);
    assert!(amount > 0, E_ZERO_AMOUNT);
    assert!(balance::value(&vault.cash) >= amount, E_INSUFFICIENT_LIQUIDITY);

    let cash_split = balance::split(&mut vault.cash, amount);
    let cash_coin = coin::from_balance(cash_split, ctx);
    let plp_coin = predict::supply<T>(predict, cash_coin, clock, ctx);

    let plp_minted = coin::value(&plp_coin);
    balance::join(&mut vault.plp_balance, coin::into_balance(plp_coin));

    event::emit(DeployedToPredict {
        vault_id: object::id(vault),
        operator: ctx.sender(),
        cash_in: amount,
        plp_minted,
    });
}

// --- View functions ---

/// Vault NAV in quote units. TODO: this is currently cash-only. Once we
/// add PLP-to-quote pricing (cash + plp_balance * vault_value /
/// total_plp_supply, read from the Predict shared object), NAV becomes
/// accurate post-deploy.
public fun nav<T>(vault: &Vault<T>): u64 {
    balance::value(&vault.cash)
}

public fun cash<T>(vault: &Vault<T>): u64 {
    balance::value(&vault.cash)
}

public fun plp_balance<T>(vault: &Vault<T>): u64 {
    balance::value(&vault.plp_balance)
}

public fun operator<T>(vault: &Vault<T>): address {
    vault.operator
}

public fun predict_manager_id<T>(vault: &Vault<T>): Option<ID> {
    vault.predict_manager_id
}