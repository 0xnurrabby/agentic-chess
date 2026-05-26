import { NextRequest } from "next/server";
import { ensureSeeded, runTick, snapshot } from "@/agents/GameManager";
import { leaderboard } from "@/agents/AgentPool";
import { getLastChainError, isMockMode } from "@/blockchain/sendMove";
import { cdpMissingEnvList } from "@/blockchain/cdpClient";
import type { Agent } from "@/types";

// Server-Sent Events stream. Each connection drives a self-scheduling tick
// loop so games progress in real time without depending on Vercel cron.
// (Vercel cron has a 1-min minimum; we want a few-second ticks.)

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// SSE connections must stay open for a while.
export const maxDuration = 60;

const ENCODER = new TextEncoder();
// Vercel free tier is bandwidth-sensitive. 2.5s ticks reduce per-viewer
// bandwidth roughly 40% versus 1.5s while still feeling live.
const TICK_INTERVAL_MS = 2500;
// Leaderboard is expensive (sort + slice the whole pool) and changes slowly.
// Cache it across ticks and refresh every 15 seconds.
const LEADERBOARD_TTL_MS = 15_000;

let leaderboardCache: { at: number; data: Agent[] } | null = null;
function cachedLeaderboard(): Agent[] {
  const now = Date.now();
  if (leaderboardCache && now - leaderboardCache.at < LEADERBOARD_TTL_MS) {
    return leaderboardCache.data;
  }
  const data = leaderboard(20);
  leaderboardCache = { at: now, data };
  return data;
}

export async function GET(_req: NextRequest) {
  ensureSeeded();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | null = null;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          const chunk =
            `event: ${event}\n` +
            `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(ENCODER.encode(chunk));
        } catch {
          // Stream might be closing.
        }
      };

      const sendSnapshot = (event: string) => {
        const snap = snapshot();
        send(event, {
          ...snap,
          leaderboard: cachedLeaderboard(),
          chainError: getLastChainError(),
          mode: isMockMode() ? "mock" : "live",
          missingEnv: cdpMissingEnvList(),
          timestamp: Date.now(),
        });
      };

      // Initial snapshot
      sendSnapshot("init");

      interval = setInterval(async () => {
        try {
          await runTick();
          sendSnapshot("tick");
        } catch (err) {
          send("error", { message: (err as Error)?.message ?? "tick failed" });
        }
      }, TICK_INTERVAL_MS);

      // Heartbeat comment every 15s so proxies don't close the stream.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(ENCODER.encode(`: ping\n\n`));
        } catch {
          /* ignore */
        }
      }, 15_000);

      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      // When the client disconnects, the runtime will abort the stream.
      _req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
