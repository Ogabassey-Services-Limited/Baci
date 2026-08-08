import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('./storefront-edge-machine-source-paths');
  vi.resetModules();
});

describe('STOREFRONT_EDGE_MACHINE_ROWS', () => {
  it('models route-handler OPTIONS, metadata methods, and terminal ANY', async () => {
    // Arrange and act
    const { STOREFRONT_EDGE_MACHINE_ROWS } = await import(
      './storefront-edge-machine-rows'
    );
    const byId = new Map(
      STOREFRONT_EDGE_MACHINE_ROWS.map((row) => [row.id, row])
    );

    // Assert
    expect(byId.get('machine:feed-googleMerchantXml')?.methods).toEqual([
      'GET',
      'HEAD',
      'OPTIONS',
    ]);
    expect(byId.get('machine:robots')?.methods).toEqual(['GET', 'HEAD']);
    expect(byId.get('machine:next-image')?.methods).toEqual(['ANY']);
  });

  it('fails closed when a machine route has no declared source', async () => {
    // Arrange
    vi.doMock('./storefront-edge-machine-source-paths', () => ({
      STOREFRONT_EDGE_MACHINE_SOURCE_PATHS: {},
    }));

    // Act and assert
    await expect(import('./storefront-edge-machine-rows')).rejects.toThrow(
      'machine route source is not declared: /.well-known/acp.json'
    );
  });
});
