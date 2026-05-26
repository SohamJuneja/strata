"use client";

import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { DUSDC_DECIMALS, DUSDC_TYPE, PREDICT_ID, SHARE_DECIMALS, STRATA_PACKAGE, SUI_CLOCK_OBJECT_ID, VAULT_ID } from "@/lib/constants";
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

function DeployToPredict() {
  const { run, status, message } = useAction();
  const [amount, setAmount] = useState("");

  function deploy() {
    const amountUnits = parseAmount(amount, DUSDC_DECIMALS);
    if (amountUnits === null || amountUnits <= 0n) return;
    const tx = new Transaction();
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::deploy_to_predict`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_ID),
        tx.object(SUI_CLOCK_OBJECT_ID),
        tx.pure.u64(amountUnits),
      ],
    });
    run(tx, "Deploy to PLP");
  }

  return (
    <div className="border border-border bg-paper-raised p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-4">Deploy Cash to PLP</p>
      <p className="font-mono text-xs text-ink-muted mb-4">Calls predict::supply with the chosen amount. Mints PLP into the vault.</p>
      <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3 mb-4">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-transparent font-mono text-lg tabular-nums text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <span className="font-mono text-sm text-ink-secondary">dUSDC</span>
      </div>
      <button type="button" onClick={deploy} disabled={status === "signing"} className="w-full bg-accent text-paper py-3 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50">
        {status === "signing" ? "Signing..." : "Deploy to PLP"}
      </button>
      {message && <p className={`mt-4 font-mono text-xs ${status === "error" ? "text-negative" : "text-positive"}`}>{message}</p>}
    </div>
  );
}

function RedeemFromPredict() {
  const { run, status, message } = useAction();
  const [amount, setAmount] = useState("");

  function redeem() {
    const amountUnits = parseAmount(amount, SHARE_DECIMALS);
    if (amountUnits === null || amountUnits <= 0n) return;
    const tx = new Transaction();
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::redeem_from_predict`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_ID),
        tx.object(SUI_CLOCK_OBJECT_ID),
        tx.pure.u64(amountUnits),
      ],
    });
    run(tx, "Redeem from PLP");
  }

  return (
    <div className="border border-border bg-paper-raised p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-4">Redeem PLP to Cash</p>
      <p className="font-mono text-xs text-ink-muted mb-4">Calls predict::withdraw with the chosen PLP amount. Returns quote into vault cash.</p>
      <div className="flex items-center gap-3 border border-border bg-paper px-4 py-3 mb-4">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-transparent font-mono text-lg tabular-nums text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <span className="font-mono text-sm text-ink-secondary">PLP</span>
      </div>
      <button type="button" onClick={redeem} disabled={status === "signing"} className="w-full bg-accent text-paper py-3 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50">
        {status === "signing" ? "Signing..." : "Redeem from PLP"}
      </button>
      {message && <p className={`mt-4 font-mono text-xs ${status === "error" ? "text-negative" : "text-positive"}`}>{message}</p>}
    </div>
  );
}

export function OperatorControls() {
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
      <DeployToPredict />
      <RedeemFromPredict />
    </div>
  );
}