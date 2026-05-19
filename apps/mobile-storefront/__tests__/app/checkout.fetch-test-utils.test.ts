import { createCheckoutFetchMock } from './checkout.fetch.test-utils';

const inputFactories = [
  (url: string) => url,
  (url: string) => new URL(url),
  (url: string) => new Request(url),
] as const;

async function expectJsonForEveryInput(
  url: string,
  expectedJson: unknown
) {
  for (const buildInput of inputFactories) {
    const fetchMock = createCheckoutFetchMock();
    const response = await fetchMock(buildInput(url));

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toEqual(expectedJson);
  }
}

describe('createCheckoutFetchMock', () => {
  it.each(['Lagos', 'Abuja'])(
    'returns city locations for state query %s',
    async (state) => {
      const expectedLocations =
        state === 'Abuja'
          ? [
              { city: 'Abuja', state: 'Abuja' },
              { city: 'Garki', state: 'Abuja' },
            ]
          : [
              { city: 'Lagos', state: 'Lagos' },
              { city: 'Ikeja', state: 'Lagos' },
            ];

      await expectJsonForEveryInput(
        `https://example.test/api/shipping/locations?state=${state}`,
        { locations: expectedLocations }
      );
    }
  );

  it('returns states for the locations endpoint', async () => {
    await expectJsonForEveryInput(
      'https://example.test/api/shipping/locations',
      { states: ['Lagos', 'Abuja'] }
    );
  });

  it('returns empty quote groups for the quotes endpoint', async () => {
    await expectJsonForEveryInput('https://example.test/api/shipping/quotes', {
      quotes: { all: [] },
    });
  });

  it('returns an empty object for unmatched URLs', async () => {
    await expectJsonForEveryInput('https://example.test/api/other', {});
  });
});
