import Link from "next/link";
import { Container } from "@/components/ui/Container";

export function Header() {
  return (
    <header className="border-b border-border bg-paper">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-2xl leading-none text-ink">Strata</Link>
        <nav className="flex items-center gap-6 md:gap-10">
          <Link href="/vault/strata-plp-hedge" className="text-sm text-ink-secondary hover:text-ink transition-colors">Vault</Link>
          <Link href="#thesis" className="text-sm text-ink-secondary hover:text-ink transition-colors">Thesis</Link>
          <button type="button" className="bg-accent text-paper px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-accent-hover transition-colors cursor-pointer">Connect Wallet</button>
        </nav>
      </Container>
    </header>
  );
}