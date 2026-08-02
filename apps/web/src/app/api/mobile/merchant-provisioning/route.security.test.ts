import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('authenticated mobile provisioning route boundaries', () => {
  it('contains no legacy signup, privileged client, preflight, or direct table writes', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/mobile/merchant-provisioning/route.ts'
      ),
      'utf8'
    );

    for (const forbidden of [
      'auth.signUp',
      'checkPasswordBreach',
      'createAdminClient',
      'resolveMerchantIdBySlugOrAlias',
      ".from('merchants')",
      ".from('domains')",
      ".from('staff_members')",
    ])
      expect(source).not.toContain(forbidden);
  });
});
