jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  randomUUID: jest.fn(),
}));

import * as Crypto from 'expo-crypto';
import { generateEventId, generateEventIdSync } from './ad-tracking-event-id';

const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;

describe('ad tracking event ids', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates async IDs from crypto bytes', async () => {
    mockedCrypto.getRandomBytesAsync.mockResolvedValue(
      new Uint8Array([0, 1, 2, 10, 15, 16, 254, 255])
    );

    await expect(generateEventId()).resolves.toBe('loyw3v28_0001020a0f10feff');
  });

  it('uses randomUUID for sync IDs when available', () => {
    mockedCrypto.randomUUID.mockReturnValue(
      '12345678-90ab-cdef-1234-567890abcdef'
    );

    expect(generateEventIdSync()).toBe('loyw3v28_1234567890');
  });
});
