/**
 * Dark-launch flag for the web wallet bank-transfer "I've transferred —
 * checking…" loop (poll + credit detection + utility purchase resume).
 *
 * Defaults OFF: with the env var unset, every surface renders exactly what it
 * renders today, so merging changes no production behaviour. Reads the literal
 * `process.env.NEXT_PUBLIC_*` expression so Next.js can inline it at build time
 * — same idiom as `NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED`.
 */
export function isWalletFundingCheckLoopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED === 'true';
}
