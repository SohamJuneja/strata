import { CONFIG } from "./config.js";

interface OracleEntry {
  oracle_id: string;
  status: string;
  settlement_price: number;
  expiry: number;
  underlying_asset: string;
  activated_at: number;
  settled_at: number;
}

const seenOracleIds = new Set<string>();

async function fetchSettledOracles(): Promise<OracleEntry[]> {
  const res = await fetch(`${CONFIG.PREDICT_SERVER}/oracles`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from /oracles`);
  }
  const data = (await res.json()) as OracleEntry[];
  return data.filter((o) => o.status === "settled");
}

async function poll(): Promise<void> {
  const settled = await fetchSettledOracles();
  let newCount = 0;

  for (const oracle of settled) {
    if (seenOracleIds.has(oracle.oracle_id)) continue;

    seenOracleIds.add(oracle.oracle_id);
    newCount++;

    const shortId = oracle.oracle_id.slice(0, 12) + "...";
    const price = (oracle.settlement_price / 1e9).toFixed(2);
    const expiry = new Date(oracle.expiry).toISOString();
    const settledAt = new Date(oracle.settled_at).toISOString();

    console.log(
      `[SETTLED] oracle_id=${shortId} | asset=${oracle.underlying_asset} | price=$${price} | expiry=${expiry} | settled=${settledAt}`
    );
  }

  console.log(
    `[POLL] checked ${settled.length} settled oracles, ${newCount} new since last poll`
  );
}

async function main(): Promise<void> {
  console.log("[KEEPER] Strata keeper bot starting...");
  console.log(`[KEEPER] Polling ${CONFIG.PREDICT_SERVER}/oracles every ${CONFIG.POLL_INTERVAL_MS / 1000}s`);

  try {
    await poll();
  } catch (err) {
    console.error("[ERROR]", err);
  }

  setInterval(async () => {
    try {
      await poll();
    } catch (err) {
      console.error("[ERROR]", err);
    }
  }, CONFIG.POLL_INTERVAL_MS);
}

main();
