import { z } from 'zod';

/**
 * Date-of-birth validation shared by the customer profile PATCH route and the
 * quiz age-gate capture UI. Stored as an ISO `YYYY-MM-DD` string on
 * `customers.date_of_birth` (the quiz age gate parses it as a UTC date).
 *
 * This validates that the value is a real, past calendar date within a
 * plausible lifespan — it does NOT decide quiz eligibility. The 18+ decision is
 * owned server-side by `enforceQuizAgeGate`, which remains the single source of
 * truth; the client only collects a well-formed DOB.
 */

const MAX_PLAUSIBLE_AGE_YEARS = 120;

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  // A rolled-over date (e.g. 2026-02-30 → Mar 2) fails this identity check.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isPastWithinLifespan(value: string): boolean {
  const dob = new Date(`${value}T00:00:00.000Z`).getTime();
  if (Number.isNaN(dob)) {
    return false;
  }
  const now = new Date();
  // Reject today and any future date. The DOB RPC rejects `>= now()::date`, and
  // the native date picker opens on today, so accepting today here would let a
  // value through the client only for the server to reject it.
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  if (dob >= todayUtc) {
    return false;
  }
  const earliest = Date.UTC(
    now.getUTCFullYear() - MAX_PLAUSIBLE_AGE_YEARS,
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return dob >= earliest;
}

export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth as YYYY-MM-DD')
  .refine(isRealCalendarDate, 'Enter a valid date')
  .refine(isPastWithinLifespan, 'Enter a valid date of birth');

export type DateOfBirth = z.infer<typeof dateOfBirthSchema>;
