/// Tokenized vault share for the Strata PLP+Hedge vault.
///
/// Shares are minted as a standard Sui Coin so they compose naturally
/// with the rest of Sui DeFi, including deepbook_margin as collateral.
/// This is the composability primitive that distinguishes Strata from
/// any structured-products vault that could exist on Ethereum.
module strata::vault_share;

use sui::coin::{Self, Coin, TreasuryCap};
use sui::coin_registry;

/// One-time witness type. Created by the runtime on package publish.
public struct VAULT_SHARE has drop {}

/// Treasury that holds the mint and burn capability for vault shares.
/// Mint and burn are restricted to other modules in the strata package
/// via package visibility, so only the vault deposit/withdraw flow can
/// move share supply.
public struct ShareTreasury has key, store {
    id: UID,
    treasury_cap: TreasuryCap<VAULT_SHARE>,
}

const E_ZERO_AMOUNT: u64 = 0;

/// Init runs once on package publish. Creates the share currency via
/// the new coin_registry API, finalizes the registration, and shares
/// the treasury so vault transactions can take a mutable reference to
/// it. The metadata cap is transferred to the publisher so they can
/// manage metadata post-deploy if needed.
fun init(otw: VAULT_SHARE, ctx: &mut TxContext) {
    let (builder, treasury_cap) = coin_registry::new_currency_with_otw(
        otw,
        6,
        b"STRATA-PH".to_string(),
        b"Strata PLP+Hedge Share".to_string(),
        b"Tokenized share of the Strata PLP+Hedge vault on DeepBook Predict".to_string(),
        b"".to_string(),
        ctx,
    );
    let metadata_cap = builder.finalize(ctx);
    transfer::public_transfer(metadata_cap, ctx.sender());

    transfer::public_share_object(ShareTreasury {
        id: object::new(ctx),
        treasury_cap,
    });
}

/// Mint new vault shares. Package-visible so only the vault deposit
/// flow can call it.
public(package) fun mint(
    treasury: &mut ShareTreasury,
    amount: u64,
    ctx: &mut TxContext,
): Coin<VAULT_SHARE> {
    assert!(amount > 0, E_ZERO_AMOUNT);
    coin::mint(&mut treasury.treasury_cap, amount, ctx)
}

/// Burn vault shares. Package-visible so only the vault withdraw flow
/// can call it.
public(package) fun burn(treasury: &mut ShareTreasury, shares: Coin<VAULT_SHARE>): u64 {
    coin::burn(&mut treasury.treasury_cap, shares)
}

/// Read the total supply of vault shares outstanding. Used by the
/// vault to compute share price for new deposits.
public fun total_supply(treasury: &ShareTreasury): u64 {
    coin::total_supply(&treasury.treasury_cap)
}