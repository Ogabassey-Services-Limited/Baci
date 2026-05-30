import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractStylesheetUrls,
  fetchCssBudget,
} from './assert-ogabassey-css-budget.mjs';

function response(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    statusText: init.statusText || 'OK',
    headers: init.headers || {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('extractStylesheetUrls', () => {
  it('returns absolute URLs for route stylesheet links only', () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/chunks/core.css">
      <link rel="preload" href="/_next/static/chunks/later.css" as="style">
      <link href="https://cdn.example.com/app.css" rel="stylesheet">
    `;

    expect(extractStylesheetUrls(html, 'https://ogabassey.com/path')).toEqual([
      'https://ogabassey.com/_next/static/chunks/core.css',
      'https://cdn.example.com/app.css',
    ]);
  });

  it('skips malformed stylesheet href values', () => {
    const html = `
      <link rel="stylesheet" href="https://[bad">
      <link rel="stylesheet" href="/_next/static/chunks/core.css">
    `;

    expect(extractStylesheetUrls(html, 'https://ogabassey.com/path')).toEqual([
      'https://ogabassey.com/_next/static/chunks/core.css',
    ]);
  });
});

describe('fetchCssBudget', () => {
  it('returns a passing budget with raw and declared CSS bytes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response('<link rel="stylesheet" href="/_next/static/chunks/core.css">')
      )
      .mockResolvedValueOnce(
        response('body{color:red}', {
          headers: { 'content-length': '15' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchCssBudget('https://ogabassey.com/pdp', {
        maxSingleRawBytes: 100,
        maxTotalRawBytes: 100,
      })
    ).resolves.toMatchObject({
      largestRawBytes: 15,
      passed: true,
      totalDeclaredBytes: 15,
      totalRawBytes: 15,
    });
  });

  it('returns a budget violation when CSS exceeds the limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          response(
            '<link rel="stylesheet" href="/_next/static/chunks/large.css">'
          )
        )
        .mockResolvedValueOnce(response('x'.repeat(20)))
    );

    await expect(
      fetchCssBudget('https://ogabassey.com/pdp', {
        maxSingleRawBytes: 10,
        maxTotalRawBytes: 10,
      })
    ).resolves.toMatchObject({
      largestRawBytes: 20,
      passed: false,
      totalDeclaredBytes: 20,
      totalRawBytes: 20,
    });
  });

  it('throws a clear error when the HTML request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        response('nope', {
          status: 500,
          statusText: 'Server Error',
        })
      )
    );

    await expect(
      fetchCssBudget('https://ogabassey.com/pdp', {
        maxSingleRawBytes: 10,
        maxTotalRawBytes: 10,
      })
    ).rejects.toThrow(
      'Failed to fetch https://ogabassey.com/pdp: 500 Server Error'
    );
  });

  it('falls back to raw CSS bytes when content-length is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          response(
            '<link rel="stylesheet" href="/_next/static/chunks/core.css">'
          )
        )
        .mockResolvedValueOnce(response('abcd'))
    );

    await expect(
      fetchCssBudget('https://ogabassey.com/pdp', {
        maxSingleRawBytes: 10,
        maxTotalRawBytes: 10,
      })
    ).resolves.toMatchObject({
      totalDeclaredBytes: 4,
      totalRawBytes: 4,
    });
  });
});
