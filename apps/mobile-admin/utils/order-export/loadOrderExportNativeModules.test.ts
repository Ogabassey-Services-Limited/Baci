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

vi.mock('expo-file-system', () => {
  throw new Error('main expo-file-system module should not be loaded');
});

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  writeAsStringAsync: vi.fn(),
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
    expect(modules.Sharing).not.toBeNull();
  });

  it('returns a null sharing module when expo-sharing cannot be imported', async () => {
    vi.resetModules();
    vi.doMock('expo-sharing', () => {
      throw new Error('native module unavailable');
    });
    const { loadOrderExportNativeModules } = await import(
      './loadOrderExportNativeModules'
    );

    const modules = await loadOrderExportNativeModules();

    expect(modules.FileSystem).not.toBeNull();
    expect(modules.Print).not.toBeNull();
    expect(modules.Sharing).toBeNull();
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
