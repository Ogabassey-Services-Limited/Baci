import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPlatformOs } = vi.hoisted(() => ({
  mockPlatformOs: { value: 'ios' },
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOs.value;
    },
  },
}));

vi.mock('expo-file-system', () => ({
  File: class MockFile {},
  Paths: { document: '/documents' },
}));

vi.mock('expo-print', () => ({
  printToFileAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

describe('loadOrderExportNativeModules', () => {
  beforeEach(() => {
    mockPlatformOs.value = 'ios';
  });

  it('loads the native export modules on native platforms', async () => {
    const { loadOrderExportNativeModules } = await import(
      './loadOrderExportNativeModules'
    );

    const modules = await loadOrderExportNativeModules();

    expect(modules.FileSystem).not.toBeNull();
    expect(modules.Print).not.toBeNull();
    expect(modules.Sharing).toBeDefined();
  });

  it('throws on web before trying to load native modules', async () => {
    mockPlatformOs.value = 'web';
    const { loadOrderExportNativeModules } = await import(
      './loadOrderExportNativeModules'
    );

    await expect(loadOrderExportNativeModules()).rejects.toThrow(
      'Export modules not available'
    );
  });
});
