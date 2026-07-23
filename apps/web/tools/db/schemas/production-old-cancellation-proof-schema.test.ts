import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { productionOldCancellationProofSchema } from './production-old-cancellation-proof-schema';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../../..');
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function validFixture() {
  return {
    schemaVersion: 1,
    identity: 'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
    componentSha256:
      '6155b28720d0f4a8a20746aa1a2365e631249e940fa7339e0e19b66c28fa1e62',
    definition: {
      byteCount: 1420,
      sha256:
        'fa0ae7bf676a6c14b71aa217e8368ccd71be7a750ff5a1661f26102f72f33fd7',
    },
    overlay: {
      path: 'supabase/tests/migration_history_overlays/production_old_cancel_order_as_customer.sql',
      sha256:
        '4d40f5cb690ba63c12e900065f0c2ac1cb27db99b0c79960a715f9920c58da9c',
    },
    productionEffects: {
      fixtureSha256:
        '7e396eed09ccfc0d18e5b746e832d7aac9cbba0aabbe0432e1e600c9d8af3381',
      querySha256:
        '2b555af09c8a9cb7e8026b028c014b304de146a9f50a2c2f2a896a6626dfacbc',
      scopeManifestSha256:
        'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245',
      ledgerRowCount: 439,
      ledgerTailVersion: '20260714225500',
    },
  };
}

describe('productionOldCancellationProofSchema', () => {
  it('accepts the immutable production-old evidence contract', () => {
    expect(
      productionOldCancellationProofSchema.parse(validFixture()).componentSha256
    ).toBe('6155b28720d0f4a8a20746aa1a2365e631249e940fa7339e0e19b66c28fa1e62');
  });

  it('binds the checked fixture to the exact overlay and captured definition bytes', async () => {
    const fixture = productionOldCancellationProofSchema.parse(
      JSON.parse(
        await readFile(
          path.join(
            workspaceRoot,
            'apps/web/tools/db/fixtures/production-old-cancellation-proof.json'
          ),
          'utf8'
        )
      )
    );
    const overlay = await readFile(
      path.join(workspaceRoot, fixture.overlay.path),
      'utf8'
    );
    const definition = `${overlay.split('\n;\n', 1)[0]}\n`;

    expect(sha256(overlay)).toBe(fixture.overlay.sha256);
    expect(Buffer.byteLength(definition)).toBe(fixture.definition.byteCount);
    expect(sha256(definition)).toBe(fixture.definition.sha256);
  });

  it('rejects any changed evidence binding or unknown field', () => {
    const changed = validFixture();
    changed.definition.byteCount = 1421;
    expect(() => productionOldCancellationProofSchema.parse(changed)).toThrow();

    const unknown = {
      ...validFixture(),
      rawDefinition: 'CREATE FUNCTION secret()',
    };
    expect(() => productionOldCancellationProofSchema.parse(unknown)).toThrow();
  });
});
