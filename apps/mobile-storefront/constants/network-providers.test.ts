import { NETWORK_PROVIDERS, type NetworkProvider } from './network-providers';

describe('NETWORK_PROVIDERS', () => {
  it('defines the supported mobile network provider metadata', () => {
    const providers: readonly NetworkProvider[] = NETWORK_PROVIDERS;

    expect(providers).toEqual([
      expect.objectContaining({
        color: '#FFCC00',
        id: 'mtn',
        image: expect.anything(),
        name: 'MTN',
      }),
      expect.objectContaining({
        color: '#FF0000',
        id: 'airtel',
        image: expect.anything(),
        name: 'Airtel',
      }),
      expect.objectContaining({
        color: '#00FF00',
        id: 'glo',
        image: expect.anything(),
        name: 'Glo',
      }),
      expect.objectContaining({
        color: '#006400',
        id: 't2',
        image: expect.anything(),
        name: 'T2 (9mobile)',
      }),
    ]);
    expect(providers).toHaveLength(4);
  });
});
