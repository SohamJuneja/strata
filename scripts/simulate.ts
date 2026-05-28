import { readFileSync, writeFileSync } from "node:fs";

const CONFIG = {
  initialVaultUsd: 1000,
  plpApy: 0.20,
  hedgePremiumBpsWeekly: 30,
  hedgePayoffPctOfNav: 0.02,
  hedgeStrikeOffsetBps: 500,
  plpDrawdownBeta: 0.6,
};

function simulate(closes, cfg) {
  const wYield = cfg.plpApy / 52;
  const wPrem = cfg.hedgePremiumBpsWeekly / 10000;
  const strike = cfg.hedgeStrikeOffsetBps / 10000;
  const out = [];
  let vault = cfg.initialVaultUsd;
  let rawPlp = cfg.initialVaultUsd;

  for (let i = 1; i < closes.length; i++) {
    const delta = (closes[i].close - closes[i - 1].close) / closes[i - 1].close;
    const plpYield = wYield;
    const hedgeCost = -wPrem;
    const hedgePayoff = delta < -strike ? cfg.hedgePayoffPctOfNav : 0;
    const plpLoss = delta < -0.03 ? -Math.abs(delta) * cfg.plpDrawdownBeta : 0;
    const net = plpYield + hedgeCost + hedgePayoff + plpLoss;
    vault = vault * (1 + net);

    const rawNet = wYield + (delta < -0.03 ? -Math.abs(delta) * cfg.plpDrawdownBeta : 0);
    rawPlp = rawPlp * (1 + rawNet);

    out.push({
      week: i,
      date: closes[i].date,
      spotClose: closes[i].close,
      deltaPct: delta * 100,
      plpYieldPct: plpYield * 100,
      hedgeCostPct: hedgeCost * 100,
      hedgePayoffPct: hedgePayoff * 100,
      plpLossPct: plpLoss * 100,
      netPct: net * 100,
      vault: vault,
      rawPlpVault: rawPlp,
    });
  }
  return out;
}

function tableMd(results) {
  const lines = [];
  lines.push("| Wk | Date | BTC | Delta% | PLP | Hedge | Payoff | PLP Loss | Net% |");
  lines.push("|---:|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of results) {
    lines.push([
      r.week,
      r.date,
      r.spotClose.toFixed(0),
      r.deltaPct.toFixed(2),
      r.plpYieldPct.toFixed(3),
      r.hedgeCostPct.toFixed(3),
      r.hedgePayoffPct.toFixed(3),
      r.plpLossPct.toFixed(3),
      r.netPct.toFixed(3),
    ].join(" | "));
  }
  return lines.join("\n");
}

function summary(results, init) {
  const last = results[results.length - 1];
  return {
    hedged: ((last.vault - init) / init) * 100,
    rawPlp: ((last.rawPlpVault - init) / init) * 100,
  };
}

const data = JSON.parse(readFileSync("data/btc-historical.json", "utf-8"));

const md = [];
md.push("# Simulation Output");
md.push("");
md.push("Generated: " + new Date().toISOString());
md.push("");
md.push("## Config");
md.push("");
md.push("```json");
md.push(JSON.stringify(CONFIG, null, 2));
md.push("```");
md.push("");

for (const key of Object.keys(data)) {
  const period = data[key];
  console.log("\n### " + period.label + "\n");
  md.push("");
  md.push("## " + period.label);
  md.push("");
  const results = simulate(period.weekly, CONFIG);
  const s = summary(results, CONFIG.initialVaultUsd);
  console.log(tableMd(results));
  console.log("\nFinal: Raw PLP " + s.rawPlp.toFixed(2) + "% | PLP+Hedge " + s.hedged.toFixed(2) + "% | Delta " + (s.hedged - s.rawPlp).toFixed(2) + "%\n");
  md.push(tableMd(results));
  md.push("");
  md.push("**Summary**: Raw PLP **" + s.rawPlp.toFixed(2) + "%** | PLP+Hedge **" + s.hedged.toFixed(2) + "%** | Delta **" + (s.hedged - s.rawPlp).toFixed(2) + "%**");
  md.push("");
}

writeFileSync("docs/research/simulation-output.md", md.join("\n"));
console.log("\nWrote docs/research/simulation-output.md");