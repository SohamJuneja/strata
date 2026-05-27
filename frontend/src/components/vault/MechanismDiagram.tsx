"use client";

import { motion } from "framer-motion";

export function MechanismDiagram() {
  return (
    <div className="border border-border bg-paper-sunken">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">// mechanism / one cycle</p>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">live</p>
      </div>

      <div className="p-6 lg:p-10">
        <svg viewBox="0 0 1200 460" className="w-full" preserveAspectRatio="xMidYMid meet">
          <line x1="290" y1="230" x2="440" y2="230" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="290" y1="230" x2="440" y2="230" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />

          <line x1="660" y1="210" x2="840" y2="130" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="660" y1="210" x2="840" y2="130" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.4 }} />

          <line x1="660" y1="250" x2="840" y2="330" stroke="var(--color-border)" strokeWidth="1" />
          <motion.line x1="660" y1="250" x2="840" y2="330" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 8" animate={{ strokeDashoffset: [-24, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.8 }} />

          <line x1="840" y1="155" x2="660" y2="218" stroke="var(--color-positive)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="840" y1="305" x2="660" y2="242" stroke="var(--color-ink-muted)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />

          <text x="365" y="218" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)" textAnchor="middle">DEPOSIT</text>
          <text x="730" y="160" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)" textAnchor="middle">SUPPLY ~90%</text>
          <text x="730" y="300" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)" textAnchor="middle">HEDGE ~10%</text>

          <Node x={180} y={230} w={220} h={80} title="DEPOSITOR" subtitle="dUSDC in" />
          <NodeAccent x={550} y={230} w={220} h={90} title="VAULT" subtitle="STRATA-PH" />
          <Node x={950} y={130} w={220} h={80} title="PLP SUPPLY" subtitle="yield leg" />
          <Node x={950} y={330} w={220} h={80} title="HEDGE" subtitle="crash insurance" />

          <line x1="180" y1="285" x2="180" y2="420" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="950" y1="380" x2="950" y2="420" stroke="var(--color-positive)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />

          <text x="180" y="440" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)" textAnchor="middle">↑ withdraw on settlement</text>
          <text x="950" y="440" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-positive)" fillOpacity="0.7" textAnchor="middle">↑ yield + payout</text>
        </svg>
      </div>

      <div className="border-t border-border px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block h-px w-6 bg-accent" />
          <span className="uppercase tracking-widest">forward flow</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-px w-6 bg-positive opacity-50" />
          <span className="uppercase tracking-widest">yield return</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-px w-6 bg-ink-muted opacity-50" />
          <span className="uppercase tracking-widest">hedge settlement</span>
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