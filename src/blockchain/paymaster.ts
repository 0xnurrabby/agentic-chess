/**
 * Paymaster helpers — kept thin since the CDP v2 SDK handles paymaster
 * sponsorship automatically on Base when sendUserOperation is called.
 * If PAYMASTER_URL is set in env, it overrides the managed paymaster.
 */
export { isMockMode } from "./sendMove";

export function paymasterUrl(): string | undefined {
  return process.env.PAYMASTER_URL || undefined;
}
