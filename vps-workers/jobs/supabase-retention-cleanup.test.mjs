import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runSupabaseRetentionCleanup } from './supabase-retention-cleanup.mjs';

const noop = () => undefined;
const noopLogger = {
  error: noop,
  info: noop,
};

describe('supabase retention cleanup worker', () => {
  it('calls the service-role retention RPC with bounded defaults', async () => {
    const calls = [];
    const supabase = {
      rpc(name, params) {
        calls.push({ name, params });
        return Promise.resolve({
          data: [
            {
              analytics_events_deleted: 7,
              cron_job_run_details_deleted: 3,
              pg_net_responses_deleted: 2,
            },
          ],
          error: null,
        });
      },
    };

    const result = await runSupabaseRetentionCleanup({
      logger: noopLogger,
      supabase,
    });

    assert.deepEqual(calls, [
      {
        name: 'cleanup_database_retention',
        params: {
          p_analytics_low_value_retention: '30 days',
          p_cron_retention: '14 days',
          p_pg_net_retention: '1 day',
        },
      },
    ]);
    assert.deepEqual(result, {
      analytics_events_deleted: 7,
      cron_job_run_details_deleted: 3,
      pg_net_responses_deleted: 2,
    });
  });
});
