// Zod schemas for the `reconcile-paystack-dva.ts` CLI. Lives under
// `schemas/` per the project rule "Move inline Zod schemas to the
// schemas/ directory" (CLAUDE.md). The CLI is not a web boundary, but
// operator typos here trigger irreversible production state changes
// (cancel duplicate orders + flip canonical to paid), so the validation
// surface deserves the same rigor as `/api/*` routes.

import { z } from 'zod';

export const uuidSchema = z.string().uuid({ message: 'expected a UUID' });

// Cancel list arrives as a comma-separated string (`a,b,c`). Empty
// string is allowed and resolves to `[]` — the script supports the no-
// duplicates path (e.g. recovery for a single stuck order).
export const cancelOrdersSchema = z
  .string()
  .transform((raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  )
  .pipe(z.array(uuidSchema));

export const reconcileArgsSchema = z.object({
  '--transaction-id': uuidSchema,
  '--paystack-reference': z.string().min(1, '--paystack-reference is empty'),
  '--canonical-order-id': uuidSchema,
  '--cancel-orders': cancelOrdersSchema,
  '--operator-user-id': uuidSchema,
});

export type ReconcileArgsInput = z.input<typeof reconcileArgsSchema>;
export type ReconcileArgsParsed = z.output<typeof reconcileArgsSchema>;
