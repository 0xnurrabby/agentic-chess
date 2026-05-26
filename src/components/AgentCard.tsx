"use client";

import type { Agent } from "@/types";
import { explorerAddrUrl, shortAddr } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

const PERSONALITY_COLOR: Record<string, string> = {
  RANDOM: "bg-gray-500/15 text-gray-400",
  AGGRESSIVE: "bg-red-500/15 text-red-400",
  DEFENSIVE: "bg-blue-500/15 text-blue-400",
  POSITIONAL: "bg-purple-500/15 text-purple-400",
  TACTICAL: "bg-amber-500/15 text-amber-400",
  GRANDMASTER: "bg-accent-emerald/15 text-accent-emerald",
};

export default function AgentCard({
  agent,
  side,
  active,
}: {
  agent: Agent | undefined;
  side: "w" | "b";
  active?: boolean;
}) {
  if (!agent) return null;
  const chain = process.env.NEXT_PUBLIC_CHAIN ?? "base-sepolia";

  return (
    <div
      className={`flex items-center justify-between rounded-lg border bg-[var(--card)] p-3 transition ${
        active
          ? "border-accent-indigo shadow-[0_0_0_1px_rgba(99,102,241,0.4)]"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
          style={{ background: `${agent.color}33`, border: `1px solid ${agent.color}` }}
        >
          {agent.avatar}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`mono text-[10px] uppercase ${
                side === "w" ? "text-amber-300" : "text-slate-300"
              }`}
            >
              {side === "w" ? "White" : "Black"}
            </span>
            {active && (
              <span className="rounded bg-accent-indigo/20 px-1.5 py-0.5 text-[10px] text-accent-indigo">
                to move
              </span>
            )}
          </div>
          <div className="truncate font-semibold">{agent.name}</div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                PERSONALITY_COLOR[agent.personality] ?? "bg-gray-500/15 text-gray-400"
              }`}
            >
              {agent.personality.toLowerCase()}
            </span>
            <a
              href={explorerAddrUrl(agent.walletAddress, chain)}
              target="_blank"
              rel="noreferrer"
              className="mono inline-flex items-center gap-0.5 hover:text-accent-indigo"
            >
              {shortAddr(agent.walletAddress)}
              <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="mono text-xl font-bold">{agent.elo}</div>
        <div className="text-[10px] text-[var(--muted)]">
          {agent.record.wins}W · {agent.record.losses}L · {agent.record.draws}D
        </div>
      </div>
    </div>
  );
}
