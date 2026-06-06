// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /.well-known/mcp/server-card.json', () => {
  it('publishes the Ogabassey MCP server card', async () => {
    const { GET } = await import('./route');
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toMatchObject({
      $schema:
        'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
      version: '1.0',
      protocolVersion: '2025-06-18',
      serverInfo: {
        name: 'ogabassey-store',
        title: 'Ogabassey Store MCP Server',
        version: '1.0.0',
      },
      transport: {
        type: 'streamable-http',
        endpoint: 'https://mcp.ogabassey.com/mcp',
      },
      authentication: {
        required: false,
      },
    });
    expect(body.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'search_products',
          inputSchema: expect.objectContaining({ type: 'object' }),
        }),
        expect.objectContaining({
          name: 'create_agentic_checkout_session',
        }),
        expect.objectContaining({
          name: 'get_product',
          inputSchema: expect.objectContaining({
            required: ['product_id'],
          }),
        }),
        expect.objectContaining({
          name: 'check_order',
          inputSchema: expect.objectContaining({
            required: ['order_number'],
          }),
        }),
      ])
    );
    expect(response.headers.get('cache-control')).toContain('max-age=3600');
  });
});
