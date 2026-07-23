import { describe, expect, it } from 'vitest';
import { mcpServerTestSupport } from './server-test-support';

const {
  getResultRecord,
  getResultTools,
  postMcpJsonRpc,
  startMcpServerWithPostgrest,
} = mcpServerTestSupport;

describe('MCP order payment tool modes', () => {
  it('exposes private agentic and payment tools when explicitly enabled', async () => {
    const server = await startMcpServerWithPostgrest({
      AGENTIC_PAYSTACK_DVA_MODE: 'enabled',
      MCP_ENABLE_AGENTIC_CHECKOUT_TOOLS: '1',
      MCP_ENABLE_ORDER_PAYMENT_TOOLS: '1',
    });
    try {
      const payload = await postMcpJsonRpc(server.baseUrl, {
        id: 3,
        method: 'tools/list',
        params: {},
      });
      const tools = getResultTools(payload);
      expect(tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'cancel_agentic_checkout_session',
          'cancel_ucp_cart',
          'check_order',
          'check_payment_status',
          'complete_agentic_checkout_session',
          'convert_ucp_cart_to_checkout',
          'create_agentic_checkout_session',
          'create_ucp_cart',
          'generate_payment_account',
          'get_agentic_checkout_session',
          'get_ucp_cart',
          'lookup_ucp_catalog_items',
          'search_ucp_catalog',
          'update_agentic_checkout_session',
          'update_ucp_cart',
        ])
      );
      for (const toolName of [
        'generate_payment_account',
        'check_payment_status',
      ]) {
        const tool = tools.find((candidate) => candidate.name === toolName);
        expect(tool?.inputSchema.properties.customer_email).toMatchObject({
          format: 'email',
          type: 'string',
        });
      }

      const statusResult = getResultRecord(
        await postMcpJsonRpc(server.baseUrl, {
          id: 31,
          method: 'tools/call',
          params: {
            arguments: { customer_email: 'complete@example.com' },
            name: 'check_payment_status',
          },
        })
      );
      expect(statusResult.structuredContent).toMatchObject({
        account_number: '1234567890',
        bank_name: 'Test Bank',
        status: 'pending',
      });

      const incompleteResult = getResultRecord(
        await postMcpJsonRpc(server.baseUrl, {
          id: 32,
          method: 'tools/call',
          params: {
            arguments: { customer_email: 'incomplete@example.com' },
            name: 'check_payment_status',
          },
        })
      );
      expect(JSON.stringify(incompleteResult)).not.toContain('1234567890');
      expect(incompleteResult.structuredContent).not.toHaveProperty(
        'account_number'
      );
    } finally {
      await server.close();
    }
  });

  it('omits new DVA creation and stored details while paused', async () => {
    const server = await startMcpServerWithPostgrest({
      AGENTIC_PAYSTACK_DVA_MODE: 'paused',
      MCP_ENABLE_ORDER_PAYMENT_TOOLS: '1',
    });
    try {
      const payload = await postMcpJsonRpc(server.baseUrl, {
        id: 4,
        method: 'tools/list',
        params: {},
      });
      const toolNames = getResultTools(payload).map((tool) => tool.name);
      expect(toolNames).toContain('check_payment_status');
      expect(toolNames).not.toContain('generate_payment_account');

      const statusResult = getResultRecord(
        await postMcpJsonRpc(server.baseUrl, {
          id: 41,
          method: 'tools/call',
          params: {
            arguments: { customer_email: 'complete@example.com' },
            name: 'check_payment_status',
          },
        })
      );
      assertStoredDvaRedacted(statusResult);
    } finally {
      await server.close();
    }
  });

  it('keeps read-only payment tools available when DVA mode is invalid', async () => {
    const server = await startMcpServerWithPostgrest({
      AGENTIC_PAYSTACK_DVA_MODE: 'invalid',
      MCP_ENABLE_ORDER_PAYMENT_TOOLS: '1',
    });
    try {
      const payload = await postMcpJsonRpc(server.baseUrl, {
        id: 5,
        method: 'tools/list',
        params: {},
      });
      const toolNames = getResultTools(payload).map((tool) => tool.name);
      expect(toolNames).toContain('check_order');
      expect(toolNames).toContain('check_payment_status');
      expect(toolNames).not.toContain('generate_payment_account');

      const statusResult = getResultRecord(
        await postMcpJsonRpc(server.baseUrl, {
          id: 51,
          method: 'tools/call',
          params: {
            arguments: { customer_email: 'complete@example.com' },
            name: 'check_payment_status',
          },
        })
      );
      assertStoredDvaRedacted(statusResult);
    } finally {
      await server.close();
    }
  });
});

function assertStoredDvaRedacted(result: Record<string, unknown>): void {
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain('1234567890');
  expect(serialized).not.toContain('Test Bank');
  expect(serialized).not.toContain('Test Buyer');
  expect(result.structuredContent).not.toHaveProperty('account_name');
  expect(result.structuredContent).not.toHaveProperty('account_number');
  expect(result.structuredContent).not.toHaveProperty('bank_name');
}
