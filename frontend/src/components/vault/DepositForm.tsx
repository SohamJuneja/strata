"use client";

import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { DUSDC_DECIMALS, DUSDC_TYPE, SHARE_TREASURY_ID, STRATA_PACKAGE, VAULT_ID } from "@/lib/constants";
import { useVaultState } from "@/lib/hooks/useVaultState";

type Status = "idle" | "preparing" | "signing" | "success" | "error";

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

export function DepositForm() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { data: vaultState } = useVaultState();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const windowOpen = vaultState?.depositWindowOpen ?? false;

  async function handleDeposit() {
    if (!account) {
      setMessage("Connect your wallet first.");
      setStatus("error");
      return;
    }
    const amountUnits = parseAmount(amount, DUSDC_DECIMALS);
    if (amountUnits === null || amountUnits <= 0n) {
      setMessage("Enter a positive amount.");
      setStatus("error");
      return;
    }

    setStatus("preparing");
    setMessage(null);

    try {
      const coins = await client.getCoins({ owner: account.address, coinType: DUSDC_TYPE });
      if (coins.data.length === 0) {
        setStatus("error");
        setMessage("No dUSDC in your wallet. Request from the faucet.");
        return;
      }

      const tx = new Transaction();
      const primaryCoinId = coins.data[0].coinObjectId;
      if (coins.data.length > 1) {
        tx.mergeCoins(
          tx.object(primaryCoinId),
          coins.data.slice(1).map((c) => tx.object(c.coinObjectId)),
        );
      }
      const [payment] = tx.splitCoins(tx.object(primaryCoinId), [amountUnits]);
      const [shares] = tx.moveCall({
        target: `${STRATA_PACKAGE}::vault::deposit`,
        typeArguments: [DUSDC_TYPE],
        arguments: [tx.object(VAULT_ID), tx.object(SHARE_TREASURY_ID), payment],
      });
      tx.transferObjects([shares], account.address);

      setStatus("signing");
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            setStatus("success");
            setMessage(`Deposit confirmed. Tx: ${result.digest.slice(0, 10)}...`);
            setAmount("");
          },
          onError: (err) => {
            setStatus("error");
            setMessage(err.message || "Transaction failed.");
          },
        },
      );
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unexpected error.");
    }
  }

  const buttonDisabled = !account || !windowOpen || status === "preparing" || status === "signing";
  const buttonLabel = status === "preparing" ? "Preparing..." : status === "signing" ? "Sign in wallet..." : "Deposit dUSDC";

  return (
    <div className="space-y-6">
      <div>
        <label className="font-mono text-xs uppercase tracking-widest text-ink-muted">Amount</label>
        <div className="mt-3 flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent font-mono text-xl tabular-nums text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <span className="font-mono text-sm text-ink-secondary">dUSDC</span>
        </div>
      </div>

      <div className="border-t border-border pt-6 space-y-3">
        <div className="flex justify-between font-mono text-sm">
          <span className="text-ink-muted">You will receive (approx)</span>
          <span className="text-ink tabular-nums">{amount || "0.00"} STRATA-PH</span>
        </div>
        <div className="flex justify-between font-mono text-sm">
          <span className="text-ink-muted">Share price</span>
          <span className="text-ink tabular-nums">1.0000 dUSDC</span>
        </div>
        <div className="flex justify-between font-mono text-sm">
          <span className="text-ink-muted">Deposit window</span>
          <span className={windowOpen ? "text-positive" : "text-negative"}>{windowOpen ? "Open" : "Closed"}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDeposit}
        disabled={buttonDisabled}
        className="w-full bg-accent text-paper py-4 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {buttonLabel}
      </button>

      {message && (
        <p className={`font-mono text-xs text-center ${status === "error" ? "text-negative" : status === "success" ? "text-positive" : "text-ink-muted"}`}>
          {message}
        </p>
      )}

      {!account && (
        <p className="font-mono text-xs text-ink-muted text-center">Connect your wallet to deposit.</p>
      )}
    </div>
  );
}