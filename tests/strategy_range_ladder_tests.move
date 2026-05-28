#[test_only]
module strata::strategy_range_ladder_tests;

use sui::object;
use sui::test_scenario;

use strata::strategy_range_ladder::{Self, StrategyRangeConfig};

const ADMIN: address = @0xA;
const ALICE: address = @0xAA;

#[test]
fun config_starts_with_default_params() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    {
        strategy_range_ladder::create_range_config(dummy_vault_id, ADMIN, scenario.ctx());
    };

    scenario.next_tx(ADMIN);
    let config = scenario.take_shared<StrategyRangeConfig>();
    assert!(strategy_range_ladder::operator(&config) == ADMIN, 0);
    assert!(strategy_range_ladder::ladder_width_bps(&config) == 1000, 1);
    assert!(strategy_range_ladder::num_rungs(&config) == 5, 2);

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
fun operator_can_update_ladder_width() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_range_ladder::create_range_config(dummy_vault_id, ADMIN, scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut config = scenario.take_shared<StrategyRangeConfig>();
    strategy_range_ladder::set_ladder_width(&mut config, 2000, scenario.ctx());

    assert!(strategy_range_ladder::ladder_width_bps(&config) == 2000, 0);

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
fun operator_can_update_num_rungs() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_range_ladder::create_range_config(dummy_vault_id, ADMIN, scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut config = scenario.take_shared<StrategyRangeConfig>();
    strategy_range_ladder::set_num_rungs(&mut config, 3, scenario.ctx());

    assert!(strategy_range_ladder::num_rungs(&config) == 3, 0);

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 0)]
fun non_operator_cannot_update() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_range_ladder::create_range_config(dummy_vault_id, ADMIN, scenario.ctx());

    // ALICE is not the operator; this should abort with E_NOT_OPERATOR (0).
    scenario.next_tx(ALICE);
    let mut config = scenario.take_shared<StrategyRangeConfig>();
    strategy_range_ladder::set_ladder_width(&mut config, 2000, scenario.ctx());

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 1)]
fun out_of_range_width_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_range_ladder::create_range_config(dummy_vault_id, ADMIN, scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut config = scenario.take_shared<StrategyRangeConfig>();
    // 6000 bps = 60% which exceeds the 5000 bps cap
    strategy_range_ladder::set_ladder_width(&mut config, 6000, scenario.ctx());

    test_scenario::return_shared(config);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 1)]
fun out_of_range_rungs_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    let dummy_vault_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ADMIN);
    strategy_range_ladder::create_range_config(dummy_vault_id, ADMIN, scenario.ctx());

    scenario.next_tx(ADMIN);
    let mut config = scenario.take_shared<StrategyRangeConfig>();
    // 11 rungs exceeds the max of 10
    strategy_range_ladder::set_num_rungs(&mut config, 11, scenario.ctx());

    test_scenario::return_shared(config);
    scenario.end();
}
