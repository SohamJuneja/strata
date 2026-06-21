import { PREDICT_SERVER_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Confirmed against the live predict-server response: settlement_price is
// a fixed-point integer scaled by 1e9, and oracles settle on a steady
// 15-minute cadence (4/hour) — both checked directly against
// https://predict-server.testnet.mystenlabs.com/oracles before writing this.
const PRICE_SCALE = 1e9;
const ORACLES_PER_HOUR = 4;
const ANNUALIZATION_FACTOR = Math.sqrt(365 * 24 * ORACLES_PER_HOUR);
const STRIKE_OFFSET_PCT = 5; // Strata's typical 5% OTM hedge strike

const DAY_MS = 24 * 60 * 60 * 1000;

interface RawOracle {
  oracle_id: string;
  status: "settled" | "active";
  settlement_price: number | null;
  settled_at: number | null;
  expiry: number;
}

interface SettlementPoint {
  oracleId: string;
  settledAt: string;
  price: number;
  expiryMs: number;
}

type HedgeAssessment = "CHEAP" | "FAIR" | "EXPENSIVE";

interface VolatilityResponse {
  settledCount: number;
  activeCount: number;
  settlementPrices: SettlementPoint[];
  realizedVol7d: number | null;
  realizedVol30d: number | null;
  currentAskPct: number | null;
  impliedVolEstimate: number | null;
  hedgeAssessment: HedgeAssessment;
  hedgeAssessmentReason: string;
}

function sampleStddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// points must be sorted ascending by settledAt.
function realizedVol(points: SettlementPoint[], windowMs: number, nowMs: number): number | null {
  const inWindow = points.filter((p) => nowMs - new Date(p.settledAt).getTime() <= windowMs);
  if (inWindow.length < 3) return null;

  const logReturns: number[] = [];
  for (let i = 1; i < inWindow.length; i++) {
    logReturns.push(Math.log(inWindow[i].price / inWindow[i - 1].price));
  }

  return sampleStddev(logReturns) * ANNUALIZATION_FACTOR * 100;
}

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${PREDICT_SERVER_URL}/oracles`, { cache: "no-store" });
    if (!res.ok) {
      return Response.json({ error: `predict-server returned ${res.status}` }, { status: 502 });
    }
    const oracles = (await res.json()) as RawOracle[];

    const settled = oracles
      .filter((o) => o.status === "settled" && o.settlement_price != null && o.settled_at != null)
      .sort((a, b) => (a.settled_at as number) - (b.settled_at as number));
    const active = oracles.filter((o) => o.status === "active");

    const allSettlementPoints: SettlementPoint[] = settled.map((o) => ({
      oracleId: o.oracle_id,
      settledAt: new Date(o.settled_at as number).toISOString(),
      price: (o.settlement_price as number) / PRICE_SCALE,
      expiryMs: o.expiry,
    }));

    const now = Date.now();
    const realizedVol7d = realizedVol(allSettlementPoints, 7 * DAY_MS, now);
    const realizedVol30d = realizedVol(allSettlementPoints, 30 * DAY_MS, now);

    // The predict-server /oracles endpoint does not expose an ask or
    // probability field on active oracles — verified directly against the
    // live response (all active entries share the same key set: predict_id,
    // oracle_id, oracle_cap_id, underlying_asset, expiry, min_strike,
    // tick_size, status, activated_at, settlement_price, settled_at,
    // created_checkpoint). Live option pricing only exists on-chain via
    // devInspectTransactionBlock (see marathon-bot/index.ts getAskBounds),
    // which this REST-only route doesn't call. Left null per spec.
    const currentAskPct: number | null = null;

    const impliedVolEstimate: number | null =
      currentAskPct !== null
        ? (currentAskPct / 100 / (STRIKE_OFFSET_PCT / 100)) * ANNUALIZATION_FACTOR * 100
        : null;

    let hedgeAssessment: HedgeAssessment = "FAIR";
    let hedgeAssessmentReason = "Insufficient data to assess";

    if (impliedVolEstimate !== null && realizedVol30d !== null) {
      if (impliedVolEstimate > realizedVol30d * 1.2) {
        hedgeAssessment = "EXPENSIVE";
        hedgeAssessmentReason =
          "Implied vol is running above 30-day realized — options are pricing in more risk than history suggests";
      } else if (impliedVolEstimate < realizedVol30d * 0.8) {
        hedgeAssessment = "CHEAP";
        hedgeAssessmentReason =
          "Implied vol is below 30-day realized — hedge protection is cheaper than historical norms";
      } else {
        hedgeAssessment = "FAIR";
        hedgeAssessmentReason = "Implied vol is in line with recent realized volatility";
      }
    }

    // Scoped to the 30-day realized-vol window — large enough to cover the
    // "last 20" history table plus the data the vol numbers above were
    // computed from, without shipping all ~4700 settled oracles on every poll.
    const settlementPrices = allSettlementPoints.filter(
      (p) => now - new Date(p.settledAt).getTime() <= 30 * DAY_MS
    );

    const response: VolatilityResponse = {
      settledCount: settled.length,
      activeCount: active.length,
      settlementPrices,
      realizedVol7d,
      realizedVol30d,
      currentAskPct,
      impliedVolEstimate,
      hedgeAssessment,
      hedgeAssessmentReason,
    };

    return Response.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
