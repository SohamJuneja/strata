import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-border bg-paper">
      <Container className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-8">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">
          © 2026 Strata
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">
          Built for Sui Overflow 2026 / DeepBook Track
        </span>
      </Container>
    </footer>
  );
}