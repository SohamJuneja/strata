"use client";

import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import {
  DUSDC_DECIMALS,
  DUSDC_TYPE,
  PREDICT_ID,
  PREDICT_MANAGER_ID,
  SHARE_DECIMALS,
  STRATA_PACKAGE,
  SUI_CLOCK_OBJECT_ID,
  VAULT_ID,
} from "@/lib/constants";
import { useVaultState } from "@/lib/hooks/useVaultState";

type Status = "idle" | "signing" | "success" | "error";

function parseAmount(input: string, decimals: number): bigint | null {
  if (!input || input.trim() === "") return null;
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const fractionPadded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fractionPadded || "0");
  } catch {
    return null;
  }
}

// BCS encode a RangeKey struct: oracle_id (ID = 32-byte address) + expiry u64 + lower_strike u64 + higher_strike u64.
// RangeKey has copy, drop, store — layout confirmed from deepbook_predict::range_key source.
function buildRangeKeyBcs(rangeKeyHex: string): Uint8Array | null {
  const hex = rangeKeyHex.replace(/^0x/, "").replace(/\s/g, "");
  if (hex.length !== 112) return null; // 56 bytes = 112 hex chars
  const bytes = new Uint8Array(56);
  for (let i = 0; i < 56; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

function useAction() {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function run(tx: Transaction, label: string) {
    setStatus("signing");
    setMessage(null);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          setStatus("success");
          setMessage(`${label} confirmed. ${result.digest.slice(0, 10)}...`);
        },
        onError: (err) => {
          setStatus("error");
          setMessage(err.message);
        },
      },
    );
  }
  return { run, status, message };
}

function WindowControl() {
  const { data: vaultState } = useVaultState();
  const { run, status, message } = useAction();
  const windowOpen = vaultState?.depositWindowOpen ?? false;

  function toggle() {
    const tx = new Transaction();
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::${windowOpen ? "close_deposit_window" : "open_deposit_window"}`,
      typeArguments: [DUSDC_TYPE],
      arguments: [tx.object(VAULT_ID)],
    });
    run(tx, windowOpen ? "Close window" : "Open window");
  }

  return (
    <div className="border border-border bg-paper-raised p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-4">Deposit Window</p>
      <div className="flex items-center justify-between gap-4">
        <span className={`font-mono text-sm uppercase tracking-widest ${windowOpen ? "text-positive" : "text-negative"}`}>{windowOpen ? "Open" : "Closed"}</span>
        <button type="button" onClick={toggle} disabled={status === "signing"} className="bg-accent text-paper px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50">
          {status === "signing" ? "Signing..." : windowOpen ? "Close Window" : "Open Window"}
        </button>
      </div>
      {message && <p className={`mt-4 font-mono text-xs ${status === "error" ? "text-negative" : "text-positive"}`}>{message}</p>}
    </div>
  );
}

function MintRangePosition() {
  const { run, status, message } = useAction();
  const [quantity, setQuantity] = useState("");
  const [cashBudget, setCashBudget] = useState("");
  const [oracleSviId, setOracleSviId] = useState("");
  const [rangeKeyHex, setRangeKeyHex] = useState("");

  function mint() {
    const quantityUnits = parseAmount(quantity, SHARE_DECIMALS);
    const cashUnits = parseAmount(cashBudget, DUSDC_DECIMALS);
    const keyBytes = buildRangeKeyBcs(rangeKeyHex);
    if (!quantityUnits || quantityUnits <= 0n) return;
    if (!cashUnits || cashUnits <= 0n) return;
    if (!keyBytes) return;
    if (!oracleSviId.trim()) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::mint_range_position`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_ID),
        tx.object(PREDICT_MANAGER_ID),
        tx.object(oracleSviId.trim()),
        tx.pure(keyBytes),
        tx.pure.u64(quantityUnits),
        tx.pure.u64(cashUnits),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    run(tx, "Mint range position");
  }

  const keyValid = rangeKeyHex.replace(/^0x/, "").replace(/\s/g, "").length === 112;

  return (
    <div className="border border-border bg-paper-raised p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-4">Mint Range Position</p>
      <p className="font-mono text-xs text-ink-muted mb-4">Calls vault::mint_range_position. Deposits cash into manager, mints a vertical range via predict::mint_range.</p>
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" inputMode="decimal" placeholder="OracleSVI object ID (0x...)" value={oracleSviId} onChange={(e) => setOracleSviId(e.target.value)} className="flex-1 bg-transparent font-mono text-sm text-ink placeholder:text-ink-muted focus:outline-none" />
        </div>
        <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" placeholder="RangeKey hex (56 bytes = 112 hex chars, from CLI)" value={rangeKeyHex} onChange={(e) => setRangeKeyHex(e.target.value)} className="flex-1 bg-transparent font-mono text-xs text-ink placeholder:text-ink-muted focus:outline-none" />
          {rangeKeyHex && <span className={`font-mono text-xs ${keyValid ? "text-positive" : "text-negative"}`}>{keyValid ? "ok" : "need 112 hex chars"}</span>}
        </div>
        <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" inputMode="decimal" placeholder="0.00" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="flex-1 bg-transparent font-mono text-lg tabular-nums text-ink placeholder:text-ink-muted focus:outline-none" />
          <span className="font-mono text-sm text-ink-secondary">PLP (quantity)</span>
        </div>
        <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" inputMode="decimal" placeholder="0.00" value={cashBudget} onChange={(e) => setCashBudget(e.target.value)} className="flex-1 bg-transparent font-mono text-lg tabular-nums text-ink placeholder:text-ink-muted focus:outline-none" />
          <span className="font-mono text-sm text-ink-secondary">dUSDC (budget)</span>
        </div>
      </div>
      <button type="button" onClick={mint} disabled={status === "signing"} className="w-full bg-accent text-paper py-3 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50">
        {status === "signing" ? "Signing..." : "Mint Range Position"}
      </button>
      {message && <p className={`mt-4 font-mono text-xs ${status === "error" ? "text-negative" : "text-positive"}`}>{message}</p>}
    </div>
  );
}

function RedeemRangePosition() {
  const { run, status, message } = useAction();
  const [quantity, setQuantity] = useState("");
  const [oracleSviId, setOracleSviId] = useState("");
  const [rangeKeyHex, setRangeKeyHex] = useState("");

  function redeem() {
    const quantityUnits = parseAmount(quantity, SHARE_DECIMALS);
    const keyBytes = buildRangeKeyBcs(rangeKeyHex);
    if (!quantityUnits || quantityUnits <= 0n) return;
    if (!keyBytes) return;
    if (!oracleSviId.trim()) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::redeem_range_position`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_ID),
        tx.object(PREDICT_MANAGER_ID),
        tx.object(oracleSviId.trim()),
        tx.pure(keyBytes),
        tx.pure.u64(quantityUnits),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    run(tx, "Redeem range position");
  }

  const keyValid = rangeKeyHex.replace(/^0x/, "").replace(/\s/g, "").length === 112;

  return (
    <div className="border border-border bg-paper-raised p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-4">Redeem Range Position</p>
      <p className="font-mono text-xs text-ink-muted mb-4">Calls vault::redeem_range_position. Settles range via predict::redeem_range and sweeps quote back to vault cash.</p>
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" placeholder="OracleSVI object ID (0x...)" value={oracleSviId} onChange={(e) => setOracleSviId(e.target.value)} className="flex-1 bg-transparent font-mono text-sm text-ink placeholder:text-ink-muted focus:outline-none" />
        </div>
        <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" placeholder="RangeKey hex (56 bytes = 112 hex chars, from CLI)" value={rangeKeyHex} onChange={(e) => setRangeKeyHex(e.target.value)} className="flex-1 bg-transparent font-mono text-xs text-ink placeholder:text-ink-muted focus:outline-none" />
          {rangeKeyHex && <span className={`font-mono text-xs ${keyValid ? "text-positive" : "text-negative"}`}>{keyValid ? "ok" : "need 112 hex chars"}</span>}
        </div>
        <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" inputMode="decimal" placeholder="0.00" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="flex-1 bg-transparent font-mono text-lg tabular-nums text-ink placeholder:text-ink-muted focus:outline-none" />
          <span className="font-mono text-sm text-ink-secondary">PLP (quantity)</span>
        </div>
      </div>
      <button type="button" onClick={redeem} disabled={status === "signing"} className="w-full bg-accent text-paper py-3 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50">
        {status === "signing" ? "Signing..." : "Redeem Range Position"}
      </button>
      {message && <p className={`mt-4 font-mono text-xs ${status === "error" ? "text-negative" : "text-positive"}`}>{message}</p>}
    </div>
  );
}

export function RangeLadderOperatorControls() {
  const account = useCurrentAccount();
  const { data: vaultState, isLoading } = useVaultState();

  if (!account) {
    return <p className="text-ink-muted font-mono text-sm">Connect your wallet to access operator controls.</p>;
  }
  if (isLoading || !vaultState) {
    return <p className="text-ink-muted font-mono text-sm">Loading vault state...</p>;
  }

  const isOperator = account.address.toLowerCase() === vaultState.operator.toLowerCase();

  if (!isOperator) {
    return (
      <div className="border border-border bg-paper-raised p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-negative mb-3">Not authorized</p>
        <p className="text-ink-secondary mb-6">Only the vault operator can access these controls.</p>
        <p className="font-mono text-xs text-ink-muted">Connected: {account.address.slice(0, 10)}...{account.address.slice(-8)}</p>
        <p className="font-mono text-xs text-ink-muted">Operator: {vaultState.operator.slice(0, 10)}...{vaultState.operator.slice(-8)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WindowControl />
      <MintRangePosition />
      <RedeemRangePosition />
    </div>
  );
}
