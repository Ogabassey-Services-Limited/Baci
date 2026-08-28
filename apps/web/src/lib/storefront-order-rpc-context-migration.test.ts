import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260828090000_harden_storefront_order_rpc_context_and_replays.sql'
  ),
  'utf8'
);
const hashPreparationMigration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260828110000_prepare_storefront_order_hash_stamping.sql'
  ),
  'utf8'
);
const replayContextMigration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260828120000_enforce_storefront_order_replay_route_context.sql'
  ),
  'utf8'
);

describe('storefront order RPC context migration contract', () => {
  it('requires a signed merchant-bound route context for non-internal inserts', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION private.enforce_storefront_order_route_context()'
    );
    expect(migration).toContain("'storefront_order_context'");
    expect(migration).toContain("'storefront_order_merchant_id'");
    expect(migration).toContain("'agentic_context'");
    expect(migration).toContain("'storefront_order_route_context_required'");
    expect(migration).toContain('BEFORE INSERT ON public.orders');
  });

  it('preserves only the signed customer-owned legacy quiz award path', () => {
    expect(migration).toContain("'quiz_award_context'");
    expect(migration).toContain("'legacy-answer'");
    expect(migration).toContain("NEW.payment_method = 'quiz_award'");
    expect(migration).toContain("NEW.source = 'quiz_prize'");
    expect(migration).toContain('c.user_id = (SELECT auth.uid())');
    expect(migration).toContain('c.merchant_id = NEW.merchant_id');

    const quizMigration = readFileSync(
      resolve(
        process.cwd(),
        '../../supabase/migrations/20260828100000_allow_legacy_quiz_award_order_context.sql'
      ),
      'utf8'
    );

    expect(quizMigration).toContain("'quiz_award_context'");
    expect(quizMigration).toContain("'legacy-answer'");
    expect(quizMigration).toContain("NEW.payment_method = 'quiz_award'");
    expect(quizMigration).toContain("NEW.source = 'quiz_prize'");
    expect(quizMigration).toContain('c.user_id = (SELECT auth.uid())');
    expect(quizMigration).toContain('c.merchant_id = NEW.merchant_id');
  });

  it('marks new orders and exposes only a legacy-version boolean probe', () => {
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS checkout_request_hash_version smallint'
    );
    expect(migration).toContain('NEW.checkout_request_hash_version := 2');
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.is_legacy_storefront_order_idempotency_key('
    );
    expect(migration).toContain('o.checkout_request_hash_version IS NULL');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION');
    expect(migration).toContain('TO anon, authenticated');
  });

  it('prepares hash stamping before the postdeploy route-context migration', () => {
    expect(hashPreparationMigration).toContain(
      'ADD COLUMN IF NOT EXISTS checkout_request_hash_version smallint'
    );
    expect(hashPreparationMigration).toContain(
      'NEW.checkout_request_hash_version := 2'
    );
    expect(hashPreparationMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.is_legacy_storefront_order_idempotency_key('
    );
    expect(hashPreparationMigration).not.toContain(
      'enforce_storefront_order_route_context'
    );
  });

  it('guards idempotent replay updates with the same route context', () => {
    expect(replayContextMigration).toContain('BEFORE UPDATE ON public.orders');
    expect(replayContextMigration).toContain(
      'OLD.checkout_idempotency_key IS NOT NULL'
    );
    expect(replayContextMigration).toContain(
      'private.enforce_storefront_order_route_context()'
    );
  });
});
