import { writeFileSync, mkdirSync } from "node:fs";

interface PricePoint {
  date: string;
  close: number;
}

interface Period {
  label: string;
  start: string;
  end: string;
}

const PERIODS: Record<string, Period> = {
  calm: {
    label: "Calm uptrend (Q3 2024)",
    start: "2024-07-01",
    end: "2024-09-30",
  },
  recovery: {
    label: "Recovery from drawdown (Q2 2024 post-halving)",
    start: "2024-04-01",
    end: "2024-06-30",
  },
  drawdown: {
    label: "Sustained drawdown (Q2 2022 Terra/Luna collapse)",
    start: "2022-04-01",
    end: "2022-06-30",
  },
};

async function fetchWeekly(start: string, end: string): Promise<PricePoint[]> {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&startTime=${startMs}&endTime=${endMs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance error ${res.status}: ${await res.text()}`);
  const raw = (await res.json()) as [number, string, string, string, string, ...unknown[]][];
  return raw.map((d) => ({
    date: new Date(d[0]).toISOString().slice(0, 10),
    close: parseFloat(d[4]),
  }));
}

async function main() {
  const out: Record<string, { label: string; weekly: PricePoint[] }> = {};
  for (const [key, period] of Object.entries(PERIODS)) {
    console.log(`Fetching ${period.label}...`);
    const weekly = await fetchWeekly(period.start, period.end);
    out[key] = { label: period.label, weekly };
    console.log(`  ${weekly.length} weekly closes from ${weekly[0]?.date} to ${weekly[weekly.length - 1]?.date}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  mkdirSync("data", { recursive: true });
  writeFileSync("data/btc-historical.json", JSON.stringify(out, null, 2));
  console.log("\nWrote data/btc-historical.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});