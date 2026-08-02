import { z } from 'zod';

/**
 * The `[categoryId]` path segment.
 *
 * Postgres rejects a non-UUID with 22P02, which the route would otherwise
 * surface as a 500 — a malformed URL is the client's error, not the server's.
 * Validating here turns it into a 400 and keeps a driver-level message out of
 * the response body.
 */
export const categoryIdParamSchema = z.uuid();
