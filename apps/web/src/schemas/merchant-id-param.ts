import { z } from 'zod';

/**
 * A `merchantId` supplied by the client as an ASSERTION of which store to act
 * on. It selects among the merchants the caller already reaches; it never
 * grants access. Validated as a UUID because it is compared directly against
 * UUID columns — a malformed value would otherwise surface as a driver error
 * the resolver collapses into a misleading 404.
 */
export const merchantIdParamSchema = z.uuid();
