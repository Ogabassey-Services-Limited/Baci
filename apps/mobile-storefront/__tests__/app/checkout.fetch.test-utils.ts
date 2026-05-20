export function createCheckoutFetchMock() {
  return jest.fn(async (input: string | URL | Request) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (requestUrl.includes('/api/shipping/locations?state=')) {
      const state = new URL(requestUrl, 'https://example.test').searchParams.get(
        'state'
      );
      const locationsByState = {
        Abuja: [
          { city: 'Abuja', state: 'Abuja' },
          { city: 'Garki', state: 'Abuja' },
        ],
        Lagos: [
          { city: 'Lagos', state: 'Lagos' },
          { city: 'Ikeja', state: 'Lagos' },
        ],
      } satisfies Record<string, Array<{ city: string; state: string }>>;
      const locationState =
        state === 'Abuja' || state === 'Lagos' ? state : null;

      return {
        json: async () => ({
          locations: locationState ? locationsByState[locationState] : [],
        }),
        ok: true,
      } as Response;
    }

    if (requestUrl.includes('/api/shipping/locations')) {
      return {
        json: async () => ({ states: ['Lagos', 'Abuja'] }),
        ok: true,
      } as Response;
    }

    if (requestUrl.includes('/api/shipping/quotes')) {
      return {
        json: async () => ({ quotes: { all: [] } }),
        ok: true,
      } as Response;
    }

    return {
      json: async () => ({}),
      ok: true,
    } as Response;
  });
}
