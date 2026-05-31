"use client";

import { motion } from "framer-motion";

export function RangeLadderMechanism() {
  return (
    <div className="border border-border bg-paper-sunken">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">// mechanism / range ladder</p>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">live</p>
      </div>

      <div className="p-6 lg:p-10">
        <svg viewBox="0 0 1200 560" className="w-full" preserveAspectRatio="xMidYMid meet">
          <line x1="280" y1="265" x2="450" y2="265" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="280" y1="265" x2="450" y2="265" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />

          <line x1="650" y1="265" x2="888" y2="85" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="650" y1="265" x2="888" y2="85" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.3 }} />

          <line x1="650" y1="265" x2="888" y2="175" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="650" y1="265" x2="888" y2="175" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.5 }} />

          <line x1="650" y1="265" x2="888" y2="265" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="650" y1="265" x2="888" y2="265" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.7 }} />

          <line x1="650" y1="265" x2="888" y2="355" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="650" y1="265" x2="888" y2="355" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.9 }} />

          <line x1="650" y1="265" x2="888" y2="445" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="650" y1="265" x2="888" y2="445" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 1.1 }} />

          <line x1="888" y1="280" x2="650" y2="280" stroke="var(--color-positive)" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="2 4" />

          <text x="365" y="253" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)" textAnchor="middle">DEPOSIT</text>

          <Node x={180} y={265} w={200} h={70} title="DEPOSITOR" subtitle="dUSDC in" />
          <NodeAccent x={550} y={265} w={200} h={90} title="VAULT" subtitle="STRATA-RL" />
          <NodeRange x={980} y={85} w={185} h={60} label="RANGE -10%" hit={false} />
          <NodeRange x={980} y={175} w={185} h={60} label="RANGE -5%" hit={false} />
          <NodeRange x={980} y={265} w={185} h={60} label="ATM" hit={true} />
          <NodeRange x={980} y={355} w={185} h={60} label="RANGE +5%" hit={false} />
          <NodeRange x={980} y={445} w={185} h={60} label="RANGE +10%" hit={false} />

          <line x1="180" y1="300" x2="180" y2="510" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
          <text x="180" y="528" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)" textAnchor="middle">withdraw on settlement</text>
        </svg>
      </div>

      <div className="border-t border-border px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block h-px w-6 bg-accent" />
          <span className="uppercase tracking-widest">forward flow</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-px w-6 bg-positive opacity-50" />
          <span className="uppercase tracking-widest">ladder hit / payout</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-px w-6 bg-ink-muted opacity-50" />
          <span className="uppercase tracking-widest">expired rung</span>
        </div>
      </div>
    </div>
  );
}

function Node({ x, y, w, h, title, subtitle }: { x: number; y: number; w: number; h: number; title: string; subtitle: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="var(--color-paper)" stroke="var(--color-border)" strokeWidth="1" />
      <text x={x} y={y - 4} fontSize="13" fontFamily="var(--font-mono)" fill="var(--color-ink)" textAnchor="middle">{title}</text>
      <text x={x} y={y + 18} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)" textAnchor="middle">{subtitle}</text>
    </g>
  );
}

function NodeAccent({ x, y, w, h, title, subtitle }: { x: number; y: number; w: number; h: number; title: string; subtitle: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="var(--color-paper-raised)" stroke="var(--color-accent)" strokeWidth="2" />
      <text x={x} y={y - 2} fontSize="22" fontFamily="var(--font-display)" fill="var(--color-ink)" textAnchor="middle">{title}</text>
      <text x={x} y={y + 22} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-accent)" textAnchor="middle">{subtitle}</text>
    </g>
  );
}

function NodeRange({ x, y, w, h, label, hit }: { x: number; y: number; w: number; h: number; label: string; hit: boolean }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="var(--color-paper)" stroke={hit ? "var(--color-positive)" : "var(--color-border)"} strokeWidth={hit ? 2 : 1} />
      <text x={x} y={y - 4} fontSize="12" fontFamily="var(--font-mono)" fill={hit ? "var(--color-positive)" : "var(--color-ink)"} textAnchor="middle">{label}</text>
      <text x={x} y={y + 16} fontSize="9" fontFamily="var(--font-mono)" fill={hit ? "var(--color-positive)" : "var(--color-ink-muted)"} textAnchor="middle">{hit ? "settles here" : "expired"}</text>
    </g>
  );
}
