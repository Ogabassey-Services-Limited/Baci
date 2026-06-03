/**
 * Shipping Locations API
 * Get available Nigerian locations for shipping
 * Fetches from Topship API for accurate coverage, with static fallback.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { topshipProvider } from '@/lib/shipping/providers/topship';
import { locationsQuerySchema } from '@/schemas/shipping';

// Static fallback list of Nigerian states (2025)
const NIGERIAN_STATES_FALLBACK = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT - Abuja',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
];

// Fallback cities by state (state capitals and major cities)
const NIGERIAN_CITIES_FALLBACK: Record<string, string[]> = {
  Abia: ['Aba', 'Umuahia', 'Ohafia', 'Arochukwu'],
  Adamawa: ['Yola', 'Mubi', 'Jimeta', 'Numan'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Abak'],
  Anambra: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Obosi'],
  Bauchi: ['Bauchi', 'Azare', 'Misau', "Jama'are"],
  Bayelsa: ['Yenagoa', 'Ogbia', 'Brass', 'Sagbama'],
  Benue: ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala'],
  Borno: ['Maiduguri', 'Biu', 'Damboa', 'Bama'],
  'Cross River': ['Calabar', 'Ogoja', 'Ikom', 'Obudu'],
  Delta: ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor', 'Effurun'],
  Ebonyi: ['Abakaliki', 'Afikpo', 'Onueke'],
  Edo: ['Benin City', 'Auchi', 'Ekpoma', 'Uromi', 'Irrua'],
  Ekiti: ['Ado Ekiti', 'Ikere Ekiti', 'Ikole Ekiti', 'Oye Ekiti'],
  Enugu: ['Enugu', 'Nsukka', 'Agbani', 'Udi'],
  'FCT - Abuja': [
    'Garki',
    'Wuse',
    'Maitama',
    'Asokoro',
    'Gwarinpa',
    'Kubwa',
    'Lugbe',
    'Nyanya',
    'Karu',
    'Jabi',
    'Utako',
    'Gudu',
    'Central Area',
    'Durumi',
    'Apo',
  ],
  Gombe: ['Gombe', 'Kumo', 'Billiri', 'Kaltungo'],
  Imo: ['Owerri', 'Orlu', 'Okigwe', 'Mbaise'],
  Jigawa: ['Dutse', 'Hadejia', 'Gumel', 'Kazaure'],
  Kaduna: ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro', 'Saminaka'],
  Kano: ['Kano', 'Fagge', 'Nassarawa', 'Wudil', 'Kumbotso'],
  Katsina: ['Katsina', 'Daura', 'Funtua', 'Malumfashi'],
  Kebbi: ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru'],
  Kogi: ['Lokoja', 'Okene', 'Idah', 'Kabba', 'Anyigba'],
  Kwara: ['Ilorin', 'Offa', 'Jebba', 'Omu-Aran'],
  Lagos: [
    'Ikeja',
    'Victoria Island',
    'Lekki',
    'Ikoyi',
    'Surulere',
    'Yaba',
    'Apapa',
    'Oshodi',
    'Mushin',
    'Agege',
    'Ajah',
    'Ikorodu',
    'Festac',
    'Isolo',
    'Maryland',
    'Ogba',
    'Gbagada',
    'Ogudu',
    'Magodo',
    'Berger',
    'Ojota',
    'Ketu',
    'Mile 2',
    'Badagry',
    'Epe',
  ],
  Nasarawa: ['Lafia', 'Keffi', 'Akwanga', 'Nasarawa'],
  Niger: ['Minna', 'Bida', 'Suleja', 'Kontagora'],
  Ogun: ['Abeokuta', 'Ijebu Ode', 'Sagamu', 'Ota', 'Ilaro', 'Sango'],
  Ondo: ['Akure', 'Ondo', 'Owo', 'Ikare', 'Ore'],
  Osun: ['Oshogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo'],
  Oyo: ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin', 'Saki'],
  Plateau: ['Jos', 'Bukuru', 'Pankshin', 'Shendam'],
  Rivers: ['Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme', 'Okrika', 'Degema'],
  Sokoto: ['Sokoto', 'Tambuwal', 'Wurno', 'Gwadabawa'],
  Taraba: ['Jalingo', 'Wukari', 'Takum', 'Bali'],
  Yobe: ['Damaturu', 'Potiskum', 'Gashua', 'Nguru'],
  Zamfara: ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka'],
};

// Cache for Topship data
let topshipStatesCache: {
  states: string[];
  stateCodeMap: Record<string, string>;
  expiry: number;
} | null = null;
const topshipCitiesCache: Map<string, { cities: string[]; expiry: number }> =
  new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// GET /api/shipping/locations - Get Nigerian locations
// =============================================================================

// react-doctor-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- Process-local Topship response cache only; no user, order, or database state is mutated by GET.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = locationsQuerySchema.safeParse({
      state: searchParams.get('state') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { state, search } = parsed.data;

    // Try to get states from Topship, fall back to static list
    let states: string[] = NIGERIAN_STATES_FALLBACK;
    let stateCodeMap: Record<string, string> = {};

    // Check cache for Topship states
    if (topshipStatesCache && Date.now() < topshipStatesCache.expiry) {
      states = topshipStatesCache.states;
      stateCodeMap = topshipStatesCache.stateCodeMap;
    } else {
      // Try fetching from Topship
      try {
        const topshipStates = await topshipProvider.getStates('NG');
        if (topshipStates.length > 0) {
          states = topshipStates.map((s) => s.name);
          stateCodeMap = Object.fromEntries(
            topshipStates.map((s) => [s.name.toLowerCase(), s.code])
          );
          topshipStatesCache = {
            states,
            stateCodeMap,
            expiry: Date.now() + CACHE_TTL,
          };
        }
      } catch (error) {
        console.warn(
          '[Locations API] Failed to fetch Topship states, using fallback:',
          error
        );
      }
    }

    // Build locations response
    let locations: { state: string; city: string; stationName?: string }[] = [];

    // If filtering by state, return cities for that state
    if (state) {
      // Find the matching state (case-insensitive)
      const matchedState = states.find(
        (s) => s.toLowerCase() === state.toLowerCase()
      );

      if (matchedState) {
        let cities: string[] = [];

        // Try to get cities from Topship
        const stateCode = stateCodeMap[matchedState.toLowerCase()];

        // Check cache first
        const cachedCities = topshipCitiesCache.get(matchedState.toLowerCase());
        if (cachedCities && Date.now() < cachedCities.expiry) {
          cities = cachedCities.cities;
        } else if (stateCode) {
          try {
            const topshipCities = await topshipProvider.getCities(stateCode);
            if (topshipCities.length > 0) {
              cities = topshipCities.map((c) => c.name);
              topshipCitiesCache.set(matchedState.toLowerCase(), {
                cities,
                expiry: Date.now() + CACHE_TTL,
              });
            }
          } catch (error) {
            console.warn(
              '[Locations API] Failed to fetch Topship cities for',
              matchedState,
              error
            );
          }
        }

        // Fall back to static list if Topship fails
        if (cities.length === 0) {
          cities = NIGERIAN_CITIES_FALLBACK[matchedState] || [matchedState];
        }

        locations = cities.map((city) => ({
          state: matchedState,
          city,
          stationName: city,
        }));
      }
    }

    // Filter by search query if provided
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase();

      if (locations.length > 0) {
        // Filter existing locations
        locations = locations.filter(
          (l) =>
            l.city.toLowerCase().includes(searchLower) ||
            l.state.toLowerCase().includes(searchLower)
        );
      } else {
        // Search across all states and cities (using fallback for search since it's expensive to fetch all)
        for (const [stateName, stateCities] of Object.entries(
          NIGERIAN_CITIES_FALLBACK
        )) {
          for (const city of stateCities) {
            if (
              city.toLowerCase().includes(searchLower) ||
              stateName.toLowerCase().includes(searchLower)
            ) {
              locations.push({ state: stateName, city, stationName: city });
            }
          }
        }
      }
    }

    return NextResponse.json({
      locations,
      totalCount: locations.length,
      states,
    });
  } catch (error) {
    console.error('Error getting locations:', error);
    return NextResponse.json(
      {
        locations: [],
        totalCount: 0,
        states: NIGERIAN_STATES_FALLBACK,
      },
      { status: 500 }
    );
  }
}
