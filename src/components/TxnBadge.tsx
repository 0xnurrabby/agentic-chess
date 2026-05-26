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

  return (
    <a
      href={move.txHash ? explorerTxUrl(move.txHash, chain) : "#"}
      target="_blank"
      rel="noreferrer"
      className="mono inline-flex items-center gap-1 rounded bg-accent-emerald/15 px-1.5 py-0.5 text-[10px] text-accent-emerald hover:bg-accent-emerald/25"
    >
      <Check size={10} />
      {move.txHash ? shortHash(move.txHash, 3) : "ok"}
      <ExternalLink size={9} />
    </a>
  );
}
