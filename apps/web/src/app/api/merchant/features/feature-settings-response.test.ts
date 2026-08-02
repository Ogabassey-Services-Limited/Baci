import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { jsonNoStore, withNoStore } from './feature-settings-response';

describe('feature settings no-store responses', () => {
  it('makes JSON settings responses private and non-cacheable', async () => {
    const response = jsonNoStore({ enabled: true }, { status: 201 });

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toContain(
      'private, no-store'
    );
    await expect(response.json()).resolves.toEqual({ enabled: true });
  });

  it('preserves an existing response while applying no-store headers', () => {
    const response = withNoStore(
      NextResponse.json({ error: 'denied' }, { status: 403 })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toContain(
      'private, no-store'
    );
  });
});
