import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const modulePath = resolve(
  process.cwd(),
  'src/lib/events/event-pipeline-test-client.ts'
);

describe('event pipeline caller-scoped test client', () => {
  it('uses a real generated Database client with an injected fetch', async () => {
    expect(existsSync(modulePath), 'caller test client is missing').toBe(true);
    if (!existsSync(modulePath)) return;
    const moduleUrl = pathToFileURL(modulePath).href;
    const { createEventPipelineTestClient } = await import(
      /* @vite-ignore */ moduleUrl
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ ok: true })
    );
    const client = createEventPipelineTestClient(fetch);
    await client.from('merchants').select('id');
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/rest/v1/merchants');
  });

  it('surfaces a non-2xx PostgREST response', async () => {
    const { createEventPipelineTestClient } = await import(
      /* @vite-ignore */ pathToFileURL(modulePath).href
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(
        { code: 'PGRST301', message: 'permission denied' },
        { status: 403 }
      )
    );
    const result = await createEventPipelineTestClient(fetch)
      .from('merchants')
      .select('id');
    expect(result.error).toMatchObject({ message: 'permission denied' });
  });
});
