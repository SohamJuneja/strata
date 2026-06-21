"use client";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useEffect } from "react";
import { STRATA_PACKAGE, PREDICT_PACKAGE, VAULT_ID, PREDICT_MANAGER_ID, PREDICT_ID, DUSDC_TYPE, SUI_CLOCK_OBJECT_ID, PREDICT_SERVER_URL } from "@/lib/constants";

interface SettleButtonProps {
  className?: string;
}

interface OpenPosition {
  oracleId: string;
  expiry: number;
  strike: number;
  isUp: boolean;
  quantity: bigint;
}

interface OracleEntry {
  oracle_id: string;
  status: "created" | "active" | "settled";
}

// The Vault and PredictManager don't expose an enumerable view of open
// hedge positions, so the only way to discover which (oracle, strike,
// direction) keys are still open is to replay Predict's own
// PositionMinted/PositionRedeemed events for our manager.
//
// suix_queryEvents defaults to ASCENDING (oldest-first) order when `order`
// isn't specified, and each page caps at ~50 results regardless of the
// `limit` requested. Predict is shared testnet infrastructure with a long
// global event history, so an unordered/unpaginated query silently returns
// the oldest events ever emitted — never ours. Must request `descending`
// explicitly and paginate to get reliable recent coverage.
async function queryRecentEvents(client: SuiJsonRpcClient, eventType: string, maxPages = 10) {
  const results: any[] = [];
  let cursor: any = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit: 50,
      order: "descending",
    });
    results.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return results;
}

async function fetchRedeemablePositions(client: SuiJsonRpcClient): Promise<OpenPosition[]> {
  const net = new Map<string, OpenPosition>();
  const keyId = (oracleId: string, strike: number, isUp: boolean) => `${oracleId}-${strike}-${isUp}`;

  const minted = await queryRecentEvents(client, `${PREDICT_PACKAGE}::predict::PositionMinted`);
  for (const e of minted) {
    const p = e.parsedJson as any;
    if (p.manager_id !== PREDICT_MANAGER_ID) continue;
    const id = keyId(p.oracle_id, Number(p.strike), Boolean(p.is_up));
    const entry = net.get(id) ?? { oracleId: p.oracle_id, expiry: Number(p.expiry), strike: Number(p.strike), isUp: Boolean(p.is_up), quantity: 0n };
    entry.quantity += BigInt(p.quantity);
    net.set(id, entry);
  }

  const redeemed = await queryRecentEvents(client, `${PREDICT_PACKAGE}::predict::PositionRedeemed`);
  for (const e of redeemed) {
    const p = e.parsedJson as any;
    if (p.manager_id !== PREDICT_MANAGER_ID) continue;
    const id = keyId(p.oracle_id, Number(p.strike), Boolean(p.is_up));
    const entry = net.get(id);
    if (entry) entry.quantity -= BigInt(p.quantity);
  }

  const open = [...net.values()].filter((p) => p.quantity > 0n);
  if (open.length === 0) return [];

  const res = await fetch(`${PREDICT_SERVER_URL}/oracles`);
  if (!res.ok) throw new Error(`Oracle server returned HTTP ${res.status}`);
  const oracles = (await res.json()) as OracleEntry[];
  const settledIds = new Set(oracles.filter((o) => o.status === "settled").map((o) => o.oracle_id));

  return open.filter((p) => settledIds.has(p.oracleId));
}

export function SettleButton({ className = "" }: SettleButtonProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "success") return;
    const id = setTimeout(() => setStatus("idle"), 8000);
    return () => clearTimeout(id);
  }, [status]);

  async function handleSettle() {
    if (!account) return;
    setStatus("pending");
    setTxDigest(null);
    setErrorMsg(null);

    try {
      const positions = await fetchRedeemablePositions(client);
      if (positions.length === 0) {
        setStatus("error");
        setErrorMsg("No settled hedge positions to redeem right now.");
        return;
      }

      const tx = new Transaction();
      for (const pos of positions) {
        const [key] = tx.moveCall({
          target: `${PREDICT_PACKAGE}::market_key::new`,
          arguments: [
            tx.pure.id(pos.oracleId),
            tx.pure.u64(pos.expiry),
            tx.pure.u64(pos.strike),
            tx.pure.bool(pos.isUp),
          ],
        });
        tx.moveCall({
          target: `${STRATA_PACKAGE}::vault::redeem_settled_hedge_permissionless`,
          typeArguments: [DUSDC_TYPE],
          arguments: [
            tx.object(VAULT_ID),
            tx.object(PREDICT_ID),
            tx.object(PREDICT_MANAGER_ID),
            tx.object(pos.oracleId),
            key,
            tx.pure.u64(pos.quantity.toString()),
            tx.object(SUI_CLOCK_OBJECT_ID),
          ],
        });
      }

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
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to look up settled positions.");
    }
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
