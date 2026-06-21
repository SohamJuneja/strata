import OpenAI from "openai";
import type { ChatMessage, ChatResponse, StrategyConfig } from "@/lib/vaultCreator";

// Layer 1: AI conversation -> strategy config. This route never touches
// deployment — see /api/create-vault/deploy for that. Keeping them apart
// means swapping the JSON-file deploy for an on-chain factory call later
// never requires changing this file.

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a DeFi vault strategy advisor for Strata, a structured products protocol on Sui blockchain. Strata vaults earn yield by supplying liquidity to DeepBook Predict (a binary options market) and hedging the downside with OTM put options.

When a user wants to create a vault, ask at most 2 short clarifying questions to understand: (1) their risk tolerance — low/medium/high, (2) their BTC outlook — bullish/neutral/bearish, (3) how much crash protection they want.

Once you have enough information (after 1-2 exchanges at most), output a strategy config in this exact format — wrap the JSON in <strategy> tags and put your friendly explanation BEFORE the tags:

<strategy>
{
  "name": "...",
  "description": "...",
  "hedgeRatioBps": ...,
  "strikeOffsetBps": ...,
  "deployRatioBps": ...,
  "estimatedWeeklyYieldPct": "...",
  "riskLevel": "...",
  "creatorFeeBps": 10
}
</strategy>

Guidelines for parameters:
- LOW risk: hedgeRatioBps=2000, strikeOffsetBps=200, deployRatioBps=7000, yield='0.1-0.2', lots of protection
- MEDIUM risk: hedgeRatioBps=1000, strikeOffsetBps=500, deployRatioBps=8500, yield='0.2-0.4', balanced
- HIGH risk: hedgeRatioBps=500, strikeOffsetBps=800, deployRatioBps=9500, yield='0.4-0.8', minimal hedge
- Adjust based on BTC outlook: bearish = more hedge (lower strikeOffsetBps), bullish = less hedge

Keep responses SHORT — 2-3 sentences max before outputting the strategy. Users are not DeFi experts.`;

function extractStrategy(text: string): StrategyConfig | null {
  const match = text.match(/<strategy>([\s\S]*?)<\/strategy>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as StrategyConfig;
    // Models don't reliably honor the exact casing requested in the
    // prompt (e.g. "Medium" instead of "MEDIUM") — normalize at this
    // boundary since the frontend switches on the literal union type.
    const riskLevel = String(parsed.riskLevel).toUpperCase();
    if (riskLevel !== "LOW" && riskLevel !== "MEDIUM" && riskLevel !== "HIGH") return null;
    return { ...parsed, riskLevel, creatorFeeBps: 10 };
  } catch {
    return null;
  }
}

function mockStrategy(): StrategyConfig {
  return {
    name: "Balanced Yield Vault",
    description:
      "A balanced strategy that earns steady PLP yield while hedging a meaningful slice of downside risk. Good fit if you want yield without losing sleep over a crash.",
    hedgeRatioBps: 1000,
    strikeOffsetBps: 500,
    deployRatioBps: 8500,
    estimatedWeeklyYieldPct: "0.2-0.4",
    riskLevel: "MEDIUM",
    creatorFeeBps: 10,
  };
}

export async function POST(request: Request): Promise<Response> {
  const { messages } = (await request.json()) as { messages: ChatMessage[] };

  if (!process.env.OPENAI_API_KEY) {
    const response: ChatResponse = { type: "strategy", strategy: mockStrategy() };
    return Response.json(response);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const strategy = extractStrategy(text);

    const response: ChatResponse = strategy
      ? { type: "strategy", strategy }
      : { type: "message", content: text };
    return Response.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ type: "message", content: `AI advisor error: ${message}` } satisfies ChatResponse, { status: 500 });
  }
}
