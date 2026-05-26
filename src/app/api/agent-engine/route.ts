import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded, runTick, snapshot } from "@/agents/GameManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron-triggered fallback ticker. The SSE stream drives play in real time
 * while users are watching, but Vercel may scale instances to zero between
 * page loads — this cron keeps the global tick alive.
 *
 * Protected by CRON_SECRET. Vercel automatically attaches its own bearer
 * token to cron requests; for manual invocation, send the secret as a
 * query param.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  const url = new URL(req.url);
  const q = url.searchParams.get("secret") ?? "";

  // Vercel cron uses Authorization: Bearer ${CRON_SECRET}.
  const vercelOk = secret && auth === `Bearer ${secret}`;
  const manualOk = secret && q && q === secret;
  // In mock mode, allow open access so deployment health-check curl works.
  const devOpen = (process.env.MOCK_BLOCKCHAIN ?? "true") !== "false";

  if (!vercelOk && !manualOk && !devOpen) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  ensureSeeded();

  // Burst-tick: cron fires at most every 60s, so do multiple ticks to keep
  // games moving for users who arrive between SSE sessions.
  const startedAt = Date.now();
  let ticks = 0;
  // Cap at ~25s so we stay well under maxDuration.
  while (Date.now() - startedAt < 25_000 && ticks < 30) {
    await runTick();
    ticks += 1;
    await new Promise((r) => setTimeout(r, 800));
  }

  const snap = await snapshot();
  return NextResponse.json({
    ok: true,
    ticks,
    activeGames: snap.games.length,
    stats: snap.stats,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
