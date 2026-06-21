import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { STRATA_PACKAGE } from "@/lib/constants";
import { riskLevelFromU8, type CommunityVaultSummary } from "@/lib/communityVaults";

// Lists every community vault by reading VaultRegistered events directly —
// the registry is the only durable source of truth (see
// /api/create-vault/deploy). Events carry everything a summary card needs
// except `description`, which only the detail route fetches.

export const dynamic = "force-dynamic";

interface VaultRegisteredEvent {
  vault_index: string;
  creator: string;
  name: string;
  hedge_ratio_bps: string;
  strike_offset_bps: string;
  deploy_ratio_bps: string;
  risk_level: number;
}

export async function GET(): Promise<Response> {
  try {
    const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" });

    const res = await client.queryEvents({
      query: { MoveEventType: `${STRATA_PACKAGE}::vault_factory::VaultRegistered` },
      limit: 100,
      order: "descending",
    });

    const vaults: CommunityVaultSummary[] = res.data.map((e) => {
      const pj = e.parsedJson as VaultRegisteredEvent;
      return {
        vaultIndex: Number(pj.vault_index),
        name: pj.name,
        riskLevel: riskLevelFromU8(pj.risk_level),
        hedgeRatioBps: Number(pj.hedge_ratio_bps),
        strikeOffsetBps: Number(pj.strike_offset_bps),
        deployRatioBps: Number(pj.deploy_ratio_bps),
        creatorFeeBps: 10,
        creatorAddress: pj.creator,
        txDigest: e.id.txDigest,
        createdAt: e.timestampMs ? new Date(Number(e.timestampMs)).toISOString() : new Date().toISOString(),
      };
    });

    return Response.json({ vaults });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ vaults: [], error: message }, { status: 500 });
  }
}
