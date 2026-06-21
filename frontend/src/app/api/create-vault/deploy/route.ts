import { promises as fs } from "fs";
import path from "path";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { STRATA_PACKAGE, VAULT_REGISTRY_ID, SUI_CLOCK_OBJECT_ID } from "@/lib/constants";
import type { CommunityVaultEntry, RiskLevel, StrategyConfig } from "@/lib/vaultCreator";

// Layer 2: deployment only, no AI logic. Registers the strategy on-chain
// via strata::vault_factory::register_vault — that's the only durable
// source of truth (see /api/community-vaults, which reads it back via
// VaultRegistered events). community-vaults.json below is a best-effort
// local debug artifact only: Vercel's serverless filesystem is read-only,
// so this write always fails in production. It must never affect the
// response — a previous version let a failed write here crash the whole
// request even after a successful on-chain registration, producing a
// bare 500 while real vaults kept getting created on-chain underneath.

export const dynamic = "force-dynamic";

const VAULTS_PATH = path.join(process.cwd(), "community-vaults.json");
const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY ?? "";

const RISK_LEVEL_TO_U8: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "vault"
  );
}

async function readVaults(): Promise<CommunityVaultEntry[]> {
  try {
    const raw = await fs.readFile(VAULTS_PATH, "utf-8");
    return JSON.parse(raw) as CommunityVaultEntry[];
  } catch {
    return [];
  }
}

// Best-effort only — never throws. Local dev gets a nice debug copy on
// disk; production silently skips it (read-only filesystem).
async function appendVaultBestEffort(entry: CommunityVaultEntry): Promise<void> {
  try {
    const vaults = await readVaults();
    vaults.push(entry);
    await fs.writeFile(VAULTS_PATH, JSON.stringify(vaults, null, 2));
  } catch {
    // Expected in production (Vercel's filesystem is read-only). The
    // on-chain registration is the real source of truth either way.
  }
}

function toUtf8Bytes(value: string): number[] {
  return Array.from(Buffer.from(value, "utf-8"));
}

interface RegisterResult {
  vaultIndex: number;
  txDigest: string;
}

async function registerVaultOnChain(strategy: StrategyConfig): Promise<RegisterResult> {
  if (!OPERATOR_KEY) {
    throw new Error("OPERATOR_PRIVATE_KEY is not set");
  }

  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" });
  const operator = Ed25519Keypair.fromSecretKey(OPERATOR_KEY);

  const tx = new Transaction();
  tx.moveCall({
    target: `${STRATA_PACKAGE}::vault_factory::register_vault`,
    arguments: [
      tx.object(VAULT_REGISTRY_ID),
      tx.pure.vector("u8", toUtf8Bytes(strategy.name)),
      tx.pure.vector("u8", toUtf8Bytes(strategy.description)),
      tx.pure.u64(strategy.hedgeRatioBps),
      tx.pure.u64(strategy.strikeOffsetBps),
      tx.pure.u64(strategy.deployRatioBps),
      tx.pure.u8(RISK_LEVEL_TO_U8[strategy.riskLevel]),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const res = await client.signAndExecuteTransaction({
    signer: operator,
    transaction: tx,
    options: { showEvents: true, showEffects: true },
  });

  if (res.effects?.status?.status !== "success") {
    throw new Error(`register_vault failed: ${JSON.stringify(res.effects?.status)}`);
  }

  const registeredEvent = res.events?.find((e) => e.type.endsWith("::vault_factory::VaultRegistered"));
  if (!registeredEvent) {
    throw new Error("register_vault succeeded but no VaultRegistered event was found");
  }

  const parsed = registeredEvent.parsedJson as { vault_index: string };
  return { vaultIndex: Number(parsed.vault_index), txDigest: res.digest };
}

export async function POST(request: Request): Promise<Response> {
  const { strategy, creatorAddress } = (await request.json()) as {
    strategy: StrategyConfig;
    creatorAddress: string;
  };

  const slug = slugify(strategy.name);
  const createdAt = new Date().toISOString();
  const vaultId = `0x${Buffer.from(`${slug}${createdAt}`).toString("hex").slice(0, 16)}`;

  try {
    const { vaultIndex, txDigest } = await registerVaultOnChain(strategy);

    await appendVaultBestEffort({
      ...strategy,
      creatorAddress,
      createdAt,
      slug,
      vaultId,
      vaultIndex,
      txDigest,
      status: "pending",
    });

    return Response.json({
      vaultIndex,
      txDigest,
      slug,
      suiscanUrl: `https://suiscan.xyz/testnet/tx/${txDigest}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";

    await appendVaultBestEffort({
      ...strategy,
      creatorAddress,
      createdAt,
      slug,
      vaultId,
      vaultIndex: null,
      txDigest: null,
      status: "pending",
    });

    // No on-chain registration happened, so this vault genuinely isn't
    // visible anywhere (community-vaults.json is local-only/best-effort —
    // see above). Returning 200 here would tell the frontend to show a
    // success screen for a vault nobody can ever see. Fail loudly instead.
    return Response.json(
      {
        vaultIndex: null,
        txDigest: null,
        slug,
        fallback: true,
        error: message,
      },
      { status: 502 }
    );
  }
}
