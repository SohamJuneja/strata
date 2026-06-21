"use client";

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import type { ChatMessage, ChatResponse, RiskLevel, StrategyConfig } from "@/lib/vaultCreator";

type Step = "chat" | "preview" | "success";

const OPENER: ChatMessage = {
  role: "assistant",
  content:
    "Hey! Tell me about the vault strategy you have in mind. What's your goal — steady yield, crash protection, or something else?",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "text-positive border-positive",
  MEDIUM: "text-[#D9A441] border-[#D9A441]",
  HIGH: "text-negative border-negative",
};

export default function CreateVaultPage() {
  const account = useCurrentAccount();

  const [step, setStep] = useState<Step>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([OPENER]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [strategy, setStrategy] = useState<StrategyConfig | null>(null);
  const [deploying, setDeploying] = useState(false);

  const [result, setResult] = useState<{ slug: string; vaultId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/create-vault/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await res.json()) as ChatResponse;

      if (data.type === "strategy") {
        setStrategy(data.strategy);
        setStep("preview");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong reaching the AI advisor. Try again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function launchVault() {
    if (!strategy || !account || deploying) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/create-vault/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, creatorAddress: account.address }),
      });
      const data = (await res.json()) as { slug: string; vaultId: string };
      setResult(data);
      setStep("success");
    } finally {
      setDeploying(false);
    }
  }

  function copyShareLink() {
    if (!result) return;
    const url = `${window.location.origin}/vault/community/${result.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Header />
      <main>
        {step === "chat" && (
          <ChatStep
            messages={messages}
            input={input}
            sending={sending}
            onInputChange={setInput}
            onSend={sendMessage}
          />
        )}

        {step === "preview" && strategy && (
          <PreviewStep
            strategy={strategy}
            hasWallet={!!account}
            deploying={deploying}
            onBack={() => setStep("chat")}
            onLaunch={launchVault}
          />
        )}

        {step === "success" && strategy && result && (
          <SuccessStep
            strategy={strategy}
            slug={result.slug}
            vaultId={result.vaultId}
            copied={copied}
            onCopy={copyShareLink}
          />
        )}
      </main>
      <Footer />
    </>
  );
}

function ChatStep({
  messages,
  input,
  sending,
  onInputChange,
  onSend,
}: {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="border-b border-border py-16 lg:py-24">
      <Container>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Create Vault</p>
        <h1 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink">
          Create Your <span className="italic text-accent">Vault</span>
        </h1>
        <p className="mt-4 text-lg text-ink-secondary max-w-xl">
          Describe your strategy in plain English — our AI will configure it for you.
        </p>

        <div className="mt-12 max-w-2xl border border-border bg-paper-raised">
          <div className="p-6 space-y-4 max-h-[480px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-accent text-paper"
                      : "bg-paper border border-border text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-3 text-sm bg-paper border border-border text-ink-muted">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4 flex gap-3">
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              disabled={sending}
              placeholder="I want steady yield with some crash protection…"
              className="flex-1 bg-paper-sunken border border-border px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent disabled:opacity-50"
            />
            <button
              type="button"
              onClick={onSend}
              disabled={sending || !input.trim()}
              className="bg-accent text-paper px-6 py-3 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Send
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}

function PreviewStep({
  strategy,
  hasWallet,
  deploying,
  onBack,
  onLaunch,
}: {
  strategy: StrategyConfig;
  hasWallet: boolean;
  deploying: boolean;
  onBack: () => void;
  onLaunch: () => void;
}) {
  return (
    <section className="border-b border-border py-16 lg:py-24">
      <Container>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Create Vault / Preview</p>

        <div className="max-w-2xl border border-border bg-paper-raised p-8 lg:p-10">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-4xl lg:text-5xl leading-tight tracking-tight text-ink">
              {strategy.name}
            </h2>
            <span
              className={`shrink-0 font-mono text-xs uppercase tracking-widest border px-3 py-1 ${RISK_STYLES[strategy.riskLevel]}`}
            >
              {strategy.riskLevel}
            </span>
          </div>

          <p className="mt-4 italic text-ink-secondary leading-relaxed">{strategy.description}</p>

          <div className="mt-8 space-y-4">
            <ParamRow icon="🛡" label="Crash protection" value={`${strategy.hedgeRatioBps / 100}%`} />
            <ParamRow
              icon="📉"
              label="Hedge fires if BTC drops more than"
              value={`${strategy.strikeOffsetBps / 100}%`}
            />
            <ParamRow icon="💰" label="Est. weekly yield" value={`${strategy.estimatedWeeklyYieldPct}%`} />
          </div>

          <div className="my-8 border-t border-border" />

          <p className="text-sm text-ink-secondary">
            Creator benefit: You earn <span className="text-ink font-mono">{strategy.creatorFeeBps / 100}%</span> of
            all deposits to this vault.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center border border-ink-secondary text-ink px-7 py-3.5 font-mono text-sm uppercase tracking-widest hover:bg-paper-sunken transition-colors cursor-pointer"
            >
              ← Refine strategy
            </button>
            <button
              type="button"
              onClick={onLaunch}
              disabled={!hasWallet || deploying}
              className="inline-flex items-center bg-accent text-paper px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {!hasWallet ? "Connect wallet to launch" : deploying ? "Launching…" : "Launch My Vault →"}
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ParamRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-border bg-paper px-5 py-4">
      <span className="text-ink-secondary text-sm">
        <span className="mr-2">{icon}</span>
        {label}
      </span>
      <span className="font-mono text-lg tabular-nums text-ink">{value}</span>
    </div>
  );
}

function SuccessStep({
  strategy,
  slug,
  vaultId,
  copied,
  onCopy,
}: {
  strategy: StrategyConfig;
  slug: string;
  vaultId: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="py-24 lg:py-32">
      <Container>
        <div className="max-w-xl mx-auto text-center">
          <div className="flex justify-center">
            <svg
              className="animate-check-pop"
              width="72"
              height="72"
              viewBox="0 0 72 72"
              fill="none"
            >
              <circle cx="36" cy="36" r="34" stroke="var(--color-positive)" strokeWidth="2" />
              <path
                d="M22 37 L31 46 L50 26"
                stroke="var(--color-positive)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-check-draw"
              />
            </svg>
          </div>

          <h1 className="mt-8 font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink">
            Your vault is live
          </h1>

          <p className="mt-6 font-display text-2xl italic text-ink">{strategy.name}</p>
          <p className="mt-3 text-ink-secondary leading-relaxed">{strategy.description}</p>

          <p className="mt-8 font-mono text-xs uppercase tracking-widest text-ink-muted">Vault ID</p>
          <p className="mt-2 font-mono text-sm text-ink break-all">{vaultId}</p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center border border-ink-secondary text-ink px-7 py-3.5 font-mono text-sm uppercase tracking-widest hover:bg-paper-raised transition-colors cursor-pointer"
            >
              {copied ? "Copied!" : "Share your vault"}
            </button>
            <a
              href={`/vault/community/${slug}`}
              className="inline-flex items-center bg-accent text-paper px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors"
            >
              View My Vault →
            </a>
          </div>

          <p className="mt-8 text-xs text-ink-muted">
            On-chain deployment is processing. Your vault will appear in the community directory shortly.
          </p>
        </div>
      </Container>
    </section>
  );
}
