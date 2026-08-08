import { describe, expect, it } from 'vitest';
import { createStorefrontEdgeApiRows } from './create-storefront-edge-api-rows';

const apiRoot = 'apps/web/src/app/api';

describe('createStorefrontEdgeApiRows', () => {
  it('enumerates exact API handler patterns and their exported methods', () => {
    // Arrange
    const apiSources = [
      {
        bytes: Buffer.from(
          'export async function GET() {}\nexport async function PATCH() {}\n'
        ),
        sourcePath: `${apiRoot}/orders/[id]/route.ts`,
      },
      {
        bytes: Buffer.from("export { handler as POST } from './handler';\n"),
        sourcePath: `${apiRoot}/events/route.ts`,
      },
      {
        bytes: Buffer.from('export async function POST() {}\n'),
        sourcePath: `${apiRoot}/webhooks/[...provider]/route.ts`,
      },
    ];

    // Act
    const rows = createStorefrontEdgeApiRows(apiRoot, apiSources);

    // Assert
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          methods: ['GET', 'HEAD', 'OPTIONS', 'PATCH'],
          routePattern: '/api/orders/{id}',
        }),
        expect.objectContaining({
          methods: ['OPTIONS', 'POST'],
          routePattern: '/api/events',
        }),
        expect.objectContaining({
          methods: ['OPTIONS', 'POST'],
          routePattern: '/api/webhooks/{*provider}',
        }),
      ])
    );
    expect(rows).toHaveLength(3);
  });
});
