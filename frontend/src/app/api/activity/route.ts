import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

// CYCLE_LOG_PATH (set in .env.local) points at the live marathon-bot
// process's cycle-log.json for local dev. In production (Vercel), there's
// no marathon-bot filesystem to read from, so this falls back to the
// bundled public/cycle-log.json snapshot — a point-in-time copy, not live
// data; re-copy and redeploy to refresh it.
const LOG_PATH = process.env.CYCLE_LOG_PATH ?? path.join(process.cwd(), "public", "cycle-log.json");

export async function GET() {
  if (!fs.existsSync(LOG_PATH)) {
    return Response.json({ cycles: [] });
  }

  try {
    const raw = fs.readFileSync(LOG_PATH, "utf-8");
    const cycles = JSON.parse(raw);
    return Response.json({ cycles });
  } catch (e) {
    return Response.json({ cycles: [], error: e instanceof Error ? e.message : "Failed to read cycle log" }, { status: 500 });
  }
}
