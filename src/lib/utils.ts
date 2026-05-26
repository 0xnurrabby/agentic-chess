import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortHash(hash?: string, chars = 4): string {
  if (!hash) return "";
  return `${hash.slice(0, 2 + chars)}…${hash.slice(-chars)}`;
}

export function shortAddr(addr?: string): string {
  return shortHash(addr, 4);
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function explorerTxUrl(hash: string, chain: string): string {
  const base =
    chain === "base"
      ? "https://basescan.org/tx/"
      : "https://sepolia.basescan.org/tx/";
  return `${base}${hash}`;
}

export function explorerAddrUrl(addr: string, chain: string): string {
  const base =
    chain === "base"
      ? "https://basescan.org/address/"
      : "https://sepolia.basescan.org/address/";
  return `${base}${addr}`;
}
