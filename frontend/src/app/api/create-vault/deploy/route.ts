import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { CommunityVaultEntry, StrategyConfig } from "@/lib/vaultCreator";

// Layer 2: deployment only, no AI logic. TODAY this appends to a JSON
// file. LATER it will submit a transaction to a factory contract — when
// that lands, only this file changes, not /api/create-vault/chat.

export const dynamic = "force-dynamic";

const VAULTS_PATH = path.join(process.cwd(), "community-vaults.json");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "") || "vault";
}

async function readVaults(): Promise<CommunityVaultEntry[]> {
  try {
    const raw = await fs.readFile(VAULTS_PATH, "utf-8");
    return JSON.parse(raw) as CommunityVaultEntry[];
  } catch {
    return [];
  }
}

export async function POST(request: Request): Promise<Response> {
  const { strategy, creatorAddress } = (await request.json()) as {
    strategy: StrategyConfig;
    creatorAddress: string;
  };

  const slug = slugify(strategy.name);
  const createdAt = new Date().toISOString();
  const vaultId =
    "0x" + createHash("sha256").update(`${slug}${createdAt}`).digest("hex").slice(0, 16);

  const vaults = await readVaults();
  const entry: CommunityVaultEntry = {
    ...strategy,
    creatorAddress,
    createdAt,
    slug,
    vaultId,
    status: "pending",
  };
  vaults.push(entry);

  await fs.writeFile(VAULTS_PATH, JSON.stringify(vaults, null, 2));

  return Response.json({ slug, vaultId });
}
