import Navbar from "@/components/Navbar";
import LiveConnection from "@/components/LiveConnection";
import GameGrid from "@/components/GameGrid";
import GameDetail from "@/components/GameDetail";
import PausedBanner from "@/components/PausedBanner";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      <LiveConnection />

      <main className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
        <PausedBanner />

        <section>
          <SectionHeader
            title="Live games"
            subtitle="Click any board to focus it below"
          />
          <GameGrid />
        </section>

        <section>
          <SectionHeader
            title="Featured game"
            subtitle="Full board, move log, and onchain receipts"
          />
          <GameDetail />
        </section>
      </main>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h2>
        <p className="text-xs text-[var(--muted)]">{subtitle}</p>
      </div>
    </div>
  );
}
