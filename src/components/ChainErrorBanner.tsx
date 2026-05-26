"use client";

import { useGameStore } from "@/store/gameStore";
import { AlertTriangle, FlaskConical, Radio } from "lucide-react";

export default function ChainErrorBanner() {
  const err = useGameStore((s) => s.chainError);
  const mode = useGameStore((s) => s.mode);
  const missingEnv = useGameStore((s) => s.missingEnv);

  if (mode === "mock") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <FlaskConical size={18} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-amber-300">
            DEMO MODE — txn hashes shown below are simulated
          </div>
          <div className="mt-1 text-xs text-amber-200/90">
            To send real transactions on Base mainnet, set the following in{" "}
            <code className="mono">.env.local</code>:
            {missingEnv.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 mono text-amber-200/80">
                {missingEnv.map((k) => (
                  <li key={k}>
                    {k}
                    {k === "CDP_WALLET_SECRET" && (
                      <span className="ml-2 not-italic text-amber-200/60">
                        — get from{" "}
                        <a
                          className="underline"
                          href="https://portal.cdp.coinbase.com"
                          target="_blank"
                          rel="noreferrer"
                        >
                          portal.cdp.coinbase.com → Wallets → Wallet Secret
                        </a>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="ml-1 mono">
                MOCK_BLOCKCHAIN=false
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-accent-emerald/40 bg-accent-emerald/10 p-2.5 text-sm text-accent-emerald">
        <Radio size={16} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-semibold">LIVE on Base mainnet</span>
          <span className="ml-2 text-xs text-accent-emerald/80">
            CDP smart accounts · Paymaster sponsored · Builder Code attributed
          </span>
        </div>
      </div>

      {err.message && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-red-300">Onchain txn error</div>
            <div className="mono mt-1 break-all text-xs text-red-200/90">{err.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}
