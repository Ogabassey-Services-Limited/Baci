/**
 * Shipping Locations API
 * Get available Nigerian locations for shipping
 * Uses static fallback for state/city data since provider APIs don't filter correctly.
 */

import { type NextRequest, NextResponse } from 'next/server';

// Static list of Nigerian states (2025)
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

// Comprehensive cities by state (state capitals and major cities)
const NIGERIAN_CITIES_BY_STATE: Record<string, string[]> = {
  'Abia': ['Aba', 'Umuahia', 'Ohafia', 'Arochukwu'],
  'Adamawa': ['Yola', 'Mubi', 'Jimeta', 'Numan'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Abak'],
  'Anambra': ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Obosi'],
  'Bauchi': ['Bauchi', 'Azare', 'Misau', 'Jama\'are'],
  'Bayelsa': ['Yenagoa', 'Ogbia', 'Brass', 'Sagbama'],
  'Benue': ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala'],
  'Borno': ['Maiduguri', 'Biu', 'Damboa', 'Bama'],
  'Cross River': ['Calabar', 'Ogoja', 'Ikom', 'Obudu'],
  'Delta': ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor', 'Effurun'],
  'Ebonyi': ['Abakaliki', 'Afikpo', 'Onueke'],
  'Edo': ['Benin City', 'Auchi', 'Ekpoma', 'Uromi', 'Irrua'],
  'Ekiti': ['Ado Ekiti', 'Ikere Ekiti', 'Ikole Ekiti', 'Oye Ekiti'],
  'Enugu': ['Enugu', 'Nsukka', 'Agbani', 'Udi'],
  'FCT - Abuja': ['Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa', 'Kubwa', 'Lugbe', 'Nyanya', 'Karu', 'Jabi', 'Utako', 'Gudu', 'Central Area', 'Durumi', 'Apo'],
  'Gombe': ['Gombe', 'Kumo', 'Billiri', 'Kaltungo'],
  'Imo': ['Owerri', 'Orlu', 'Okigwe', 'Mbaise'],
  'Jigawa': ['Dutse', 'Hadejia', 'Gumel', 'Kazaure'],
  'Kaduna': ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro', 'Saminaka'],
  'Kano': ['Kano', 'Fagge', 'Nassarawa', 'Wudil', 'Kumbotso'],
  'Katsina': ['Katsina', 'Daura', 'Funtua', 'Malumfashi'],
  'Kebbi': ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru'],
  'Kogi': ['Lokoja', 'Okene', 'Idah', 'Kabba', 'Anyigba'],
  'Kwara': ['Ilorin', 'Offa', 'Jebba', 'Omu-Aran'],
  'Lagos': ['Ikeja', 'Victoria Island', 'Lekki', 'Ikoyi', 'Surulere', 'Yaba', 'Apapa', 'Oshodi', 'Mushin', 'Agege', 'Ajah', 'Ikorodu', 'Festac', 'Isolo', 'Maryland', 'Ogba', 'Gbagada', 'Ogudu', 'Magodo', 'Berger', 'Ojota', 'Ketu', 'Mile 2', 'Badagry', 'Epe'],
  'Nasarawa': ['Lafia', 'Keffi', 'Akwanga', 'Nasarawa'],
  'Niger': ['Minna', 'Bida', 'Suleja', 'Kontagora'],
  'Ogun': ['Abeokuta', 'Ijebu Ode', 'Sagamu', 'Ota', 'Ilaro', 'Sango'],
  'Ondo': ['Akure', 'Ondo', 'Owo', 'Ikare', 'Ore'],
  'Osun': ['Oshogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo'],
  'Oyo': ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin', 'Saki'],
  'Plateau': ['Jos', 'Bukuru', 'Pankshin', 'Shendam'],
  'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme', 'Okrika', 'Degema'],
  'Sokoto': ['Sokoto', 'Tambuwal', 'Wurno', 'Gwadabawa'],
  'Taraba': ['Jalingo', 'Wukari', 'Takum', 'Bali'],
  'Yobe': ['Damaturu', 'Potiskum', 'Gashua', 'Nguru'],
  'Zamfara': ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka'],
};

// =============================================================================
// GET /api/shipping/locations - Get Nigerian locations
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const search = searchParams.get('search');

    // Build locations response
    let locations: { state: string; city: string; stationName?: string }[] = [];

    // If filtering by state, return cities for that state
    if (state) {
      // Find the matching state (case-insensitive)
      const matchedState = NIGERIAN_STATES.find(
        (s) => s.toLowerCase() === state.toLowerCase()
      );

      if (matchedState) {
        const cities = NIGERIAN_CITIES_BY_STATE[matchedState] || [matchedState];
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
        // Search across all states and cities
        for (const [stateName, cities] of Object.entries(NIGERIAN_CITIES_BY_STATE)) {
          for (const city of cities) {
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
      locations: locations.slice(0, 100),
      totalCount: locations.length,
      states: NIGERIAN_STATES,
    });
  } catch (error) {
    console.error('Error getting locations:', error);
    return NextResponse.json({
      locations: [],
      totalCount: 0,
      states: NIGERIAN_STATES,
    });
  }
}
