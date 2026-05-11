import { z } from 'zod';

// Δ-36 (A3): mobile-admin sends `notes: ""` when the optional Notes
// input is blank. Pre-A3 the schema's `.min(1)` rejected the whole
// payload as 'Invalid request body'. Normalize blank/whitespace to
// undefined BEFORE validation so staff can record cash/POS payments
// without typing a note. Defense-in-depth at the schema layer — the
// mobile-admin caller is also updated to omit blanks (Δ-36 again), but
// the schema must not depend on caller hygiene.
function normalizeOptionalString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const recordPaymentBodySchema = z.object({
  amount: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z
      .number()
      .finite('Amount must be a finite number')
      .gt(0, 'Amount must be greater than 0')
      .refine(
        (v) => Number.parseFloat(v.toFixed(2)) === v,
        'Amount must have at most 2 decimal places'
      )
  ),
  payment_method: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional()
  ),
  reference: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional()
  ),
  notes: z.preprocess(normalizeOptionalString, z.string().min(1).optional()),
});

export type RecordPaymentBodyInput = z.infer<typeof recordPaymentBodySchema>;
