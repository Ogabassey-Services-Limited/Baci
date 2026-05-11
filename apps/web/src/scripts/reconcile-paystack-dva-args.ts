// CLI argument parsing for `reconcile-paystack-dva.ts`. The Zod
// schemas live in `@/schemas/reconcile-paystack-dva` per the project
// rule "Move inline Zod schemas to the schemas/ directory" (CLAUDE.md).
// This file only owns the argv→schema-input mapping and the parse
// result shape.

import { reconcileArgsSchema } from '@/schemas/reconcile-paystack-dva';

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
