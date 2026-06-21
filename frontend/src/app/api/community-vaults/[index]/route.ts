import { bcs } from "@mysten/sui/bcs";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { STRATA_PACKAGE, VAULT_REGISTRY_ID } from "@/lib/constants";
import { riskLevelFromU8, type CommunityVaultDetail } from "@/lib/communityVaults";

// Single-vault detail, sourced from chain. Most fields come from the
// VaultRegistered event (cheap, one query); `description` isn't part of
// the event, so it's read directly off the on-chain CommunityVaultConfig
// via a devInspect call to vault_factory::config_description.

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ index: string }> }
): Promise<Response> {
  const { index: indexParam } = await params;
  const vaultIndex = Number(indexParam);

  if (!Number.isInteger(vaultIndex) || vaultIndex < 0) {
    return Response.json({ vault: null, error: "Invalid vault index" }, { status: 400 });
  }

  try {
    const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" });

    const eventsRes = await client.queryEvents({
      query: { MoveEventType: `${STRATA_PACKAGE}::vault_factory::VaultRegistered` },
      limit: 100,
      order: "descending",
    });

    const match = eventsRes.data.find((e) => {
      const pj = e.parsedJson as VaultRegisteredEvent;
      return Number(pj.vault_index) === vaultIndex;
    });

    if (!match) {
      return Response.json({ vault: null }, { status: 404 });
    }

    const pj = match.parsedJson as VaultRegisteredEvent;

    const tx = new Transaction();
    const [config] = tx.moveCall({
      target: `${STRATA_PACKAGE}::vault_factory::get_vault`,
      arguments: [tx.object(VAULT_REGISTRY_ID), tx.pure.u64(vaultIndex)],
    });
    tx.moveCall({
      target: `${STRATA_PACKAGE}::vault_factory::config_description`,
      arguments: [config],
    });

    const inspectRes = await client.devInspectTransactionBlock({
      sender: pj.creator,
      transactionBlock: tx,
    });

    const descriptionBytes = inspectRes.results?.[1]?.returnValues?.[0]?.[0];
    const description = descriptionBytes ? bcs.string().parse(new Uint8Array(descriptionBytes)) : "";

    const vault: CommunityVaultDetail = {
      vaultIndex,
      name: pj.name,
      description,
      riskLevel: riskLevelFromU8(pj.risk_level),
      hedgeRatioBps: Number(pj.hedge_ratio_bps),
      strikeOffsetBps: Number(pj.strike_offset_bps),
      deployRatioBps: Number(pj.deploy_ratio_bps),
      creatorFeeBps: 10,
      creatorAddress: pj.creator,
      txDigest: match.id.txDigest,
      createdAt: match.timestampMs ? new Date(Number(match.timestampMs)).toISOString() : new Date().toISOString(),
    };

    return Response.json({ vault });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ vault: null, error: message }, { status: 500 });
  }
}
