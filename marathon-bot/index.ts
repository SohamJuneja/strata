/**
 * Strata Marathon Bot
 * ==================
 * Runs continuous vault cycles across multiple LP wallets on Sui testnet.
 * Generates real on-chain transactions demonstrating the Strata lifecycle:
 *   deposit → deploy idle cash to PLP → buy OTM put hedge → settle expired hedges → repeat
 *
 * Usage:
 *   cp .env.example .env   # fill in your contract IDs
 *   npm install
 *   npm start
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { requestSuiFromFaucetV2, getFaucetHost } from '@mysten/sui/faucet';
import * as fs from 'fs';
import * as path from 'path';

if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  process.loadEnvFile(path.join(process.cwd(), '.env'));
}

// ============================================================
// CONFIG — all values come from .env (see .env.example)
// ============================================================

const STRATA_PACKAGE      = process.env.STRATA_PACKAGE_ID    ?? '';
const PREDICT_PACKAGE     = process.env.PREDICT_PACKAGE_ID   ?? '';
const VAULT_ID            = process.env.VAULT_ID             ?? '';
const SHARE_TREASURY_ID   = process.env.SHARE_TREASURY_ID    ?? '';
const PREDICT_MANAGER_ID  = process.env.PREDICT_MANAGER_ID   ?? '';
const PREDICT_ID          = process.env.PREDICT_ID           ?? '';
const STRATEGY_CONFIG_ID  = process.env.STRATEGY_CONFIG_ID   ?? '';
const DUSDC_TYPE          = process.env.DUSDC_COIN_TYPE       ?? '';
const PREDICT_SERVER      = process.env.PREDICT_SERVER_URL   ?? 'https://predict-server.testnet.mystenlabs.com';
const OPERATOR_KEY        = process.env.OPERATOR_PRIVATE_KEY ?? '';

// Strata's Vault<DUSDC> is a single shared object — STRATA-PH and STRATA-RL
// (the two strategy pages in the frontend) both read/write this same vault.
// There is no separate "RL vault" object to deposit into.

const SUI_CLOCK_ID          = '0x0000000000000000000000000000000000000000000000000000000000000006';
const NUM_LP_WALLETS        = 5;
const DEPOSIT_AMOUNT_MIST   = 5_000_000;   // 5 dUSDC (6 decimals)
const LP_DUSDC_TARGET_MIST  = 30_000_000;  // top up each LP wallet to 30 dUSDC
const LP_SUI_MIN_MIST       = 50_000_000n; // 0.05 SUI gas floor
const OPERATOR_SUI_MIN_MIST = 100_000_000n; // 0.1 SUI gas floor
const HEDGE_PROBE_QUANTITY  = 1_000_000;   // probe size used to read a per-unit price via get_trade_amounts
const HEDGE_FALLBACK_RATIO_BPS  = 1000n;   // 10% of NAV in hedges — used only if the on-chain config read fails
const HEDGE_FALLBACK_STRIKE_OFFSET_BPS = 500n; // 5% OTM — used only if the on-chain config read fails

// Set to a bigint (e.g. 0n for at-the-money) to temporarily override the
// configured strike offset for testing — null uses the on-chain
// StrategyConfig value (500 bps / 5% OTM) as intended for normal operation.
const HEDGE_STRIKE_OFFSET_OVERRIDE_BPS: bigint | null = null;
const CYCLE_INTERVAL_MS     = Number(process.env.CYCLE_INTERVAL_OVERRIDE) || 15 * 60 * 1000;
const LOG_PATH               = path.join(process.cwd(), 'cycle-log.json');
const WALLETS_PATH           = path.join(process.cwd(), 'lp-wallets.json');

// ============================================================
// TYPES
// ============================================================

interface CycleEntry {
  cycleNumber:        number;
  timestamp:          string;
  btcPrice:           number | null;
  settledOracleIds:   string[];
  redeemedDigests:    string[];
  hedgeTriggered:     boolean;
  deployedToPlp:      boolean;
  hedgeBoughtDigest:  string | null;
  hedgeStrike:        number | null; // dollar-scale strike of the bought hedge, for display
  hedgeAskPct:        number | null; // ask price at mint time, as a percent (≈ probability of finishing ITM)
  hedgeIsAtm:          boolean | null; // true if ask was ~40-60% (at-the-money), false if clearly OTM
  testNote:           string | null; // transparency label for anything forced for integration testing
  depositDigests:     string[];
  // Deposits labeled STRATA-RL for activity-feed purposes. Strata-PH and
  // Strata-RL share one Vault<DUSDC> object on chain (confirmed in
  // CLAUDE.md and the vault/strategy_range_ladder source — there is no
  // separate RL vault to deposit into), so this is the same vault::deposit
  // call as depositDigests, just earmarked so the activity page can show
  // both strategies generating deposit activity.
  rlDepositDigests:   string[];
  totalTxThisSession: number;
  error:              string | null;
}

interface OracleEntry {
  oracle_id:         string;
  status:            'created' | 'active' | 'settled';
  settlement_price:  number | null;
  expiry:            number;
  underlying_asset:  string;
  settled_at:        number | null;
  min_strike:        number;
  tick_size:         number;
}

interface OpenPosition {
  oracleId: string;
  expiry:   number;
  strike:   number;
  isUp:     boolean;
  quantity: bigint;
}

// ============================================================
// LOGGING
// ============================================================

function ts(): string {
  return new Date().toISOString();
}

function log(msg: string) {
  console.log(`[${ts()}] ${msg}`);
}

function appendCycleLog(entry: CycleEntry) {
  let existing: CycleEntry[] = [];
  if (fs.existsSync(LOG_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')); } catch {}
  }
  existing.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2));
}

function totalTxSoFar(): number {
  if (!fs.existsSync(LOG_PATH)) return 0;
  try {
    const entries: CycleEntry[] = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
    return entries.reduce((acc, e) => (
      // rlDepositDigests is a newer field — guard for older log entries
      // written before it existed.
      acc + e.redeemedDigests.length + e.depositDigests.length + (e.rlDepositDigests?.length ?? 0) +
      (e.deployedToPlp ? 1 : 0) + (e.hedgeBoughtDigest ? 1 : 0)
    ), 0);
  } catch { return 0; }
}

// ============================================================
// WALLET MANAGEMENT
// ============================================================

function loadOrCreateWallets(): Ed25519Keypair[] {
  if (fs.existsSync(WALLETS_PATH)) {
    const keys: string[] = JSON.parse(fs.readFileSync(WALLETS_PATH, 'utf-8'));
    log(`Loaded ${keys.length} existing LP wallets`);
    return keys.map(k => Ed25519Keypair.fromSecretKey(k));
  }

  log(`Generating ${NUM_LP_WALLETS} fresh LP wallets…`);
  const wallets: Ed25519Keypair[] = [];
  const keys: string[] = [];

  for (let i = 0; i < NUM_LP_WALLETS; i++) {
    const kp = new Ed25519Keypair();
    wallets.push(kp);
    keys.push(kp.getSecretKey()); // bech32 "suiprivkey1..." string
    log(`  LP ${i + 1}: ${kp.getPublicKey().toSuiAddress()}`);
  }

  fs.writeFileSync(WALLETS_PATH, JSON.stringify(keys, null, 2));
  log(`Saved wallets to ${WALLETS_PATH} — back this file up!`);
  return wallets;
}

async function fundSuiFromFaucet(addr: string): Promise<boolean> {
  try {
    await requestSuiFromFaucetV2({ host: getFaucetHost('testnet'), recipient: addr });
    log(`  SUI faucet drip → ${addr.slice(0, 12)}…`);
    return true;
  } catch (e: any) {
    log(`  SUI faucet failed for ${addr.slice(0, 12)}…: ${e.message}`);
    return false;
  }
}

async function transferSui(client: SuiClient, from: Ed25519Keypair, toAddr: string, amountMist: bigint): Promise<void> {
  try {
    const fromAddr = from.getPublicKey().toSuiAddress();
    const tx = new Transaction();
    tx.setSender(fromAddr);
    const [split] = tx.splitCoins(tx.gas, [Number(amountMist)]);
    tx.transferObjects([split], toAddr);
    const res = await client.signAndExecuteTransaction({
      signer: from,
      transaction: tx,
      options: { showEffects: true },
    });
    if (res.effects?.status?.status === 'success') {
      log(`  SUI funded ${toAddr.slice(0, 12)}… (+${amountMist}, operator transfer — faucet unavailable) tx: ${res.digest.slice(0, 22)}…`);
    } else {
      log(`  SUI transfer FAILED for ${toAddr.slice(0, 12)}…: ${JSON.stringify(res.effects?.status)}`);
    }
  } catch (e: any) {
    log(`  SUI transfer error for ${toAddr.slice(0, 12)}…: ${e.message}`);
  }
}

// Tops up `addr` with testnet SUI gas. Tries the public faucet first; if it's
// rate-limited (common when many wallets are funded in quick succession),
// falls back to a direct on-chain transfer from the operator's own balance.
async function ensureSuiFunded(client: SuiClient, addr: string, minMist: bigint, operator?: Ed25519Keypair): Promise<void> {
  const bal = await client.getBalance({ owner: addr });
  if (BigInt(bal.totalBalance) >= minMist) return;

  const faucetOk = await fundSuiFromFaucet(addr);
  await sleep(1500);
  if (!faucetOk && operator) {
    await transferSui(client, operator, addr, minMist);
    await sleep(1500);
  }
}

// There is no public dUSDC faucet API — the only faucet is a manual Tally
// web form (see CLAUDE.md). LP wallets are instead funded with dUSDC by the
// operator splitting off coins from its own balance on-chain.
async function ensureDusdcFunded(client: SuiClient, operator: Ed25519Keypair, wallets: Ed25519Keypair[]): Promise<void> {
  const opAddr = operator.getPublicKey().toSuiAddress();
  for (const w of wallets) {
    const addr = w.getPublicKey().toSuiAddress();
    const coins = await client.getCoins({ owner: addr, coinType: DUSDC_TYPE });
    const total = coins.data.reduce((acc, c) => acc + BigInt(c.balance), 0n);
    if (total >= BigInt(LP_DUSDC_TARGET_MIST)) continue;

    const need = BigInt(LP_DUSDC_TARGET_MIST) - total;
    const coinId = await getDusdcCoin(client, opAddr, Number(need));
    if (!coinId) {
      log(`  Operator has no dUSDC coin large enough to fund ${addr.slice(0, 12)}… (need ${need})`);
      continue;
    }

    try {
      const tx = new Transaction();
      tx.setSender(opAddr);
      const [split] = tx.splitCoins(tx.object(coinId), [Number(need)]);
      tx.transferObjects([split], addr);
      const res = await client.signAndExecuteTransaction({
        signer: operator,
        transaction: tx,
        options: { showEffects: true },
      });
      if (res.effects?.status?.status === 'success') {
        log(`  dUSDC funded ${addr.slice(0, 12)}… (+${need}) tx: ${res.digest.slice(0, 22)}…`);
      } else {
        log(`  dUSDC funding FAILED for ${addr.slice(0, 12)}…: ${JSON.stringify(res.effects?.status)}`);
      }
    } catch (e: any) {
      log(`  dUSDC funding error for ${addr.slice(0, 12)}…: ${e.message}`);
    }
    await sleep(1500);
  }
}

async function ensureFunded(client: SuiClient, operator: Ed25519Keypair, wallets: Ed25519Keypair[]): Promise<void> {
  log('Checking SUI gas balances…');
  await ensureSuiFunded(client, operator.getPublicKey().toSuiAddress(), OPERATOR_SUI_MIN_MIST);
  for (const w of wallets) {
    await ensureSuiFunded(client, w.getPublicKey().toSuiAddress(), LP_SUI_MIN_MIST, operator);
  }
  log('Checking dUSDC balances…');
  await ensureDusdcFunded(client, operator, wallets);
}

// ============================================================
// ORACLE HELPERS (predict-server)
// ============================================================

async function fetchOracles(): Promise<OracleEntry[]> {
  try {
    const r = await fetch(`${PREDICT_SERVER}/oracles`);
    if (!r.ok) return [];
    return (await r.json()) as OracleEntry[];
  } catch (e: any) {
    log(`Oracle fetch error: ${e.message}`);
    return [];
  }
}

// ============================================================
// DUSDC COIN HELPERS
// ============================================================

async function getDusdcCoin(
  client: SuiClient,
  owner: string,
  minAmount: number
): Promise<string | null> {
  const coins = await client.getCoins({ owner, coinType: DUSDC_TYPE });
  const coin = coins.data.find(c => BigInt(c.balance) >= BigInt(minAmount));
  return coin?.coinObjectId ?? null;
}

// ============================================================
// VAULT VIEW HELPERS
// ============================================================

const FLOAT_SCALING = 1_000_000_000n; // Predict's fixed-point base for prices/probabilities

function bytesToU64(bytes: number[]): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) result = (result << 8n) | BigInt(bytes[i]);
  return result;
}

async function getVaultCash(client: SuiClient, senderAddr: string): Promise<bigint> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::cash`,
      typeArguments: [DUSDC_TYPE],
      arguments: [tx.object(VAULT_ID)],
    });
    const res = await client.devInspectTransactionBlock({ sender: senderAddr, transactionBlock: tx });
    const bytes = res.results?.[0]?.returnValues?.[0]?.[0];
    return bytes ? bytesToU64(bytes) : 0n;
  } catch (e: any) {
    log(`Vault cash read error, treating as 0 this cycle: ${e.message}`);
    return 0n;
  }
}

async function getDepositWindowOpen(client: SuiClient, senderAddr: string): Promise<boolean> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${STRATA_PACKAGE}::vault::deposit_window_open`,
    typeArguments: [DUSDC_TYPE],
    arguments: [tx.object(VAULT_ID)],
  });
  const res = await client.devInspectTransactionBlock({ sender: senderAddr, transactionBlock: tx });
  const bytes = res.results?.[0]?.returnValues?.[0]?.[0];
  return bytes?.[0] === 1;
}

// Reads the live hedge_ratio_bps / hedge_strike_offset_bps off the on-chain
// StrategyConfig so the bot stays in sync if the operator tunes them from
// the frontend, rather than hardcoding the (currently matching) defaults.
async function getStrategyConfig(client: SuiClient, senderAddr: string): Promise<{ hedgeRatioBps: bigint; strikeOffsetBps: bigint }> {
  if (!STRATEGY_CONFIG_ID) {
    return { hedgeRatioBps: HEDGE_FALLBACK_RATIO_BPS, strikeOffsetBps: HEDGE_FALLBACK_STRIKE_OFFSET_BPS };
  }
  try {
    const tx = new Transaction();
    tx.moveCall({ target: `${STRATA_PACKAGE}::strategy_plp_hedge::hedge_ratio_bps`, arguments: [tx.object(STRATEGY_CONFIG_ID)] });
    tx.moveCall({ target: `${STRATA_PACKAGE}::strategy_plp_hedge::hedge_strike_offset_bps`, arguments: [tx.object(STRATEGY_CONFIG_ID)] });
    const res = await client.devInspectTransactionBlock({ sender: senderAddr, transactionBlock: tx });
    const ratioBytes = res.results?.[0]?.returnValues?.[0]?.[0];
    const offsetBytes = res.results?.[1]?.returnValues?.[0]?.[0];
    return {
      hedgeRatioBps: ratioBytes ? bytesToU64(ratioBytes) : HEDGE_FALLBACK_RATIO_BPS,
      strikeOffsetBps: offsetBytes ? bytesToU64(offsetBytes) : HEDGE_FALLBACK_STRIKE_OFFSET_BPS,
    };
  } catch (e: any) {
    log(`StrategyConfig read error, using fallback defaults: ${e.message}`);
    return { hedgeRatioBps: HEDGE_FALLBACK_RATIO_BPS, strikeOffsetBps: HEDGE_FALLBACK_STRIKE_OFFSET_BPS };
  }
}

async function getOracleSpot(client: SuiClient, senderAddr: string, oracleId: string): Promise<bigint> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::oracle::spot_price`,
    arguments: [tx.object(oracleId)],
  });
  const res = await client.devInspectTransactionBlock({ sender: senderAddr, transactionBlock: tx });
  const bytes = res.results?.[0]?.returnValues?.[0]?.[0];
  return bytes ? bytesToU64(bytes) : 0n;
}

// Lists live oracles soonest-expiring first. predict-server's "active"
// status can lag reality by a lot — we've seen entries still marked
// "active" days after their on-chain expiry — so status alone isn't
// trustworthy. Cross-check against wall-clock expiry with a safety buffer
// so we don't pick something that aborts assert_quoteable_oracle on-chain.
//
// Separately, very short-dated oracles (the soonest few, ~15min apart)
// often can't price a 500bps-OTM put at all: over that little time the
// probability of a 5% move rounds to exactly 0, and predict's pricing
// config asserts the fair price is strictly inside (0, 1.0) before quoting
// a spread. Candidates must be tried in order and skipped on failure —
// there's no formula for "far enough out", it depends on live vol.
const ORACLE_EXPIRY_BUFFER_MS = 60_000;

function listLiveOracles(oracles: OracleEntry[]): OracleEntry[] {
  const now = Date.now();
  return oracles
    .filter(o => o.status === 'active' && o.expiry > now + ORACLE_EXPIRY_BUFFER_MS)
    .sort((a, b) => a.expiry - b.expiry);
}

// Strike for an out-of-the-money put: offsetBps below spot, floored to the
// oracle's strike grid (min_strike + n * tick_size).
function computeHedgeStrike(spot: bigint, minStrike: bigint, tickSize: bigint, offsetBps: bigint): bigint {
  const target = spot - (spot * offsetBps) / 10000n;
  if (tickSize <= 0n || target <= minStrike) return minStrike;
  const steps = (target - minStrike) / tickSize;
  return minStrike + steps * tickSize;
}

// predict::get_trade_amounts quotes a per-unit ask/bid for the CURRENT
// (pre-trade) state. predict::mint inserts the position before quoting, so
// the actual fill price is slightly worse than this probe — a 10% safety
// margin keeps the real cost under cash_budget so the mint doesn't abort.
// predict::mint aborts via assert_mintable_ask if the (post-trade) ask price
// falls outside Predict's configured [min_ask_price, max_ask_price] bounds
// (defaults 1%–99%). A deep OTM put on a short-dated oracle frequently
// prices below the 1% floor — not a bug, just an unmintable quote — so we
// read the live bounds and treat an out-of-bounds ask the same as a failed
// probe (caller tries a different strike/oracle).
async function getAskBounds(client: SuiClient, senderAddr: string, oracleId: string): Promise<{ min: bigint; max: bigint }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::ask_bounds`,
    arguments: [tx.object(PREDICT_ID), tx.pure.id(oracleId)],
  });
  const res = await client.devInspectTransactionBlock({ sender: senderAddr, transactionBlock: tx });
  const minBytes = res.results?.[0]?.returnValues?.[0]?.[0];
  const maxBytes = res.results?.[0]?.returnValues?.[1]?.[0];
  return {
    min: minBytes ? bytesToU64(minBytes) : 10_000_000n,
    max: maxBytes ? bytesToU64(maxBytes) : 990_000_000n,
  };
}

async function estimateHedgeQuantity(
  client: SuiClient,
  senderAddr: string,
  oracleId: string,
  expiry: number,
  strike: bigint,
  isUp: boolean,
  cashBudget: bigint,
  askBounds: { min: bigint; max: bigint },
): Promise<{ quantity: bigint; askPerUnit: bigint } | null> {
  const tx = new Transaction();
  const [key] = tx.moveCall({
    target: `${PREDICT_PACKAGE}::market_key::new`,
    arguments: [
      tx.pure.id(oracleId),
      tx.pure.u64(expiry),
      tx.pure.u64(strike.toString()),
      tx.pure.bool(isUp),
    ],
  });
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::get_trade_amounts`,
    arguments: [
      tx.object(PREDICT_ID),
      tx.object(oracleId),
      key,
      tx.pure.u64(HEDGE_PROBE_QUANTITY),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  const res = await client.devInspectTransactionBlock({ sender: senderAddr, transactionBlock: tx });
  const costBytes = res.results?.[1]?.returnValues?.[0]?.[0];
  const cost = costBytes ? bytesToU64(costBytes) : 0n;
  if (cost <= 0n) return null;

  // Recover the per-unit ask from cost = mul(ask, quantity) = ask * quantity / FLOAT_SCALING.
  const askPerUnit = (cost * FLOAT_SCALING) / BigInt(HEDGE_PROBE_QUANTITY);
  if (askPerUnit < askBounds.min || askPerUnit > askBounds.max) return null;

  const rawQuantity = (BigInt(HEDGE_PROBE_QUANTITY) * cashBudget) / cost;
  return { quantity: (rawQuantity * 90n) / 100n, askPerUnit };
}

interface HedgeQuote {
  oracle:      OracleEntry;
  strike:      bigint;
  quantity:    bigint;
  askPerUnit:  bigint; // FLOAT_SCALING-scaled (1e9 = 100%) — also doubles as an ATM/OTM signal for display
}

// Searches live oracles (soonest first) and, for each, a few strike offsets
// shrinking from the configured default toward spot, for the first
// (oracle, strike) that actually clears Predict's mintable-ask bounds.
// Live testnet vol is often too low to support the full configured OTM
// distance at all — narrowing the offset is the same lever a real desk
// pulls to keep a quote listable, not an environment-specific hack.
async function findHedgeQuote(
  client: SuiClient,
  senderAddr: string,
  candidates: OracleEntry[],
  baseOffsetBps: bigint,
  cashBudget: bigint,
): Promise<HedgeQuote | null> {
  // baseOffsetBps === 0n (at-the-money) is a valid, deliberate input — don't
  // filter it out along with the "no offset left to try" terminator case.
  const offsets = baseOffsetBps === 0n
    ? [0n]
    : [baseOffsetBps, baseOffsetBps / 2n, baseOffsetBps / 4n, baseOffsetBps / 8n].filter(bps => bps > 0n);

  for (const oracle of candidates.slice(0, 6)) {
    const spot = await getOracleSpot(client, senderAddr, oracle.oracle_id);
    if (spot <= 0n) continue;
    const askBounds = await getAskBounds(client, senderAddr, oracle.oracle_id);

    for (const offsetBps of offsets) {
      const strike = computeHedgeStrike(spot, BigInt(oracle.min_strike), BigInt(oracle.tick_size), offsetBps);
      const result = await estimateHedgeQuantity(client, senderAddr, oracle.oracle_id, oracle.expiry, strike, false, cashBudget, askBounds);
      if (result && result.quantity > 0n) return { oracle, strike, quantity: result.quantity, askPerUnit: result.askPerUnit };
    }
  }
  return null;
}

// suix_queryEvents defaults to ASCENDING (oldest-first) order when `order`
// isn't specified, and each page caps at ~50 results regardless of the
// `limit` requested. Predict is shared testnet infrastructure with a long
// global event history, so an unordered/unpaginated query silently returns
// the oldest events ever emitted — never ours. Must request `descending`
// explicitly and paginate to get reliable recent coverage.
async function queryRecentEvents(client: SuiClient, eventType: string, maxPages = 10) {
  const results: any[] = [];
  let cursor: any = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit: 50,
      order: 'descending',
    });
    results.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return results;
}

// Reconstruct currently-open hedge positions for our PredictManager from
// Predict's own PositionMinted/PositionRedeemed events (mint qty - redeem
// qty per MarketKey). The Vault and PredictManager objects don't expose an
// enumerable view of open positions, so event replay is the only way to
// discover which (oracle, strike, direction) keys are still open.
async function fetchOpenHedgePositions(client: SuiClient): Promise<OpenPosition[]> {
  const net = new Map<string, OpenPosition>();
  const keyId = (oracleId: string, strike: number, isUp: boolean) => `${oracleId}-${strike}-${isUp}`;

  try {
    const minted = await queryRecentEvents(client, `${PREDICT_PACKAGE}::predict::PositionMinted`);
    for (const e of minted) {
      const p = e.parsedJson as any;
      if (p.manager_id !== PREDICT_MANAGER_ID) continue;
      const id = keyId(p.oracle_id, Number(p.strike), Boolean(p.is_up));
      const entry = net.get(id) ?? { oracleId: p.oracle_id, expiry: Number(p.expiry), strike: Number(p.strike), isUp: Boolean(p.is_up), quantity: 0n };
      entry.quantity += BigInt(p.quantity);
      net.set(id, entry);
    }

    const redeemed = await queryRecentEvents(client, `${PREDICT_PACKAGE}::predict::PositionRedeemed`);
    for (const e of redeemed) {
      const p = e.parsedJson as any;
      if (p.manager_id !== PREDICT_MANAGER_ID) continue;
      const id = keyId(p.oracle_id, Number(p.strike), Boolean(p.is_up));
      const entry = net.get(id);
      if (entry) entry.quantity -= BigInt(p.quantity);
    }
  } catch (e: any) {
    log(`Position event query error: ${e.message}`);
  }

  return [...net.values()].filter(p => p.quantity > 0n);
}

// ============================================================
// VAULT TRANSACTIONS
// ============================================================

async function txDeposit(
  client: SuiClient,
  wallet: Ed25519Keypair,
  amount: number
): Promise<string | null> {
  try {
    const addr = wallet.getPublicKey().toSuiAddress();
    const coinId = await getDusdcCoin(client, addr, amount);
    if (!coinId) {
      log(`  No dUSDC found in wallet ${addr.slice(0, 12)}… — skipping deposit`);
      return null;
    }

    const tx = new Transaction();
    tx.setSender(addr);

    const [splitCoin] = tx.splitCoins(tx.object(coinId), [amount]);

    const [shares] = tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::deposit`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(SHARE_TREASURY_ID),
        splitCoin,
      ],
    });
    tx.transferObjects([shares], addr);

    const res = await client.signAndExecuteTransaction({
      signer: wallet,
      transaction: tx,
      options: { showEffects: true },
    });

    if (res.effects?.status?.status === 'success') {
      log(`  ✅ Deposit OK  tx: ${res.digest.slice(0, 22)}…`);
      return res.digest;
    } else {
      log(`  ❌ Deposit FAILED: ${JSON.stringify(res.effects?.status)}`);
      return null;
    }
  } catch (e: any) {
    log(`  ❌ Deposit error: ${e.message}`);
    return null;
  }
}

// Closes/reopens the deposit window around PLP deploys so vault.cash
// reflects true NAV whenever deposit() runs — deposits are rejected
// on-chain while the window is closed (E_DEPOSIT_WINDOW_CLOSED), so this
// is what actually prevents the cash-only NAV approximation from being
// computed against post-deploy cash. Both are operator-only on-chain
// (vault.move asserts ctx.sender() == vault.operator). Each is wrapped so
// a failure here logs and falls through rather than aborting the cycle —
// see runCycle's outer try/catch for why that matters.
async function txCloseDepositWindow(client: SuiClient, operator: Ed25519Keypair): Promise<boolean> {
  try {
    const tx = new Transaction();
    tx.setSender(operator.getPublicKey().toSuiAddress());
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::close_deposit_window`,
      typeArguments: [DUSDC_TYPE],
      arguments: [tx.object(VAULT_ID)],
    });

    const res = await client.signAndExecuteTransaction({
      signer: operator,
      transaction: tx,
      options: { showEffects: true },
    });

    if (res.effects?.status?.status === 'success') {
      log(`  🔒 Deposit window closed  tx: ${res.digest.slice(0, 22)}…`);
      return true;
    }
    log(`  ❌ Close deposit window FAILED: ${JSON.stringify(res.effects?.status)}`);
    return false;
  } catch (e: any) {
    log(`  ❌ Close deposit window error: ${e.message}`);
    return false;
  }
}

async function txOpenDepositWindow(client: SuiClient, operator: Ed25519Keypair): Promise<boolean> {
  try {
    const tx = new Transaction();
    tx.setSender(operator.getPublicKey().toSuiAddress());
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::open_deposit_window`,
      typeArguments: [DUSDC_TYPE],
      arguments: [tx.object(VAULT_ID)],
    });

    const res = await client.signAndExecuteTransaction({
      signer: operator,
      transaction: tx,
      options: { showEffects: true },
    });

    if (res.effects?.status?.status === 'success') {
      log(`  🔓 Deposit window reopened  tx: ${res.digest.slice(0, 22)}…`);
      return true;
    }
    log(`  ❌ Open deposit window FAILED: ${JSON.stringify(res.effects?.status)}`);
    return false;
  } catch (e: any) {
    log(`  ❌ Open deposit window error: ${e.message}`);
    return false;
  }
}

async function txDeployToPlp(
  client: SuiClient,
  operator: Ed25519Keypair,
  amount: number
): Promise<boolean> {
  try {
    const tx = new Transaction();
    tx.setSender(operator.getPublicKey().toSuiAddress());

    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::deploy_to_predict`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_ID),
        tx.object(SUI_CLOCK_ID),
        tx.pure.u64(amount),
      ],
    });

    const res = await client.signAndExecuteTransaction({
      signer: operator,
      transaction: tx,
      options: { showEffects: true },
    });

    if (res.effects?.status?.status === 'success') {
      log(`  ✅ Deploy→PLP (${amount / 1e6} dUSDC)  tx: ${res.digest.slice(0, 22)}…`);
      return true;
    }
    log(`  ❌ Deploy→PLP FAILED: ${JSON.stringify(res.effects?.status)}`);
    return false;
  } catch (e: any) {
    log(`  ❌ Deploy→PLP error: ${e.message}`);
    return false;
  }
}

// Mints an OTM binary put (the "H" in PLP+Hedge) — vault::buy_hedge deposits
// cash_budget into the linked PredictManager and mints `quantity` of a DOWN
// position via predict::mint. isUp=false is the put leg (pays out if BTC
// settles below strike).
async function txBuyHedge(
  client: SuiClient,
  operator: Ed25519Keypair,
  oracleId: string,
  expiry: number,
  strike: bigint,
  quantity: bigint,
  cashBudget: bigint,
): Promise<string | null> {
  try {
    const tx = new Transaction();
    tx.setSender(operator.getPublicKey().toSuiAddress());

    const [key] = tx.moveCall({
      target: `${PREDICT_PACKAGE}::market_key::new`,
      arguments: [
        tx.pure.id(oracleId),
        tx.pure.u64(expiry),
        tx.pure.u64(strike.toString()),
        tx.pure.bool(false),
      ],
    });

    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::buy_hedge`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_ID),
        tx.object(PREDICT_MANAGER_ID),
        tx.object(oracleId),
        key,
        tx.pure.u64(quantity.toString()),
        tx.pure.u64(cashBudget.toString()),
        tx.object(SUI_CLOCK_ID),
      ],
    });

    const res = await client.signAndExecuteTransaction({
      signer: operator,
      transaction: tx,
      options: { showEffects: true },
    });

    if (res.effects?.status?.status === 'success') {
      log(`  ✅ Buy hedge (put) qty ${quantity} budget ${cashBudget}  tx: ${res.digest.slice(0, 22)}…`);
      return res.digest;
    }
    log(`  ❌ Buy hedge FAILED: ${JSON.stringify(res.effects?.status)}`);
    return null;
  } catch (e: any) {
    log(`  ❌ Buy hedge error: ${e.message}`);
    return null;
  }
}

async function txRedeemSettled(
  client: SuiClient,
  operator: Ed25519Keypair,
  pos: OpenPosition
): Promise<string | null> {
  try {
    const tx = new Transaction();
    tx.setSender(operator.getPublicKey().toSuiAddress());

    const [key] = tx.moveCall({
      target: `${PREDICT_PACKAGE}::market_key::new`,
      arguments: [
        tx.pure.id(pos.oracleId),
        tx.pure.u64(pos.expiry),
        tx.pure.u64(pos.strike),
        tx.pure.bool(pos.isUp),
      ],
    });

    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::redeem_settled_hedge_permissionless`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_ID),
        tx.object(PREDICT_MANAGER_ID),
        tx.object(pos.oracleId),
        key,
        tx.pure.u64(pos.quantity.toString()),
        tx.object(SUI_CLOCK_ID),
      ],
    });

    const res = await client.signAndExecuteTransaction({
      signer: operator,
      transaction: tx,
      options: { showEffects: true },
    });

    if (res.effects?.status?.status === 'success') {
      log(`  ✅ Redeem OK   tx: ${res.digest.slice(0, 22)}…`);
      return res.digest;
    }
    log(`  ❌ Redeem FAILED: ${JSON.stringify(res.effects?.status)}`);
    return null;
  } catch (e: any) {
    log(`  ❌ Redeem error: ${e.message}`);
    return null;
  }
}

// ============================================================
// UTILITIES
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

// ============================================================
// INITIAL DEPOSIT PHASE
// ============================================================

interface InitialDeposits {
  digests:   string[]; // STRATA-PH-labeled
  rlDigests: string[]; // STRATA-RL-labeled (wallets 3-5 only, see below)
}

async function initialDepositPhase(
  client: SuiClient,
  lpWallets: Ed25519Keypair[]
): Promise<InitialDeposits> {
  log('\n━━━ INITIAL DEPOSITS ━━━');
  const digests: string[] = [];
  const rlDigests: string[] = [];

  for (let i = 0; i < lpWallets.length; i++) {
    const wallet = lpWallets[i];
    log(`Wallet ${i + 1}/${lpWallets.length} depositing into vault… (STRATA-PH)`);
    const d = await txDeposit(client, wallet, DEPOSIT_AMOUNT_MIST);
    if (d) digests.push(d);
    await sleep(3000);

    // Wallets 3-5 also seed STRATA-RL with a second deposit, so the
    // activity feed shows both strategies live from cycle 0. Same
    // vault::deposit call as above — see CycleEntry.rlDepositDigests.
    if (i >= 2) {
      log(`Wallet ${i + 1}/${lpWallets.length} depositing into vault… (STRATA-RL)`);
      const rd = await txDeposit(client, wallet, DEPOSIT_AMOUNT_MIST);
      if (rd) rlDigests.push(rd);
      await sleep(3000);
    }
  }

  log(`Initial deposits done. ${digests.length} STRATA-PH + ${rlDigests.length} STRATA-RL transactions.`);
  return { digests, rlDigests };
}

// ============================================================
// MAIN CYCLE
// ============================================================

async function runCycle(
  client: SuiClient,
  operator: Ed25519Keypair,
  lpWallets: Ed25519Keypair[],
  cycleNum: number,
  redeemedKeys: Set<string>
): Promise<CycleEntry> {
  log(`\n━━━ CYCLE ${cycleNum} ━━━`);

  const entry: CycleEntry = {
    cycleNumber:        cycleNum,
    timestamp:          ts(),
    btcPrice:           null,
    settledOracleIds:   [],
    redeemedDigests:    [],
    hedgeTriggered:     false,
    deployedToPlp:      false,
    hedgeBoughtDigest:  null,
    hedgeStrike:        null,
    hedgeAskPct:        null,
    hedgeIsAtm:         null,
    testNote:           null,
    depositDigests:     [],
    rlDepositDigests:   [],
    totalTxThisSession: totalTxSoFar(),
    error:              null,
  };

  const operatorAddr = operator.getPublicKey().toSuiAddress();

  try {
    // ── 1. Oracle state ──────────────────────────────────────
    const oracles = await fetchOracles();
    const settled = oracles.filter(o => o.status === 'settled').sort((a, b) => (b.settled_at ?? 0) - (a.settled_at ?? 0));
    if (settled[0]?.settlement_price != null) {
      entry.btcPrice = settled[0].settlement_price / 1e9;
      log(`BTC $${entry.btcPrice.toLocaleString()} (latest settled oracle)`);
    }
    const settledIdSet = new Set(settled.map(o => o.oracle_id));

    // ── 2. Redeem any open hedge positions on settled oracles ─
    const openPositions = await fetchOpenHedgePositions(client);
    const redeemable = openPositions.filter(p => settledIdSet.has(p.oracleId));
    // Only log oracle IDs relevant to our own positions, not the global
    // settled list (thousands of unrelated oracles — would bloat the log).
    entry.settledOracleIds = redeemable.map(p => p.oracleId);

    if (redeemable.length === 0) {
      log('No open hedge positions on settled oracles to redeem.');
    }

    for (const pos of redeemable) {
      const id = `${pos.oracleId}-${pos.strike}-${pos.isUp}`;
      if (redeemedKeys.has(id)) continue;
      log(`Settling position on oracle ${pos.oracleId.slice(0, 18)}… (qty ${pos.quantity})`);
      const d = await txRedeemSettled(client, operator, pos);
      if (d) {
        entry.redeemedDigests.push(d);
        entry.hedgeTriggered = true;
        redeemedKeys.add(id);
      }
      await sleep(2000);
    }

    // ── 3. Staggered LP deposit (one wallet per cycle, round-robin) ─
    // Every 3rd cycle the deposit is labeled STRATA-RL instead of
    // STRATA-PH for the activity feed. Both strategies share the same
    // Vault<DUSDC> object (see CycleEntry.rlDepositDigests) — this is
    // the identical vault::deposit call, just earmarked differently.
    if (cycleNum > 1) { // skip cycle 1 (initial deposits already done)
      const wallet = pick(lpWallets, cycleNum);
      const isRlCycle = cycleNum % 3 === 0;
      const label = isRlCycle ? 'STRATA-RL' : 'STRATA-PH';
      log(`LP ${(cycleNum % lpWallets.length) + 1} depositing into vault… (${label})`);
      const d = await txDeposit(client, wallet, DEPOSIT_AMOUNT_MIST);
      if (d) {
        if (isRlCycle) entry.rlDepositDigests.push(d);
        else entry.depositDigests.push(d);
      }
      await sleep(2000);
    }

    // ── 4-5. Deploy idle cash to PLP, then buy a hedge with a reserved
    // slice of the same cash ──────────────────────────────────────────
    // Window closes before any cash leaves the vault and stays closed
    // until BOTH the PLP deploy and the hedge buy are done, so deposit()
    // never prices new shares against partially-spent cash. Each window
    // call is independently try/caught (see txCloseDepositWindow/
    // txOpenDepositWindow) — a failure here logs and falls through
    // rather than aborting the cycle.
    //
    // The hedge budget is reserved as a fraction of total cash BEFORE
    // depositing to PLP, rather than re-reading whatever happens to be
    // left over after a fixed-size deploy. That matters for the same
    // reason the deploy amount does: vault::deposit()'s share price is
    // amount_in * total_supply / cash, with a safe 1:1 fallback only
    // when cash == 0. Deploying a fixed chunk and then spending some
    // fraction of the remainder leaves a small nonzero cash dust either
    // way, and every deposit against that dust mints disproportionately
    // many shares — compounding cycle over cycle. Deploy + hedge buy
    // together consuming ~all of current cash keeps landing on the safe
    // 0 instead.
    // No minimum threshold on the deploy trigger (just cash > 0) — this is
    // what actually closes the gap. With a per-cycle deposit smaller than
    // a fixed threshold, cash crosses the threshold only every other
    // deposit, so every other deposit lands on a nonzero, growing cash
    // balance and gets mispriced anyway. Confirmed on-chain: the very
    // first fresh-vault test run hit exactly this, alternating clean
    // (nav_before == 0) and inflated (nav_before == prior deposit's
    // leftover cash) ratios every other deposit. Deploying anything
    // nonzero, every cycle, removes the gap entirely.
    const cash = await getVaultCash(client, operatorAddr);
    if (cash > 0n) {
      await txCloseDepositWindow(client, operator);
      await sleep(2000);

      // Everything between close and open is wrapped in try/finally —
      // if ANYTHING here throws (a devInspect blip, a bad oracle quote,
      // whatever), the window must still reopen. Without this, an
      // uncaught exception mid-cycle leaves deposit_window_open stuck
      // false forever: the next cycle only re-closes/reopens when
      // cash > 0, but cash is already drained from this cycle's deploy,
      // so that recovery path never fires again on its own. Hit exactly
      // this in production — had to manually reopen the window after a
      // verification run got killed mid-cycle.
      try {
        const cashToDeploy = await getVaultCash(client, operatorAddr);
        const { hedgeRatioBps, strikeOffsetBps: configStrikeOffsetBps } = await getStrategyConfig(client, operatorAddr);
        const hedgeBudget = (cashToDeploy * hedgeRatioBps) / 10000n;
        const plpAmount = cashToDeploy - hedgeBudget;

        if (plpAmount > 0n) {
          log(`Vault cash ${cashToDeploy} ≥ deploy threshold — deploying ${Number(plpAmount) / 1e6} dUSDC to PLP, reserving ${Number(hedgeBudget) / 1e6} dUSDC for hedge…`);
          entry.deployedToPlp = await txDeployToPlp(client, operator, Number(plpAmount));
          await sleep(2000);
        }

        // The "H" in PLP+Hedge. Only runs right after a PLP deploy, mirroring
        // the strategy thesis: each cycle that puts cash to work in PLP also
        // buys crash insurance sized off the same NAV slice.
        if (entry.deployedToPlp && hedgeBudget > 0n) {
          const candidates = listLiveOracles(oracles);
          if (candidates.length === 0) {
            log('No live oracle available — skipping hedge mint this cycle.');
          } else {
            const strikeOffsetBps = HEDGE_STRIKE_OFFSET_OVERRIDE_BPS ?? configStrikeOffsetBps;
            if (HEDGE_STRIKE_OFFSET_OVERRIDE_BPS !== null) {
              log(`  ⚠️  TEMPORARY: strike offset overridden to ${HEDGE_STRIKE_OFFSET_OVERRIDE_BPS} bps (config says ${configStrikeOffsetBps}) to force a near-term settlement.`);
            }
            const quote = await findHedgeQuote(client, operatorAddr, candidates, strikeOffsetBps, hedgeBudget);
            if (!quote) {
              log('No oracle/strike combination priced a mintable OTM put this cycle — skipping.');
            } else {
              const askPct = Number(quote.askPerUnit) / Number(FLOAT_SCALING) * 100;
              // Ask price near 50% means the strike landed at-the-money (the offset
              // search bottomed out, or an override forced it) rather than the
              // intended deep-OTM hedge — worth flagging distinctly in the log.
              const isAtm = askPct >= 40 && askPct <= 60;
              log(`Buying put: oracle ${quote.oracle.oracle_id.slice(0, 18)}… strike ${quote.strike} (ask ${askPct.toFixed(2)}%, ${isAtm ? 'ATM' : 'OTM'}) qty ${quote.quantity} budget ${hedgeBudget}`);
              entry.hedgeBoughtDigest = await txBuyHedge(client, operator, quote.oracle.oracle_id, quote.oracle.expiry, quote.strike, quote.quantity, hedgeBudget);
              entry.hedgeStrike = Number(quote.strike) / Number(FLOAT_SCALING);
              entry.hedgeAskPct = askPct;
              entry.hedgeIsAtm = isAtm;
              if (HEDGE_STRIKE_OFFSET_OVERRIDE_BPS !== null) {
                entry.testNote = 'Test settlement: ATM strike override';
              }
              await sleep(2000);
            }
          }
        }
      } finally {
        await txOpenDepositWindow(client, operator);
        await sleep(2000);
      }
    } else {
      log(`Vault cash is 0 — nothing to deploy this cycle.`);
    }

  } catch (e: any) {
    entry.error = e.message;
    log(`Cycle ${cycleNum} fatal error: ${e.message}`);
  }

  entry.totalTxThisSession = totalTxSoFar() +
    entry.redeemedDigests.length +
    entry.depositDigests.length +
    entry.rlDepositDigests.length +
    (entry.deployedToPlp ? 1 : 0) +
    (entry.hedgeBoughtDigest ? 1 : 0);

  appendCycleLog(entry);

  const txThisCycle =
    entry.redeemedDigests.length + entry.depositDigests.length + entry.rlDepositDigests.length +
    (entry.deployedToPlp ? 1 : 0) + (entry.hedgeBoughtDigest ? 1 : 0);

  log(`Cycle ${cycleNum} done | txs this cycle: ${txThisCycle} | total so far: ${entry.totalTxThisSession}`);
  if (entry.hedgeTriggered) log('  🚨 HEDGE SETTLED — positions redeemed');
  if (entry.hedgeBoughtDigest) log('  🛡️  HEDGE BOUGHT — OTM put minted');
  if (entry.rlDepositDigests.length > 0) log('  📊 STRATA-RL deposit recorded');

  return entry;
}

// ============================================================
// ENTRY POINT
// ============================================================

async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║     Strata Marathon Bot  🏃             ║
║     Sui Testnet — Continuous Cycles     ║
╚══════════════════════════════════════════╝
`);

  // Validate config
  const required: Record<string, string> = {
    STRATA_PACKAGE_ID: STRATA_PACKAGE,
    PREDICT_PACKAGE_ID: PREDICT_PACKAGE,
    VAULT_ID,
    SHARE_TREASURY_ID,
    PREDICT_MANAGER_ID,
    PREDICT_ID,
    DUSDC_COIN_TYPE: DUSDC_TYPE,
    OPERATOR_PRIVATE_KEY: OPERATOR_KEY,
  };
  for (const [name, value] of Object.entries(required)) {
    if (!value) {
      console.error(`ERROR: Set ${name} in .env before running.`);
      process.exit(1);
    }
  }

  const client = new SuiClient({ url: getFullnodeUrl('testnet') });
  const operator = Ed25519Keypair.fromSecretKey(OPERATOR_KEY);
  log(`Operator: ${operator.getPublicKey().toSuiAddress()}`);

  const lpWallets = loadOrCreateWallets();
  await ensureFunded(client, operator, lpWallets);

  // Self-heal: if a previous run was killed mid-cycle (between closing
  // and reopening the window — e.g. SIGKILL, which no try/finally can
  // catch), deposit_window_open is stuck false with no other recovery
  // path, since the cycle's own close/open logic only runs when
  // cash > 0, and cash is already drained by the time this happens.
  // Safe to force open here: startup is never itself mid-deploy.
  const operatorAddr = operator.getPublicKey().toSuiAddress();
  if (!(await getDepositWindowOpen(client, operatorAddr))) {
    log('⚠️  Deposit window was left closed (likely an interrupted prior run) — reopening…');
    await txOpenDepositWindow(client, operator);
    await sleep(2000);
  }

  const redeemedKeys = new Set<string>();
  let cycleNum = 1;

  // Initial deposits on first run
  const isFirstRun = !fs.existsSync(LOG_PATH);
  if (isFirstRun) {
    const { digests, rlDigests } = await initialDepositPhase(client, lpWallets);
    appendCycleLog({
      cycleNumber:        0,
      timestamp:          ts(),
      btcPrice:           null,
      settledOracleIds:   [],
      redeemedDigests:    [],
      hedgeTriggered:     false,
      deployedToPlp:      false,
      hedgeBoughtDigest:  null,
      hedgeStrike:        null,
      hedgeAskPct:        null,
      hedgeIsAtm:         null,
      testNote:           null,
      depositDigests:     digests,
      rlDepositDigests:   rlDigests,
      totalTxThisSession: digests.length + rlDigests.length,
      error:              null,
    });
  }

  log(`\n🔄 Starting cycle loop every ${CYCLE_INTERVAL_MS / 60000} min…`);
  log('   Press Ctrl+C to stop. cycle-log.json updates after every cycle.\n');

  // Run immediately, then on interval
  while (true) {
    await runCycle(client, operator, lpWallets, cycleNum++, redeemedKeys);
    log(`Next cycle in ${CYCLE_INTERVAL_MS / 60000} minutes…`);
    await sleep(CYCLE_INTERVAL_MS);
  }
}

main().catch(e => {
  console.error('Fatal crash:', e);
  process.exit(1);
});
