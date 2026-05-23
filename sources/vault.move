/// Core vault for Strata. Holds user-deposited quote asset, mints and
/// burns vault shares against current NAV, owns a PredictManager (via
/// the linked manager ID) for binary positions, and accumulates PLP
/// from the supply leg of the strategy.
///
/// User flows (deposit, withdraw) are unrestricted in identity but
/// gated by deposit_window_open. The window is open only when the
/// vault is 100% cash, so cash-based NAV is exact at that moment.
/// Strategy flows (deploy_to_predict, redeem_from_predict, buy_hedge,
/// redeem_hedge) require ctx.sender() == operator and typically run
/// while the window is closed. See CLAUDE.md "Architecture decisions"
/// for the V1 operator-key and epoch-window rationale.
module strata::vault;

use std::option::{Self, Option};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;

use deepbook_predict::market_key::MarketKey;
use deepbook_predict::oracle::OracleSVI;
use deepbook_predict::plp::PLP;
use deepbook_predict::predict::{Self, Predict};
use deepbook_predict::predict_manager::{Self, PredictManager};
use strata::vault_share::{Self, ShareTreasury, VAULT_SHARE};

public struct Vault<phantom T> has key {
    id: UID,
    cash: Balance<T>,
    plp_balance: Balance<PLP>,
    share_treasury_id: ID,
    operator: address,
    predict_manager_id: Option<ID>,
    /// True when user deposits and withdrawals are accepted. False
    /// while the vault has assets deployed that can't be priced
    /// externally. Toggled by the operator before and after each
    /// strategy cycle. Initialized true (vault starts at 100% cash).
    deposit_window_open: bool,
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

public struct RedeemedFromPredict has copy, drop {
    vault_id: ID,
    operator: address,
    plp_burned: u64,
    cash_returned: u64,
}

public struct HedgeBought has copy, drop {
    vault_id: ID,
    manager_id: ID,
    operator: address,
    quantity: u64,
    cash_budget: u64,
}

public struct HedgeRedeemed has copy, drop {
    vault_id: ID,
    manager_id: ID,
    operator: address,
    quantity: u64,
    cash_returned: u64,
}

public struct DepositWindowOpened has copy, drop {
    vault_id: ID,
    operator: address,
}

public struct DepositWindowClosed has copy, drop {
    vault_id: ID,
    operator: address,
}

// --- Errors ---

const E_ZERO_AMOUNT: u64 = 0;
const E_WRONG_TREASURY: u64 = 1;
const E_INSUFFICIENT_LIQUIDITY: u64 = 2;
const E_NOT_OPERATOR: u64 = 3;
const E_MANAGER_ALREADY_SET: u64 = 4;
const E_MANAGER_NOT_SET: u64 = 5;
const E_WRONG_MANAGER: u64 = 6;
const E_DEPOSIT_WINDOW_CLOSED: u64 = 7;

// --- Constructor ---

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
        deposit_window_open: true,
    };
    transfer::share_object(vault);
}

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

// --- Deposit window control (operator) ---

public fun open_deposit_window<T>(vault: &mut Vault<T>, ctx: &TxContext) {
    assert!(ctx.sender() == vault.operator, E_NOT_OPERATOR);
    vault.deposit_window_open = true;
    event::emit(DepositWindowOpened {
        vault_id: object::id(vault),
        operator: ctx.sender(),
    });
}

public fun close_deposit_window<T>(vault: &mut Vault<T>, ctx: &TxContext) {
    assert!(ctx.sender() == vault.operator, E_NOT_OPERATOR);
    vault.deposit_window_open = false;
    event::emit(DepositWindowClosed {
        vault_id: object::id(vault),
        operator: ctx.sender(),
    });
}

// --- User flows (window-gated) ---

public fun deposit<T>(
    vault: &mut Vault<T>,
    share_treasury: &mut ShareTreasury,
    payment: Coin<T>,
    ctx: &mut TxContext,
): Coin<VAULT_SHARE> {
    assert!(vault.deposit_window_open, E_DEPOSIT_WINDOW_CLOSED);
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

public fun withdraw<T>(
    vault: &mut Vault<T>,
    share_treasury: &mut ShareTreasury,
    shares: Coin<VAULT_SHARE>,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(vault.deposit_window_open, E_DEPOSIT_WINDOW_CLOSED);
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

public fun redeem_from_predict<T>(
    vault: &mut Vault<T>,
    predict: &mut Predict,
    clock: &Clock,
    plp_amount: u64,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == vault.operator, E_NOT_OPERATOR);
    assert!(plp_amount > 0, E_ZERO_AMOUNT);
    assert!(balance::value(&vault.plp_balance) >= plp_amount, E_INSUFFICIENT_LIQUIDITY);

    let plp_split = balance::split(&mut vault.plp_balance, plp_amount);
    let plp_coin = coin::from_balance(plp_split, ctx);
    let quote_coin = predict::withdraw<T>(predict, plp_coin, clock, ctx);

    let cash_returned = coin::value(&quote_coin);
    balance::join(&mut vault.cash, coin::into_balance(quote_coin));

    event::emit(RedeemedFromPredict {
        vault_id: object::id(vault),
        operator: ctx.sender(),
        plp_burned: plp_amount,
        cash_returned,
    });
}

public fun buy_hedge<T>(
    vault: &mut Vault<T>,
    predict: &mut Predict,
    manager: &mut PredictManager,
    oracle: &OracleSVI,
    key: MarketKey,
    quantity: u64,
    cash_budget: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == vault.operator, E_NOT_OPERATOR);
    assert!(option::is_some(&vault.predict_manager_id), E_MANAGER_NOT_SET);
    let expected_manager_id = *option::borrow(&vault.predict_manager_id);
    assert!(object::id(manager) == expected_manager_id, E_WRONG_MANAGER);

    assert!(quantity > 0, E_ZERO_AMOUNT);
    assert!(cash_budget > 0, E_ZERO_AMOUNT);
    assert!(balance::value(&vault.cash) >= cash_budget, E_INSUFFICIENT_LIQUIDITY);

    let cash_split = balance::split(&mut vault.cash, cash_budget);
    let cash_coin = coin::from_balance(cash_split, ctx);
    predict_manager::deposit(manager, cash_coin, ctx);

    predict::mint<T>(predict, manager, oracle, key, quantity, clock, ctx);

    event::emit(HedgeBought {
        vault_id: object::id(vault),
        manager_id: object::id(manager),
        operator: ctx.sender(),
        quantity,
        cash_budget,
    });
}

public fun redeem_hedge<T>(
    vault: &mut Vault<T>,
    predict: &mut Predict,
    manager: &mut PredictManager,
    oracle: &OracleSVI,
    key: MarketKey,
    quantity: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == vault.operator, E_NOT_OPERATOR);
    assert!(option::is_some(&vault.predict_manager_id), E_MANAGER_NOT_SET);
    let expected_manager_id = *option::borrow(&vault.predict_manager_id);
    assert!(object::id(manager) == expected_manager_id, E_WRONG_MANAGER);
    assert!(quantity > 0, E_ZERO_AMOUNT);

    predict::redeem<T>(predict, manager, oracle, key, quantity, clock, ctx);

    let manager_balance = predict_manager::balance<T>(manager);
    let cash_returned = if (manager_balance > 0) {
        let cash_coin = predict_manager::withdraw<T>(manager, manager_balance, ctx);
        balance::join(&mut vault.cash, coin::into_balance(cash_coin));
        manager_balance
    } else {
        0
    };

    event::emit(HedgeRedeemed {
        vault_id: object::id(vault),
        manager_id: object::id(manager),
        operator: ctx.sender(),
        quantity,
        cash_returned,
    });
}

// --- View functions ---

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

public fun deposit_window_open<T>(vault: &Vault<T>): bool {
    vault.deposit_window_open
}