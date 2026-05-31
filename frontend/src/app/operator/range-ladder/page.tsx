import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { RangeLadderOperatorControls } from "@/components/operator/RangeLadderOperatorControls";

export default function RangeLadderOperatorPage() {
  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-2">
              <Link href="/operator" className="hover:text-ink transition-colors">Admin / Operator</Link>
              {" / Range Ladder"}
            </p>
            <h1 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink mt-6">Range Ladder Controls</h1>
            <p className="mt-4 text-xl text-ink-secondary max-w-2xl">Open or close the deposit window, mint vertical range positions, redeem settled ranges back to vault cash. Operator-gated on chain.</p>
            <p className="mt-3 font-mono text-xs text-ink-muted">RangeKey hex: BCS encoding of oracle_id (32 bytes) + expiry u64 + lower_strike u64 + higher_strike u64. Obtain from the CLI or predict-server.</p>
          </Container>
        </section>
        <section className="py-16">
          <Container>
            <div className="max-w-2xl">
              <RangeLadderOperatorControls />
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
