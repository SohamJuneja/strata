import type { RiskLevel } from "@/lib/vaultCreator";

// Read model for strata::vault_factory::VaultRegistry. The registry is the
// only durable source of truth for community vaults — community-vaults.json
// (written by /api/create-vault/deploy) is a local-only debug artifact and
// is never read here. See deploy/route.ts for why.

export interface CommunityVaultSummary {
  vaultIndex: number;
  name: string;
  riskLevel: RiskLevel;
  hedgeRatioBps: number;
  strikeOffsetBps: number;
  deployRatioBps: number;
  creatorFeeBps: number;
  creatorAddress: string;
  txDigest: string;
  createdAt: string;
}

export interface CommunityVaultDetail extends CommunityVaultSummary {
  description: string;
}

const RISK_LEVEL_FROM_U8: Record<number, RiskLevel> = {
  0: "LOW",
  1: "MEDIUM",
  2: "HIGH",
};

export function riskLevelFromU8(value: number): RiskLevel {
  return RISK_LEVEL_FROM_U8[value] ?? "MEDIUM";
}
