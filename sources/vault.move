/// Core vault for Strata. Holds user-deposited quote asset, mints and
/// burns vault shares against current NAV, and (in a later commit)
/// owns the PredictManager that strategy modules act through.
///
/// This first iteration handles cash only. PredictManager integration
/// is added in a subsequent commit; once added, NAV becomes
/// `cash + manager position value + manager PLP value`.
module strata::vault;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;

use strata::vault_share::{Self, ShareTreasury, VAULT_SHARE};

/// Vault state. Generic over quote asset T. V1 runs a single dUSDC-typed
/// vault. Future strategies could instantiate vaults over BTC, SUI, etc.
public struct Vault<phantom T> has key {
    id: UID,
    /// Cash sitting in the vault, not yet deployed to the strategy.
    cash: Balance<T>,
    /// ID of the ShareTreasury this vault is paired with. Enforced on
    /// every deposit and withdraw so a malicious caller cannot pass a
    /// different treasury and break accounting.
    share_treasury_id: ID,
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

// --- Errors ---

const E_ZERO_AMOUNT: u64 = 0;
const E_WRONG_TREASURY: u64 = 1;
const E_INSUFFICIENT_LIQUIDITY: u64 = 2;

// --- Constructor ---

/// Create and share a new vault paired with the given ShareTreasury.
/// Public so a deploy script can call this once during setup. We rely
/// on the deployer to call it exactly once; on-chain there is no
/// singleton enforcement yet.
public fun create_vault<T>(share_treasury: &ShareTreasury, ctx: &mut TxContext) {
    let vault = Vault<T> {
        id: object::new(ctx),
        cash: balance::zero(),
        share_treasury_id: object::id(share_treasury),
    };
    transfer::share_object(vault);
}

// --- Core flows ---

/// Deposit quote asset into the vault and receive vault shares.
/// Shares are minted proportional to current NAV.
///
/// Math: shares = amount * total_supply / nav
/// First deposit: shares = amount (1:1 anchor)
///
/// Returns the minted shares so the caller can compose with other
/// Sui DeFi in the same PTB (e.g., immediately deposit as Margin
/// collateral). For the common "deposit and keep" case, callers wrap
/// this call in a PTB that transfers the returned coin to themselves.
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
///
/// Math: amount = shares * nav / total_supply
///
/// Returns the quote asset coin so the caller can compose with other
/// Sui DeFi in the same PTB.
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

// --- View functions ---

/// Current vault NAV. Cash-only for this iteration. Once PredictManager
/// is integrated, this becomes the sum of cash plus the manager's
/// position and PLP values priced from current oracle state.
public fun nav<T>(vault: &Vault<T>): u64 {
    balance::value(&vault.cash)
}

/// Current cash balance sitting in the vault, not deployed.
public fun cash<T>(vault: &Vault<T>): u64 {
    balance::value(&vault.cash)
}