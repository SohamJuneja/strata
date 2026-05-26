"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { SHARE_TREASURY_ID, VAULT_ID } from "@/lib/constants";

export interface VaultState {
  cash: bigint;
  plpBalance: bigint;
  operator: string;
  predictManagerId: string | null;
  shareTreasuryId: string;
  depositWindowOpen: boolean;
}

export function useVaultState() {
  const client = useSuiClient();
  return useQuery<VaultState | null>({
    queryKey: ["vault-state", VAULT_ID],
    refetchInterval: 5000,
    queryFn: async () => {
      const resp = await client.getObject({ id: VAULT_ID, options: { showContent: true } });
      const content = resp.data?.content;
      if (!content || content.dataType !== "moveObject") return null;
      const fields = (content as { fields: Record<string, unknown> }).fields;

      const pmRaw = fields.predict_manager_id;
      let predictManagerId: string | null = null;
      if (typeof pmRaw === "string") predictManagerId = pmRaw;
      else if (pmRaw && typeof pmRaw === "object" && "vec" in pmRaw) {
        const vec = (pmRaw as { vec?: string[] }).vec;
        predictManagerId = vec && vec.length > 0 ? vec[0] : null;
      }

      return {
        cash: BigInt((fields.cash as string) ?? "0"),
        plpBalance: BigInt((fields.plp_balance as string) ?? "0"),
        operator: (fields.operator as string) ?? "",
        predictManagerId,
        shareTreasuryId: (fields.share_treasury_id as string) ?? "",
        depositWindowOpen: Boolean(fields.deposit_window_open),
      };
    },
  });
}

export function useShareSupply() {
  const client = useSuiClient();
  return useQuery<bigint>({
    queryKey: ["share-supply", SHARE_TREASURY_ID],
    refetchInterval: 5000,
    queryFn: async () => {
      const resp = await client.getObject({
        id: SHARE_TREASURY_ID,
        options: { showContent: true },
      });
      const content = resp.data?.content;
      if (!content || content.dataType !== "moveObject") return 0n;
      const fields = (content as { fields: Record<string, unknown> }).fields;

      // Traverse: treasury_cap -> total_supply -> value
      // Defensive: handle both nested-fields and flat shapes
      const tc = fields.treasury_cap;
      if (!tc || typeof tc !== "object") return 0n;
      const tcObj = tc as Record<string, unknown>;

      // Try nested-fields shape first (standard JSON-RPC)
      const tcFields = (tcObj.fields ?? tcObj) as Record<string, unknown>;
      const supplyRaw = tcFields.total_supply;
      if (!supplyRaw || typeof supplyRaw !== "object") return 0n;
      const supplyObj = supplyRaw as Record<string, unknown>;
      const supplyFields = (supplyObj.fields ?? supplyObj) as Record<string, unknown>;
      const value = supplyFields.value;

      return BigInt((value as string) ?? "0");
    },
  });
}