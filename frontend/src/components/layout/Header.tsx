import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

export function Header() {
  return (
    <header className="border-b border-border bg-paper">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-2xl leading-none text-ink">Strata</Link>
        <nav className="flex items-center gap-6 md:gap-10">
          <Link href="/vault/strata-plp-hedge" className="text-sm text-ink-secondary hover:text-ink transition-colors">PLP+Hedge</Link>
          <Link href="/vault/strata-range-ladder" className="text-sm text-ink-secondary hover:text-ink transition-colors">Range Ladder</Link>
          <Link href="#thesis" className="text-sm text-ink-secondary hover:text-ink transition-colors">Thesis</Link>
          <ConnectWalletButton />
        </nav>
      </Container>
    </header>
  );
}