import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const actuatorSource = readFileSync(
  resolve(
    process.cwd(),
    'src/app/api/internal/storefront-cache-actuator/route.ts'
  ),
  'utf8'
);

describe('storefront cache actuator boundary', () => {
  it('keeps database authority and Cloudflare credentials out of the route', () => {
    expect(actuatorSource).not.toMatch(/supabase/i);
    expect(actuatorSource).not.toMatch(/finish_event_delivery/i);
    expect(actuatorSource).not.toMatch(/CLOUDFLARE_(?:API_TOKEN|ZONE_ID)/);
  });

  it('uses raw-body authentication before parsing the request JSON', () => {
    expect(actuatorSource.indexOf('const authentication')).toBeLessThan(
      actuatorSource.indexOf('JSON.parse(rawBody)')
    );
  });
});
