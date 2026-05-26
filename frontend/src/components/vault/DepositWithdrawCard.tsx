"use client";

import { useState } from "react";
import { DepositForm } from "@/components/vault/DepositForm";
import { WithdrawForm } from "@/components/vault/WithdrawForm";

export function DepositWithdrawCard() {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  return (
    <div className="border border-border bg-paper-raised p-8">
      <div className="flex gap-6 mb-8 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("deposit")}
          className={`font-mono text-xs uppercase tracking-widest pb-4 cursor-pointer transition-colors ${tab === "deposit" ? "border-b-2 border-accent text-accent" : "text-ink-muted hover:text-ink"}`}
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() => setTab("withdraw")}
          className={`font-mono text-xs uppercase tracking-widest pb-4 cursor-pointer transition-colors ${tab === "withdraw" ? "border-b-2 border-accent text-accent" : "text-ink-muted hover:text-ink"}`}
        >
          Withdraw
        </button>
      </div>
      {tab === "deposit" ? <DepositForm /> : <WithdrawForm />}
    </div>
  );
}