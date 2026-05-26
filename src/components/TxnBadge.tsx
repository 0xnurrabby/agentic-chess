"use client";

import type { MoveRecord } from "@/types";
import { useGameStore } from "@/store/gameStore";
import { explorerTxUrl, shortHash } from "@/lib/utils";
import { Check, Clock, X, ExternalLink, FlaskConical } from "lucide-react";

export default function TxnBadge({ move }: { move: MoveRecord }) {
  const chain = process.env.NEXT_PUBLIC_CHAIN ?? "base-sepolia";
  const mode = useGameStore((s) => s.mode);

  if (move.txStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
        <Clock size={10} className="animate-pulse" /> pending
      </span>
    );
  }
  if (move.txStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
        <X size={10} /> failed
      </span>
    );
  }

  // Demo mode → show a clearly-labeled placeholder, NOT a fake explorer link.
  if (mode === "mock") {
    return (
      <span
        className="mono inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400"
        title="Simulated hash — DEMO MODE. Set CDP_WALLET_SECRET to enable real txns."
      >
        <FlaskConical size={10} /> demo
      </span>
    );
  }

  // Rehydrated moves (loaded from Redis after a cold-start) don't carry a
  // per-move tx hash — we know the move happened on chain (chain.moveCount
  // says so) but the individual hash lives in the original instance's
  // memory. Show a non-link "onchain" badge instead of a dead link.
  if (!move.txHash) {
    return (
      <span
        className="mono inline-flex items-center gap-1 rounded bg-accent-emerald/15 px-1.5 py-0.5 text-[10px] text-accent-emerald"
        title="Recorded on chain. Tx hash not available on this server instance."
      >
        <Check size={10} /> onchain
      </span>
    );
  }

  return (
    <a
      href={explorerTxUrl(move.txHash, chain)}
      target="_blank"
      rel="noreferrer"
      className="mono inline-flex items-center gap-1 rounded bg-accent-emerald/15 px-1.5 py-0.5 text-[10px] text-accent-emerald hover:bg-accent-emerald/25"
    >
      <Check size={10} />
      {shortHash(move.txHash, 3)}
      <ExternalLink size={9} />
    </a>
  );
}
