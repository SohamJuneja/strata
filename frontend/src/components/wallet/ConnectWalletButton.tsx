"use client";

import { ConnectModal, useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import { useState } from "react";

export function ConnectWalletButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [open, setOpen] = useState(false);

  if (account) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="bg-paper-raised border border-border text-ink px-5 py-2 font-mono text-xs uppercase tracking-widest hover:border-accent hover:text-accent transition-colors cursor-pointer"
        title="Click to disconnect"
      >
        {account.address.slice(0, 6)}...{account.address.slice(-4)}
      </button>
    );
  }

  return (
    <ConnectModal
      trigger={
        <button
          type="button"
          className="bg-accent text-paper px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer"
        >
          Connect Wallet
        </button>
      }
      open={open}
      onOpenChange={(isOpen) => setOpen(isOpen)}
    />
  );
}