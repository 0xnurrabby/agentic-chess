"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

/**
 * Mounts once. Opens an SSE connection to /api/games and forwards every
 * snapshot into the Zustand store. Reconnects on error with exponential
 * backoff (capped at 10s).
 */
export default function LiveConnection() {
  const setSnapshot = useGameStore((s) => s.setSnapshot);
  const setConnected = useGameStore((s) => s.setConnected);

  useEffect(() => {
    let es: EventSource | null = null;
    let backoff = 1000;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (stopped) return;
      es = new EventSource("/api/games");

      const handleSnap = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setSnapshot({
            games: data.games ?? [],
            agents: data.agents ?? {},
            leaderboard: data.leaderboard ?? [],
            stats: data.stats ?? {
              totalGames: 0,
              totalMoves: 0,
              totalTxns: 0,
              pendingTxns: 0,
              chain: "base-sepolia",
            },
            chainError: data.chainError,
            mode: data.mode,
            missingEnv: data.missingEnv,
          });
          setConnected(true);
          backoff = 1000;
        } catch (err) {
          console.warn("[SSE] parse failed", err);
        }
      };

      es.addEventListener("init", handleSnap);
      es.addEventListener("tick", handleSnap);
      es.addEventListener("move", handleSnap);
      es.addEventListener("gameStart", handleSnap);
      es.addEventListener("gameEnd", handleSnap);

      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (stopped) return;
        backoff = Math.min(backoff * 1.8, 10_000);
        reconnectTimer = setTimeout(connect, backoff);
      };
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      setConnected(false);
    };
  }, [setSnapshot, setConnected]);

  return null;
}
