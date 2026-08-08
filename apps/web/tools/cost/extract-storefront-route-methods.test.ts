import { describe, expect, it } from 'vitest';
import { extractStorefrontRouteMethods } from './extract-storefront-route-methods';

describe('extractStorefrontRouteMethods', () => {
  it('recognizes declarations, re-exports, and aliased handlers', () => {
    // Arrange
    const source = [
      'export async function GET() {}',
      'export const PATCH = handler;',
      "export { deleteHandler as DELETE, POST } from './handler';",
    ].join('\n');

    // Act
    const methods = extractStorefrontRouteMethods(source, {
      includeAutomaticOptions: true,
    });

    // Assert
    expect(methods).toEqual([
      'DELETE',
      'GET',
      'HEAD',
      'OPTIONS',
      'PATCH',
      'POST',
    ]);
  });
});
