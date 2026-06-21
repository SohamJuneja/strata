// v1 (original, retired — VAULT_SHARE supply corrupted by a NAV-pricing
// bug, see TASK 2 remediation notes): 0x27466001865a80e5733ed4e16529375f063c602b6eb22b4ca86dda525797745a
// v2 (Range Ladder upgrade, retired): 0xbfb9c946956d1843130a6cbae0475648e57bda3fb644d281c6d89b468437cba1
// v3 (vault_factory upgrade, retired): 0x44a0e82a452e47dc33caaaf62bf64459c1b9c65113eea29744b74b40ac34c9a7
// Fresh publish (current) — new VAULT_SHARE coin type, clean share supply,
// deploy_to_predict now drains cash to exactly 0 (see marathon-bot/index.ts).
export const STRATA_PACKAGE = "0xc579b44c2070110f5e4690e7177c041d05e44f1b65e5a78ca93ab974843df9a9";
export const VAULT_ID = "0xd6e6cf89d52e660435ee5014b216fdbae40ed9d82a45aac2b9f9a0882d60a5a8";
export const SHARE_TREASURY_ID = "0xd5b641b722dd49a7edf0d8956151ca949e204e54457b9744ec26496024f1cf60";
export const STRATEGY_CONFIG_ID = "0x119138313632b55668b816a5e7ee755104ab3b3340c19f73a7c1e97b16a7cea8";
export const STRATEGY_RANGE_CONFIG_ID = "0x6cbf30a380c945c77c453ee84e3bbc64b679e41adc1a3ac16123b5ee2533e6fb";
export const PREDICT_MANAGER_ID = "0x6f65f04facf1d76e0fce71ca93f4bc95e19091a90f0e14c00d4e2cd5c3eb810c";
export const VAULT_REGISTRY_ID = "0x504ca463e3fd15d314cee9db85256be6ddbe4988aa5767e89bf7d0ed431cfade";
export const VAULT_SHARE_TYPE = `${STRATA_PACKAGE}::vault_share::VAULT_SHARE`;
export const DUSDC_TYPE = "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC";
export const DUSDC_DECIMALS = 6;
export const SHARE_DECIMALS = 6;
export const PREDICT_ID = "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a";
export const PREDICT_PACKAGE = "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138";
export const SUI_CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";
export const PREDICT_SERVER_URL = "https://predict-server.testnet.mystenlabs.com";