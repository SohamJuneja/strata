"use client";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useEffect } from "react";
import { STRATA_PACKAGE, VAULT_ID, PREDICT_MANAGER_ID, PREDICT_ID, DUSDC_TYPE, SUI_CLOCK_OBJECT_ID } from "@/lib/constants";

interface SettleButtonProps {
  className?: string;
}

export function SettleButton({ className = "" }: SettleButtonProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "success") return;
    const id = setTimeout(() => setStatus("idle"), 8000);
    return () => clearTimeout(id);
  }, [status]);

  function handleSettle() {
    if (!account) return;
    setStatus("pending");
    setTxDigest(null);
    setErrorMsg(null);

    const tx = new Transaction();
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault::redeem_settled_hedge_permissionless`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(PREDICT_MANAGER_ID),
        tx.object(PREDICT_ID),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          setStatus("success");
          setTxDigest(result.digest);
        },
        onError: (err) => {
          setStatus("error");
          setErrorMsg(err.message || "Transaction failed.");
        },
      },
    );
  }

  const notConnected = !account;
  const isPending = status === "pending";
  const buttonDisabled = notConnected || isPending;

  let buttonLabel: string;
  if (notConnected) {
    buttonLabel = "Connect wallet to settle";
  } else if (isPending) {
    buttonLabel = "Settling...";
  } else if (status === "success") {
    buttonLabel = "Settled";
  } else if (status === "error") {
    buttonLabel = "Settlement failed";
  } else {
    buttonLabel = "Settle Expired Positions";
  }

  const idleConnected = status === "idle" && !notConnected;
  const btnCls = idleConnected ? "border-border text-ink-secondary hover:text-ink" : "border-border text-ink-muted";

  return (
    <div className={`mt-6 pt-6 border-t border-border ${className}`}>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-2">Keeper</p>
      <p className="text-xs text-ink-muted mb-3">Redeem settled oracle positions back to vault cash. No operator key required.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSettle} disabled={buttonDisabled} className={`font-mono text-xs uppercase tracking-widest px-4 py-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${btnCls}`}>{buttonLabel}</button>
        {status === "success" && txDigest && <a href={`https://suiscan.xyz/testnet/tx/${txDigest}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-positive underline">{txDigest.slice(0, 8)}...</a>}
      </div>
      {status === "error" && errorMsg && <p className="mt-2 font-mono text-xs text-negative">{errorMsg}</p>}
      <p className="mt-3 font-mono text-xs text-ink-muted">Permissionless. Any wallet can trigger this.</p>
    </div>
  );
}
