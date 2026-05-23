#[test_only]
module strata::strategy_plp_hedge_tests;

use sui::object;
use sui::test_scenario;
use std::unit_test;

use strata::strategy_plp_hedge::{Self, StrategyConfig};

const ADMIN: address = @0xA;
const ALICE: address = @0xAA;

#[test]
fun config_starts_with_default_params() {
    let mut scenario = test_scenario::begin(ADMIN);

    // Use a fresh UID just to have an ID to pass in. In production this
    // is the actual vault's ID.
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    {
        strategy_plp_hedge::create_config(dummy_vault_id, ADMIN, scenario.ctx());
    };

    scenario.next_tx(ADMIN);
    let config = scenario.take_shared<StrategyConfig>();
    assert!(strategy_plp_hedge::operator(&config) == ADMIN, 0);
    assert!(strategy_plp_hedge::hedge_ratio_bps(&config) == 1000, 1);
    assert!(strategy_plp_hedge::hedge_strike_offset_bps(&config) == 500, 2);

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
fun operator_can_update_hedge_ratio() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_plp_hedge::create_config(dummy_vault_id, ADMIN, scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut config = scenario.take_shared<StrategyConfig>();
    strategy_plp_hedge::set_hedge_ratio(&mut config, 2000, scenario.ctx());

    assert!(strategy_plp_hedge::hedge_ratio_bps(&config) == 2000, 0);

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 0)]
fun non_operator_cannot_update() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_plp_hedge::create_config(dummy_vault_id, ADMIN, scenario.ctx());

    // ALICE is not the operator; this should abort with E_NOT_OPERATOR.
    scenario.next_tx(ALICE);
    let mut config = scenario.take_shared<StrategyConfig>();
    strategy_plp_hedge::set_hedge_ratio(&mut config, 2000, scenario.ctx());

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 1)]
fun out_of_range_ratio_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_plp_hedge::create_config(dummy_vault_id, ADMIN, scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut config = scenario.take_shared<StrategyConfig>();
    // 6000 bps = 60% which exceeds the 50% cap
    strategy_plp_hedge::set_hedge_ratio(&mut config, 6000, scenario.ctx());

    test_scenario::return_shared(config);
    scenario.end();
}