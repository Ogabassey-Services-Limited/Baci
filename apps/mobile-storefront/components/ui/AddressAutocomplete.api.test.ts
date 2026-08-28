import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  clearPredictionCache,
  fetchAddressPredictions,
  fetchPlaceDetails,
} from './AddressAutocomplete.api';
import type { PlacePrediction } from './AddressAutocomplete.types';

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiUrl: 'http://localhost:3000' } } },
}));

const prediction: PlacePrediction = {
  description: '1 Airport Road, Port Harcourt',
  mainText: '1 Airport Road',
  placeId: 'place-1',
  secondaryText: 'Port Harcourt, Nigeria',
};
const fetchMock = jest.fn<typeof fetch>();

function mockDetails(location?: unknown) {
  fetchMock.mockResolvedValueOnce({
    json: async () => ({
      details: {
        city: 'Port Harcourt',
        formattedAddress: prediction.description,
        location,
        state: 'Rivers',
      },
    }),
    ok: true,
  } as Response);
}

describe('fetchPlaceDetails coordinates', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('preserves numeric coordinates', async () => {
    mockDetails({ latitude: 4.8156, longitude: 7.0498 });

    await expect(
      fetchPlaceDetails({ prediction, sessionToken: 'session-1' })
    ).resolves.toMatchObject({ latitude: 4.8156, longitude: 7.0498 });
  });

  it.each([
    ['missing location', undefined],
    ['non-numeric coordinates', { latitude: '4.8156', longitude: '7.0498' }],
  ])('omits coordinates for %s', async (_label, location) => {
    mockDetails(location);

    await expect(
      fetchPlaceDetails({ prediction, sessionToken: 'session-1' })
    ).resolves.toMatchObject({ latitude: undefined, longitude: undefined });
  });
});

describe('fetchAddressPredictions request budget', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    clearPredictionCache();
    fetchMock.mockResolvedValue({
      json: async () => ({ predictions: [] }),
      ok: true,
      text: async () => '',
    } as Response);
  });

  it('caps slow-typing prediction bursts per session token', async () => {
    for (let index = 0; index < 51; index += 1) {
      await fetchAddressPredictions({
        country: 'ng',
        input: `Address ${index}`,
        sessionToken: 'session-1',
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(50);
  });
});
