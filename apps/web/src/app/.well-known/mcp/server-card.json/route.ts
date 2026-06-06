import { NextResponse } from 'next/server';
import {
  AGENT_READINESS_CACHE_CONTROL,
  BACI_MCP_SERVER_URL,
} from '@/config/agent-readiness';

export function GET(): NextResponse {
  return NextResponse.json(
    {
      $schema:
        'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
      version: '1.0',
      protocolVersion: '2025-06-18',
      serverInfo: {
        name: 'ogabassey-store',
        title: 'Ogabassey Store MCP Server',
        version: '1.0.0',
      },
      description:
        'Search products, inspect variants, estimate shipping, check orders, and create confirmed agentic checkout sessions for Ogabassey.',
      transport: {
        type: 'streamable-http',
        endpoint: BACI_MCP_SERVER_URL,
      },
      authentication: {
        required: false,
      },
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      tools: [
        {
          name: 'search_products',
          title: 'Search Products',
          description:
            'Search Ogabassey products by query, category, brand, and price.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              category: { type: 'string' },
              brand: { type: 'string' },
              max_price: { type: 'number' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_product',
          title: 'Get Product',
          description:
            'Fetch product details, variants, pricing, and availability.',
          inputSchema: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              slug: { type: 'string' },
            },
            required: ['product_id'],
          },
        },
        {
          name: 'get_shipping_quote',
          title: 'Get Shipping Quote',
          description: 'Estimate available delivery options for a destination.',
          inputSchema: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              state: { type: 'string' },
              country: { type: 'string', default: 'NG' },
            },
            required: ['city', 'state'],
          },
        },
        {
          name: 'create_agentic_checkout_session',
          title: 'Create Checkout Session',
          description:
            'Create a signed checkout session after explicit user confirmation.',
          inputSchema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product_id: { type: 'string' },
                    quantity: { type: 'integer', minimum: 1 },
                  },
                  required: ['product_id', 'quantity'],
                },
              },
            },
            required: ['items'],
          },
        },
        {
          name: 'check_order',
          title: 'Check Order',
          description:
            'Look up an order using an order number or phone supplied by the user.',
          inputSchema: {
            type: 'object',
            properties: {
              order_number: { type: 'string' },
              phone: { type: 'string' },
            },
            required: ['order_number'],
          },
        },
      ],
    },
    {
      headers: {
        'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
      },
    }
  );
}
