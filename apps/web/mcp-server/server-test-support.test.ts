import { afterEach, describe, expect, it, vi } from 'vitest';
import { mcpServerTestSupport } from './server-test-support';

describe('mcpServerTestSupport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns object results and rejects malformed payloads', () => {
    expect(
      mcpServerTestSupport.getResultRecord({ result: { status: 'pending' } })
    ).toEqual({ status: 'pending' });
    expect(() => mcpServerTestSupport.getResultRecord({})).toThrow(
      'MCP response did not include a result object'
    );
  });

  it('returns tool lists and rejects non-array tool payloads', () => {
    expect(
      mcpServerTestSupport.getResultTools({
        result: { tools: [{ inputSchema: { properties: {} }, name: 'search' }] },
      })
    ).toHaveLength(1);
    expect(() =>
      mcpServerTestSupport.getResultTools({ result: { tools: null } })
    ).toThrow('MCP tools/list response tools field was not an array');
  });

  it('isolates inherited DVA mode unless the test overrides it', () => {
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'enabled');

    expect(
      mcpServerTestSupport.buildMcpServerEnv({})
        .AGENTIC_PAYSTACK_DVA_MODE
    ).toBeUndefined();
    expect(
      mcpServerTestSupport.buildMcpServerEnv({
        AGENTIC_PAYSTACK_DVA_MODE: 'paused',
      }).AGENTIC_PAYSTACK_DVA_MODE
    ).toBe('paused');
  });
});
