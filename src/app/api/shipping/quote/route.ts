import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getGiglPrice } from '@/lib/gigl';
import { createClient } from '@/lib/supabase/server';

// Fallback shipping fee if GIGL is not configured or fails
const DEFAULT_SHIPPING_FEE = Number.parseFloat(
  process.env.NEXT_PUBLIC_DEFAULT_SHIPPING_FEE || '1500'
);

// Common Nigerian cities to station ID mapping (Lagos-centric for now)
const CITY_TO_STATION: Record<string, number> = {
  lagos: 39, // Lagos Main
  abuja: 10, // Abuja
  ibadan: 15, // Ibadan
  'port harcourt': 20, // Port Harcourt
  kano: 25, // Kano
  default: 39, // Default to Lagos
};

// Get station ID from city name
function getStationIdFromCity(city: string): number {
  const normalizedCity = city.toLowerCase().trim();
  return CITY_TO_STATION[normalizedCity] || CITY_TO_STATION.default;
}

// Simple geocoding fallback based on Nigerian cities
function getCoordinatesForCity(city: string): {
  latitude: number;
  longitude: number;
} {
  const cityCoords: Record<string, { latitude: number; longitude: number }> = {
    lagos: { latitude: 6.5244, longitude: 3.3792 },
    abuja: { latitude: 9.0765, longitude: 7.3986 },
    ibadan: { latitude: 7.3775, longitude: 3.947 },
    'port harcourt': { latitude: 4.8156, longitude: 7.0498 },
    kano: { latitude: 12.0022, longitude: 8.592 },
  };

  const normalizedCity = city.toLowerCase().trim();
  return cityCoords[normalizedCity] || cityCoords.lagos; // Default to Lagos
}

export async function POST(request: NextRequest) {
  try {
    const {
      receiverCity,
      senderCity: _senderCity,
      cartValue,
      items,
    } = await request.json();

    // Check if GIGL is configured
    const giglConfigured = process.env.GIGL_EMAIL && process.env.GIGL_PASSWORD;

    if (!giglConfigured) {
      console.warn(
        'GIGL credentials not configured, using default shipping fee'
      );
      return NextResponse.json({
        shippingFee: DEFAULT_SHIPPING_FEE,
        provider: 'Default',
        note: 'GIGL integration not configured. Using flat rate.',
      });
    }

    // Get merchant's location (sender)
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let senderStationId = CITY_TO_STATION.default;
    let senderCoords = { latitude: 6.5244, longitude: 3.3792 }; // Lagos default

    if (user) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('business_location')
        .eq('user_id', user.id)
        .single();

      if (merchant?.business_location) {
        senderStationId = getStationIdFromCity(merchant.business_location);
        senderCoords = getCoordinatesForCity(merchant.business_location);
      }
    }

    // Get receiver station and coordinates
    const receiverStationId = getStationIdFromCity(receiverCity || 'lagos');
    const receiverCoords = getCoordinatesForCity(receiverCity || 'lagos');

    const giglPayload = {
      SenderStationId: senderStationId,
      ReceiverStationId: receiverStationId,
      VehicleType: 1, // Bike
      ReceiverLocation: {
        Latitude: receiverCoords.latitude,
        Longitude: receiverCoords.longitude,
      },
      SenderLocation: {
        Latitude: senderCoords.latitude,
        Longitude: senderCoords.longitude,
      },
      IsFromAgility: false,
      CustomerCode: user?.email || 'CUSTOMER',
      CustomerType: 0, // Individual
      DeliveryOptionIds: [2], // Home Delivery
      Value: cartValue || 1000,
      PickUpOptions: 1,
      ShipmentItems: items.map(
        (item: {
          name: string;
          quantity: number;
          weight?: number;
          value: number;
        }) => ({
          ItemName: item.name,
          Description: item.name,
          SpecialPackageId: 0,
          Quantity: item.quantity,
          Weight: item.weight || 1, // Default 1kg if not provided
          IsVolumetric: false,
          Length: 0,
          Width: 0,
          Height: 0,
          ShipmentType: 1, // Regular
          Value: item.value,
        })
      ),
    };

    const result = await getGiglPrice(giglPayload);

    if (result.status !== 200) {
      console.error('GIGL API error:', result.message);
      // Fallback to default shipping
      return NextResponse.json({
        shippingFee: DEFAULT_SHIPPING_FEE,
        provider: 'Default (GIGL unavailable)',
        note: 'GIGL service temporarily unavailable. Using flat rate.',
      });
    }

    return NextResponse.json({
      shippingFee: result.data.GrandTotal || DEFAULT_SHIPPING_FEE,
      provider: 'GIGL',
      details: result.data,
      estimate: `Delivery to ${receiverCity || 'your location'}`,
    });
  } catch (error) {
    console.error('Shipping quote error:', error);
    // Always fallback gracefully
    return NextResponse.json({
      shippingFee: DEFAULT_SHIPPING_FEE,
      provider: 'Default',
      note: 'Unable to calculate dynamic shipping. Using flat rate.',
    });
  }
}
