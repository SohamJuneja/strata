#[test_only]
module strata::vault_tests;

use sui::coin::{Self, Coin};
use sui::test_scenario::{Self, Scenario};
use std::unit_test;

use strata::vault::{Self, Vault};
use strata::vault_share::{Self, ShareTreasury};

/// Mock quote coin type for testing the generic vault.
public struct MOCK_USDC has drop {}

const ADMIN: address = @0xA;
const ALICE: address = @0xAA;
const BOB: address = @0xBB;

// === Helpers ===

/// Initialize the share module and create a MOCK_USDC vault.
fun setup(scenario: &mut Scenario) {
    scenario.next_tx(ADMIN);
    {
        vault_share::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let treasury = scenario.take_shared<ShareTreasury>();
        vault::create_vault<MOCK_USDC>(&treasury, scenario.ctx());
        test_scenario::return_shared(treasury);
    };
}

fun mint_mock(amount: u64, ctx: &mut TxContext): Coin<MOCK_USDC> {
    coin::mint_for_testing<MOCK_USDC>(amount, ctx)
}

// === Tests ===

#[test]
fun first_deposit_is_one_to_one() {
    let mut scenario = test_scenario::begin(ALICE);
    setup(&mut scenario);

    scenario.next_tx(ALICE);
    let mut vault = scenario.take_shared<Vault<MOCK_USDC>>();
    let mut treasury = scenario.take_shared<ShareTreasury>();
    let payment = mint_mock(1000, scenario.ctx());

    let shares = vault::deposit(&mut vault, &mut treasury, payment, scenario.ctx());

    assert!(coin::value(&shares) == 1000, 0);
    assert!(vault::cash(&vault) == 1000, 1);
    assert!(vault_share::total_supply(&treasury) == 1000, 2);

    unit_test::destroy(shares);
    test_scenario::return_shared(vault);
    test_scenario::return_shared(treasury);

    scenario.end();
}

#[test]
fun second_deposit_is_proportional_to_nav() {
    let mut scenario = test_scenario::begin(ALICE);
    setup(&mut scenario);

    scenario.next_tx(ALICE);
    let mut vault = scenario.take_shared<Vault<MOCK_USDC>>();
    let mut treasury = scenario.take_shared<ShareTreasury>();

    // First deposit: 1000 in, 1000 shares out
    let first = mint_mock(1000, scenario.ctx());
    let first_shares = vault::deposit(&mut vault, &mut treasury, first, scenario.ctx());
    unit_test::destroy(first_shares);

    // Second deposit: 500 in. NAV=1000, supply=1000, so shares = 500*1000/1000 = 500
    let second = mint_mock(500, scenario.ctx());
    let second_shares = vault::deposit(&mut vault, &mut treasury, second, scenario.ctx());

    assert!(coin::value(&second_shares) == 500, 0);
    assert!(vault::cash(&vault) == 1500, 1);
    assert!(vault_share::total_supply(&treasury) == 1500, 2);

    unit_test::destroy(second_shares);
    test_scenario::return_shared(vault);
    test_scenario::return_shared(treasury);

    scenario.end();
}

#[test]
fun full_withdraw_returns_all_funds() {
    let mut scenario = test_scenario::begin(ALICE);
    setup(&mut scenario);

    scenario.next_tx(ALICE);
    let mut vault = scenario.take_shared<Vault<MOCK_USDC>>();
    let mut treasury = scenario.take_shared<ShareTreasury>();

    let payment = mint_mock(1000, scenario.ctx());
    let shares = vault::deposit(&mut vault, &mut treasury, payment, scenario.ctx());

    let withdrawn = vault::withdraw(&mut vault, &mut treasury, shares, scenario.ctx());

    assert!(coin::value(&withdrawn) == 1000, 0);
    assert!(vault::cash(&vault) == 0, 1);
    assert!(vault_share::total_supply(&treasury) == 0, 2);

    unit_test::destroy(withdrawn);
    test_scenario::return_shared(vault);
    test_scenario::return_shared(treasury);

    scenario.end();
}

#[test]
fun partial_withdraw_returns_proportional_funds() {
    let mut scenario = test_scenario::begin(ALICE);
    setup(&mut scenario);

    scenario.next_tx(ALICE);
    let mut vault = scenario.take_shared<Vault<MOCK_USDC>>();
    let mut treasury = scenario.take_shared<ShareTreasury>();

    let payment = mint_mock(1000, scenario.ctx());
    let mut shares = vault::deposit(&mut vault, &mut treasury, payment, scenario.ctx());

    // Split off half and withdraw
    let half = coin::split(&mut shares, 500, scenario.ctx());
    let withdrawn = vault::withdraw(&mut vault, &mut treasury, half, scenario.ctx());

    assert!(coin::value(&withdrawn) == 500, 0);
    assert!(vault::cash(&vault) == 500, 1);
    assert!(vault_share::total_supply(&treasury) == 500, 2);
    assert!(coin::value(&shares) == 500, 3);

    unit_test::destroy(shares);
    unit_test::destroy(withdrawn);
    test_scenario::return_shared(vault);
    test_scenario::return_shared(treasury);

    scenario.end();
}

#[test]
fun two_depositors_share_pool_correctly() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup(&mut scenario);

    // Alice deposits 1000, gets 1000 shares
    scenario.next_tx(ALICE);
    let mut vault = scenario.take_shared<Vault<MOCK_USDC>>();
    let mut treasury = scenario.take_shared<ShareTreasury>();
    let alice_payment = mint_mock(1000, scenario.ctx());
    let alice_shares = vault::deposit(&mut vault, &mut treasury, alice_payment, scenario.ctx());
    assert!(coin::value(&alice_shares) == 1000, 0);
    unit_test::destroy(alice_shares);
    test_scenario::return_shared(vault);
    test_scenario::return_shared(treasury);

    // Bob deposits 500, gets 500 shares (NAV ratio unchanged)
    scenario.next_tx(BOB);
    let mut vault = scenario.take_shared<Vault<MOCK_USDC>>();
    let mut treasury = scenario.take_shared<ShareTreasury>();
    let bob_payment = mint_mock(500, scenario.ctx());
    let bob_shares = vault::deposit(&mut vault, &mut treasury, bob_payment, scenario.ctx());

    assert!(coin::value(&bob_shares) == 500, 1);
    assert!(vault::cash(&vault) == 1500, 2);
    assert!(vault_share::total_supply(&treasury) == 1500, 3);

    unit_test::destroy(bob_shares);
    test_scenario::return_shared(vault);
    test_scenario::return_shared(treasury);

    scenario.end();
}

#[test]
#[expected_failure(abort_code = 0)]
fun deposit_zero_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    setup(&mut scenario);

    scenario.next_tx(ALICE);
    let mut vault = scenario.take_shared<Vault<MOCK_USDC>>();
    let mut treasury = scenario.take_shared<ShareTreasury>();
    let zero = mint_mock(0, scenario.ctx());

    let shares = vault::deposit(&mut vault, &mut treasury, zero, scenario.ctx());

    unit_test::destroy(shares);
    test_scenario::return_shared(vault);
    test_scenario::return_shared(treasury);
    scenario.end();
}