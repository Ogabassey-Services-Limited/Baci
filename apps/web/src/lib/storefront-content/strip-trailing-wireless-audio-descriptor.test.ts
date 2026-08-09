import { describe, expect, it } from 'vitest';
import { stripTrailingWirelessAudioDescriptor } from './strip-trailing-wireless-audio-descriptor';

describe('stripTrailingWirelessAudioDescriptor', () => {
  it('removes a trailing wireless noise-cancelling headphone description', () => {
    expect(
      stripTrailingWirelessAudioDescriptor([
        'wh',
        '1000xm5',
        'wireless',
        'noise',
        'cancelling',
        'headphones',
      ])
    ).toEqual(['wh', '1000xm5']);
  });

  it('preserves wireless when later tokens identify the product', () => {
    expect(
      stripTrailingWirelessAudioDescriptor(['xbox', 'wireless', 'controller'])
    ).toEqual(['xbox', 'wireless', 'controller']);
  });
});
