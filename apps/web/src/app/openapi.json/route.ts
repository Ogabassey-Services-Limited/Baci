import { NextResponse } from 'next/server';
import { AGENT_READINESS_CACHE_CONTROL } from '@/config/agent-readiness';
import { isAgenticPaystackDvaPaused } from '@/lib/agentic/agentic-paystack-dva-paused';
import { checkoutCompletePaymentInfo } from '@/lib/agentic/mpp-checkout-payment-info';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

function buildOpenApiDocument(baseUrl: string) {
  const paystackDvaPaused = isAgenticPaystackDvaPaused();

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
      '/api/agentic/checkout-sessions/{id}/complete': {
        post: {
          operationId: 'completeCheckoutSession',
          summary:
            'Complete a signed checkout session and receive payment instructions',
          security: [{ agenticBearerHmac: [] }],
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          ...(paystackDvaPaused
            ? {}
            : { 'x-payment-info': checkoutCompletePaymentInfo }),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CheckoutCompleteRequest',
                },
              },
            },
          },
          responses: {
            '200': {
              description: paystackDvaPaused
                ? 'Order and machine-readable payment instructions'
                : 'Order and machine-readable Paystack bank transfer instructions',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
            '402': {
              description: 'Payment Required',
            },
            '409': {
              description:
                'Recoverable checkout conflict that requires user resolution or retry',
            },
            '428': {
              description: 'Missing or invalid user confirmation',
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
        CheckoutCompleteRequest: {
          type: 'object',
          properties: {
            buyer: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                phone_number: { type: 'string' },
              },
              required: ['email', 'first_name', 'last_name', 'phone_number'],
            },
            payment_data: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  enum: paystackDvaPaused
                    ? ['pay_on_delivery']
                    : ['paystack', 'paystack_bank_transfer'],
                },
                token: { type: 'string' },
                billing_address: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
              required: paystackDvaPaused
                ? ['provider']
                : ['provider', 'token'],
            },
            completion_authorization: {
              type: ['object', 'null'],
              additionalProperties: true,
            },
          },
          required: ['buyer', 'payment_data'],
        },
      },
    },
  };
}

export function GET(request: Request): NextResponse {
  return NextResponse.json(buildOpenApiDocument(buildRequestBaseUrl(request)), {
    headers: {
      'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
