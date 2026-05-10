// CLI argument parsing for `reconcile-paystack-dva.ts`.
//
// Extracted to keep the main script under the 300-line per-file cap and
// to satisfy the project rule "all input validation goes through Zod"
// (CLAUDE.md). The CLI is not a web boundary, but operator typos here
// trigger irreversible production state changes (cancel duplicate
// orders + flip canonical to paid), so the validation surface deserves
// the same rigor as `/api/*` routes.

import { z } from 'zod';

const uuidSchema = z.string().uuid({ message: 'expected a UUID' });

// Cancel list arrives as a comma-separated string (`a,b,c`). Empty
// string is allowed and resolves to `[]` — the script supports the no-
// duplicates path (e.g. recovery for a single stuck order).
const cancelOrdersSchema = z
  .string()
  .transform((raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  )
  .pipe(z.array(uuidSchema));

const reconcileArgsSchema = z.object({
  '--transaction-id': uuidSchema,
  '--paystack-reference': z.string().min(1, '--paystack-reference is empty'),
  '--canonical-order-id': uuidSchema,
  '--cancel-orders': cancelOrdersSchema,
  '--operator-user-id': uuidSchema,
});

export type ParsedArgs = {
  transactionId: string;
  paystackReference: string;
  canonicalOrderId: string;
  cancelOrders: string[];
  operatorUserId: string;
};

export type ParseResult =
  | { ok: true; args: ParsedArgs }
  | { ok: false; error: string };

export function parseReconcileArgs(argv: readonly string[]): ParseResult {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!(key && key.startsWith('--')) || value === undefined) {
      return { ok: false, error: `malformed flag near "${key ?? '<end>'}"` };
    }
    map.set(key, value);
  }

  const parsed = reconcileArgsSchema.safeParse(Object.fromEntries(map));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue) {
      const flag = String(issue.path[0] ?? '<unknown>');
      return { ok: false, error: `${flag}: ${issue.message}` };
    }
    return { ok: false, error: 'invalid arguments' };
  }

  const data = parsed.data;
  return {
    ok: true,
    args: {
      transactionId: data['--transaction-id'],
      paystackReference: data['--paystack-reference'],
      canonicalOrderId: data['--canonical-order-id'],
      cancelOrders: data['--cancel-orders'],
      operatorUserId: data['--operator-user-id'],
    },
  };
}
