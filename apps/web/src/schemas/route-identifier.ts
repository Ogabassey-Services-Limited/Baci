import { z } from 'zod';

export const RouteIdentifierSchema = z
  .string()
  .min(1, 'Route identifier cannot be empty')
  .max(255, 'Route identifier cannot exceed 255 characters')
  // This schema validates both merchant slugs and custom-domain hostnames.
  // Hostnames need dots; proxy subdomain validation remains stricter.
  .regex(
    /^(?!.*\.\.)[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/,
    'Route identifier must start and end with a lowercase letter or digit and contain only lowercase letters, digits, hyphens, and dots'
  )
  .describe('Baci storefront route identifier slug or hostname');

export type RouteIdentifier = z.infer<typeof RouteIdentifierSchema>;
