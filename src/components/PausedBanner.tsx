"use client";

import { Pause } from "lucide-react";
import { useGameStore } from "@/store/gameStore";

export default function PausedBanner() {
  const paused = useGameStore((s) => s.paused);
  if (!paused) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
      <Pause size={14} className="shrink-0 text-amber-400" />
      <span className="font-semibold text-amber-300">Platform paused</span>
      <span className="text-amber-200/80">
        New moves and games are frozen. Existing positions are preserved — set
        <code className="mono mx-1 rounded bg-amber-500/15 px-1 py-0.5">GAME_ENABLED=on</code>
        and redeploy to resume.
      </span>
    </div>
  );
}
