export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface StrategyConfig {
  name: string;
  description: string;
  hedgeRatioBps: number;
  strikeOffsetBps: number;
  deployRatioBps: number;
  estimatedWeeklyYieldPct: string;
  riskLevel: RiskLevel;
  creatorFeeBps: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatResponse =
  | { type: "message"; content: string }
  | { type: "strategy"; strategy: StrategyConfig };

export interface CommunityVaultEntry extends StrategyConfig {
  creatorAddress: string;
  createdAt: string;
  slug: string;
  vaultId: string;
  status: "pending" | "live";
}
