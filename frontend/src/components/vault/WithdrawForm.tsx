"use client";

import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { DUSDC_TYPE, SHARE_DECIMALS, SHARE_TREASURY_ID, STRATA_PACKAGE, VAULT_ID, VAULT_SHARE_TYPE } from "@/lib/constants";
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

export function WithdrawForm() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { data: vaultState } = useVaultState();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const windowOpen = vaultState?.depositWindowOpen ?? false;

  async function handleWithdraw() {
    if (!account) {
      setMessage("Connect your wallet first.");
      setStatus("error");
      return;
    }
    const amountUnits = parseAmount(amount, SHARE_DECIMALS);
    if (amountUnits === null || amountUnits <= 0n) {
      setMessage("Enter a positive amount.");
      setStatus("error");
      return;
    }

    setStatus("preparing");
    setMessage(null);

    try {
      const coins = await client.getCoins({ owner: account.address, coinType: VAULT_SHARE_TYPE });
      if (coins.data.length === 0) {
        setStatus("error");
        setMessage("No STRATA-PH shares in your wallet.");
        return;
      }

      const tx = new Transaction();
      const primaryCoinId = coins.data[0].coinObjectId;
      if (coins.data.length > 1) {
        tx.mergeCoins(tx.object(primaryCoinId), coins.data.slice(1).map((c) => tx.object(c.coinObjectId)));
      }
      const [sharesToBurn] = tx.splitCoins(tx.object(primaryCoinId), [amountUnits]);
      const [payout] = tx.moveCall({
        target: `${STRATA_PACKAGE}::vault::withdraw`,
        typeArguments: [DUSDC_TYPE],
        arguments: [tx.object(VAULT_ID), tx.object(SHARE_TREASURY_ID), sharesToBurn],
      });
      tx.transferObjects([payout], account.address);

      setStatus("signing");
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            setStatus("success");
            setMessage(result.digest);
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
  const buttonLabel = status === "preparing" ? "Preparing..." : status === "signing" ? "Sign in wallet..." : "Withdraw dUSDC";

  return (
    <div className="space-y-6">
      <div>
        <label className="font-mono text-xs uppercase tracking-widest text-ink-muted">Shares to burn</label>
        <div className="mt-3 flex items-center gap-3 border border-border bg-paper px-4 py-3">
          <input type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 bg-transparent font-mono text-xl tabular-nums text-ink placeholder:text-ink-muted focus:outline-none" />
          <span className="font-mono text-sm text-ink-secondary">STRATA-PH</span>
        </div>
      </div>

      <div className="border-t border-border pt-6 space-y-3">
        <div className="flex justify-between font-mono text-sm">
          <span className="text-ink-muted">You will receive (approx)</span>
          <span className="text-ink tabular-nums">{amount || "0.00"} dUSDC</span>
        </div>
        <div className="flex justify-between font-mono text-sm">
          <span className="text-ink-muted">Share price</span>
          <span className="text-ink tabular-nums">1.0000 dUSDC</span>
        </div>
        <div className="flex justify-between font-mono text-sm">
          <span className="text-ink-muted">Withdraw window</span>
          <span className={windowOpen ? "text-positive" : "text-negative"}>{windowOpen ? "Open" : "Closed"}</span>
        </div>
      </div>

      <button type="button" onClick={handleWithdraw} disabled={buttonDisabled} className="w-full bg-accent text-paper py-4 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {buttonLabel}
      </button>

      {message && status === "success" && (<a href={`https://suiscan.xyz/testnet/tx/${message}`} target="_blank" rel="noopener noreferrer" className="block text-center font-mono text-xs text-positive underline decoration-positive/40 hover:decoration-positive transition-colors break-all">View transaction on Suiscan</a>)}
      {message && status !== "success" && (<p className={`font-mono text-xs text-center ${status === "error" ? "text-negative" : "text-ink-muted"}`}>{message}</p>)}
    </div>
  );
}