import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { OperatorControls } from "@/app/operator/OperatorControls";

export default function OperatorPage() {
  return (
    <>
      <Header />
      <main>
        <section className="border-b border-border py-16 lg:py-24">
          <Container>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-6">Admin / Operator</p>
            <h1 className="font-display text-5xl lg:text-6xl leading-tight tracking-tight text-ink">Strategy Controls</h1>
            <p className="mt-4 text-xl text-ink-secondary max-w-2xl">Open or close the deposit window, deploy vault cash to PLP, redeem PLP back to cash. Operator-gated on chain.</p>
          </Container>
        </section>
        <section className="py-16">
          <Container>
            <div className="max-w-2xl">
              <OperatorControls />
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}