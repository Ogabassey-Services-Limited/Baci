import { z } from 'zod';

/**
 * Public customer repair-status lookup input. Strict + normalizing: the ticket
 * number is stripped of any decoration ("#1042" -> 1042) and the email is
 * trimmed/lower-cased so the comparison matches the DB's normalized contract.
 */
export const repairStatusLookupSchema = z.object({
  ticketNumber: z.preprocess(
    (value) =>
      typeof value === 'string' ? value.replace(/[^0-9]/g, '') : value,
    z.coerce.number().int().positive()
  ),
  email: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.email()
  ),
});

export type RepairStatusLookupInput = z.infer<typeof repairStatusLookupSchema>;
