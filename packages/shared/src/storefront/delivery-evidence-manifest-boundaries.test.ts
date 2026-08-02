import { describe, expect, it } from 'vitest';
import { StorefrontDeliveryEvidenceManifestSchema } from './delivery-evidence-manifest';

describe('StorefrontDeliveryEvidenceManifest hostname boundaries', () => {
  it('rejects line breaks in alias and inventory hostnames at schema parse time', () => {
    const lineBreakHostname = 'www.ogabassey.com\nforged';
    const result = StorefrontDeliveryEvidenceManifestSchema.safeParse({
      aliasHostnames: ['ogabassey.usebaci.com', lineBreakHostname],
      inventoryHostnames: [
        'ogabassey.com',
        'ogabassey.usebaci.com',
        lineBreakHostname,
      ],
    });
    if (result.success) throw new Error('expected hostname validation to fail');
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('aliasHostnames.1');
    expect(paths).toContain('inventoryHostnames.2');
  });
});
