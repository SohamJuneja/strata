"use client";

import { useVaultState, useShareSupply } from "@/lib/hooks/useVaultState";
import { DUSDC_DECIMALS, SHARE_DECIMALS } from "@/lib/constants";

function formatToken(value: bigint | undefined, decimals: number, fractionDigits = 2): string {
  if (value === undefined || value === null) return "—";
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fracStr = (Number(fraction) / Number(divisor)).toFixed(fractionDigits).slice(2);
  return `${whole.toString()}.${fracStr}`;
}

export function VaultNAVHero() {
  const { data: state } = useVaultState();
  const { data: supply } = useShareSupply();
  const nav = state ? `$${formatToken(state.cash + state.plpBalance, DUSDC_DECIMALS)}` : "—";
  const supplyStr = supply !== undefined ? formatToken(supply, SHARE_DECIMALS) : "—";
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Current NAV</p>
      <p className="mt-3 font-mono text-5xl lg:text-6xl tabular-nums text-ink">{nav}</p>
      <p className="mt-2 font-mono text-xs text-ink-muted">{supplyStr} shares outstanding</p>
    </>
  );
}

export function PositionStateRow() {
  const { data: state } = useVaultState();
  const cash = state ? `$${formatToken(state.cash, DUSDC_DECIMALS)}` : "—";
  const plp = state ? formatToken(state.plpBalance, SHARE_DECIMALS) : "—";
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Cash</p>
        <p className="mt-3 font-mono text-3xl tabular-nums text-ink">{cash}</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">undeployed dUSDC</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">PLP Holdings</p>
        <p className="mt-3 font-mono text-3xl tabular-nums text-ink">{plp}</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">Predict vault shares</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Active Hedge</p>
        <p className="mt-3 font-mono text-3xl tabular-nums text-ink-muted">none</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">opens after next deploy</p>
      </div>
    </div>
  );
}

export function PositionStateRowStrategyNeutral() {
  const { data: state } = useVaultState();
  const cash = state ? `$${formatToken(state.cash, DUSDC_DECIMALS)}` : "—";
  const deployed = state ? formatToken(state.plpBalance, SHARE_DECIMALS) : "—";
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Cash</p>
        <p className="mt-3 font-mono text-3xl tabular-nums text-ink">{cash}</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">undeployed dUSDC</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Deployed Capital</p>
        <p className="mt-3 font-mono text-3xl tabular-nums text-ink">{deployed}</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">On Predict (PLP and/or ranges)</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Active Positions</p>
        <p className="mt-3 font-mono text-3xl tabular-nums text-ink-muted">none</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">binaries or ranges from latest cycle</p>
      </div>
    </div>
  );
}

// V2 reads on-chain position state directly; V1 infers from vault cash/PLP balance.
export function CycleStatusBadge({ strategyLabel }: { strategyLabel: string }) {
  const { data: state } = useVaultState();
  let cycleStatus = "Idle";
  if (state) {
    if (state.plpBalance > 0n) {
      cycleStatus = "PLP+Hedge active";
    } else if (state.predictManagerId) {
      cycleStatus = "Range Ladder active or settling";
    }
  }
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Strategy: {strategyLabel}</p>
      <p className="mt-1 font-mono text-xs text-ink-secondary">Last cycle: {cycleStatus}</p>
    </div>
  );
}

export function HomepageStatsRow() {
  const { data: state } = useVaultState();
  const { data: supply } = useShareSupply();
  const nav = state ? `$${formatToken(state.cash + state.plpBalance, DUSDC_DECIMALS, 0)}` : "—";
  const shares = supply !== undefined ? formatToken(supply, SHARE_DECIMALS, 0) : "—";
  return (
    <div className="grid grid-cols-3 gap-6 lg:gap-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">NAV</p>
        <p className="mt-3 font-mono text-3xl lg:text-4xl tabular-nums text-ink">{nav}</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Shares</p>
        <p className="mt-3 font-mono text-3xl lg:text-4xl tabular-nums text-ink">{shares}</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Hedge Ratio</p>
        <p className="mt-3 font-mono text-3xl lg:text-4xl tabular-nums text-ink">10%</p>
      </div>
    </div>
  );
}