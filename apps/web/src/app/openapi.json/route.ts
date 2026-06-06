import { NextResponse } from 'next/server';
import { AGENT_READINESS_CACHE_CONTROL } from '@/config/agent-readiness';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

function buildOpenApiDocument(baseUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Ogabassey Agentic Commerce API',
      version: '2026-04-30',
      description:
        'Machine-readable description of Ogabassey catalog, checkout, and order routes for approved agents.',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/api/agentic/catalog/search': {
        post: {
          operationId: 'searchCatalog',
          summary: 'Search the Ogabassey catalog',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CatalogSearchRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Catalog search results',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/api/agentic/catalog/product': {
        post: {
          operationId: 'getCatalogProduct',
          summary: 'Fetch a product and its selected variants',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CatalogProductRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Product details',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/api/agentic/checkout-sessions': {
        post: {
          operationId: 'createCheckoutSession',
          summary: 'Create a signed checkout session',
          security: [{ agenticBearerHmac: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CheckoutSessionRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Checkout session',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
      '/api/agentic/checkout-sessions/{id}': {
        get: {
          operationId: 'getCheckoutSession',
          summary: 'Read a signed checkout session',
          security: [{ agenticBearerHmac: [] }],
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: {
            '200': {
              description: 'Checkout session',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        patch: {
          operationId: 'updateCheckoutSession',
          summary: 'Update a signed checkout session',
          security: [{ agenticBearerHmac: [] }],
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CheckoutSessionRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated checkout session',
            },
          },
        },
      },
      '/api/agentic/orders/{id}': {
        get: {
          operationId: 'getOrder',
          summary: 'Read an order by ID',
          security: [{ agenticBearerHmac: [] }],
          parameters: [{ $ref: '#/components/parameters/OrderId' }],
          responses: {
            '200': {
              description: 'Order details',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        agenticBearerHmac: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Bearer token plus HMAC request-signing headers described in /agent-commerce.json.',
        },
      },
      parameters: {
        SessionId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        OrderId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      },
      schemas: {
        CatalogSearchRequest: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            pagination: { type: 'object', additionalProperties: true },
          },
        },
        CatalogProductRequest: {
          type: 'object',
          properties: {
            product_id: { type: 'string' },
            selected: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
          },
        },
        CheckoutSessionRequest: {
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
            shipping_address: {
              type: 'object',
              additionalProperties: true,
            },
          },
          required: ['items'],
        },
      },
    },
  };
}

export function GET(request: Request): NextResponse {
  return NextResponse.json(buildOpenApiDocument(buildRequestBaseUrl(request)), {
    headers: {
      'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
    },
  });
}
