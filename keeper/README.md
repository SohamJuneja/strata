## Strata Keeper Bot MVP

Polls predict-server and logs settled BTC oracle events.

### Run
cd keeper
npm install
npm start

### What it does (V1)
- Polls /oracles every 60 seconds
- Logs each newly settled oracle with price and expiry
- In-memory deduplication (resets on restart)

### V2 roadmap (not built yet)
- Read PredictManager positions from chain via Sui RPC
- Call vault::redeem_settled_hedge_permissionless for settled positions Strata holds
- Persist seen oracle IDs to disk (JSON file) so restarts do not re-log old events
