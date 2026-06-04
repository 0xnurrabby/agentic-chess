import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded, runCatchUp, snapshot } from "@/agents/GameManager";

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

  // Vercel Hobby cron is low-frequency and every second counts against
  // function usage, so keep this as a bounded wake-up instead of a daemon.
  const ticks = await runCatchUp({
    maxTicks: parseInt(process.env.BACKGROUND_CATCHUP_TICKS ?? "8", 10),
    maxDurationMs: parseInt(process.env.BACKGROUND_CATCHUP_MS ?? "10000", 10),
    spacingMs: 500,
  });

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
