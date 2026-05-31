export const CONFIG = {
  PREDICT_SERVER: "https://predict-server.testnet.mystenlabs.com",

  // Strata package (current, after Range Ladder upgrade)
  STRATA_PACKAGE: "0xbfb9c946956d1843130a6cbae0475648e57bda3fb644d281c6d89b468437cba1",

  // Vault<DUSDC> shared object
  VAULT_ID: "0xaa1abbf4bc1328c41f1ce635cc4d974889bb90989244c248c40bb80f33a9206e",

  // PredictManager shared object (owned by operator, linked to vault)
  PREDICT_MANAGER_ID: "0x99b20ae30ba4bdc19e8e0d7d54d8ce84e55452dbd6ae046d10b1f062b80cec07",

  // Predict top-level shared protocol object
  PREDICT_OBJECT_ID: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",

  POLL_INTERVAL_MS: 60_000,
} as const;
