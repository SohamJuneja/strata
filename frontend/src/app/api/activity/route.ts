import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

const LOG_PATH = path.join(process.cwd(), "..", "marathon-bot", "cycle-log.json");

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
