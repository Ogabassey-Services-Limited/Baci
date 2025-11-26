
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ThemedInput } from '@/components/themed';
import { Input } from '@/components/ui/input';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Type for accessing google maps on window
interface WindowWithGoogle extends Window {
  google?: typeof google;
}

// Helper function to check if Google Maps is loaded
const isGoogleMapsLoaded = (): boolean => {
  return typeof window !== 'undefined' &&
    typeof (window as WindowWithGoogle).google !== 'undefined' &&
    typeof (window as WindowWithGoogle).google?.maps?.places !== 'undefined';
};

// Helper to load the Google Maps script
const loadScript = (url: string, callback: () => void) => {
  if (isGoogleMapsLoaded()) {
    callback();
    return;
  }

  if (document.querySelector(`script[src="${url}"]`)) {
    // Script already loading or loaded
    if (isGoogleMapsLoaded()) {
      callback();
    } else {
      const interval = setInterval(() => {
        if (isGoogleMapsLoaded()) {
          clearInterval(interval);
          callback();
        }
      }, 100);
    }
    return;
  }
  const script = document.createElement('script');
  script.src = url;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.head.appendChild(script);
};

export interface PlaceDetails {
  streetNumber: string;
  route: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  formattedAddress: string;
}

interface AddressAutocompleteProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onSelect'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement> | string) => void;
  onSelect?: (place: PlaceDetails) => void;
  useThemedInput?: boolean;
  showIcon?: boolean;
  country?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  useThemedInput = false,
  showIcon = false,
  country = 'us',
  className,
  ...props
}: AddressAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
      console.warn('Google Maps API key is missing or is a placeholder. Autocomplete will not function.');
      return;
    }

    const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    loadScript(scriptUrl, () => setScriptLoaded(true));
  }, []);

  useEffect(() => {
    if (scriptLoaded && inputRef.current && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: country.toLowerCase() },
        fields: ['address_components', 'formatted_address'],
        types: ['address'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (place.address_components) {
          const streetNumber = place.address_components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes('street_number'))?.long_name || '';
          const route = place.address_components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes('route'))?.long_name || '';
          const city = place.address_components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes('locality'))?.long_name || '';
          const state = place.address_components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes('administrative_area_level_1'))?.short_name || '';
          const zip = place.address_components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes('postal_code'))?.long_name || '';
          const country = place.address_components.find((c: google.maps.GeocoderAddressComponent) => c.types.includes('country'))?.short_name || '';

          const formattedAddress = `${streetNumber} ${route}`.trim();

          if (onChange) {
            // We need to manually trigger onChange because the input value is updated by Google Maps
            // but React state might not be aware if we don't tell it.
            // Ideally we pass the string.
            onChange(formattedAddress);
          }

          if (onSelect) {
            onSelect({
              streetNumber,
              route,
              city,
              state,
              zip,
              country,
              formattedAddress
            });
          }
        }
      });
      autocompleteRef.current = autocomplete;
    } else if (autocompleteRef.current && country) {
      autocompleteRef.current.setComponentRestrictions({ country: country.toLowerCase() });
    }
  }, [scriptLoaded, onChange, onSelect, country]);

  const InputComponent = useThemedInput ? ThemedInput : Input;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="relative">
      {showIcon && (
        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--store-primary)]" />
      )}
      <InputComponent
        {...props}
        value={value}
        onChange={handleChange}
        ref={inputRef}
        className={cn(showIcon ? "pl-10" : "", className)}
        autoComplete="street-address"
      />
    </div>
  );
}
