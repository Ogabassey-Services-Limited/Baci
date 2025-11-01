'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ThemedInput } from '@/components/themed';
import { Home } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from './ui/form';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Helper to load the Google Maps script
const loadScript = (url: string, callback: () => void) => {
  if (document.querySelector(`script[src="${url}"]`)) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = url;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.head.appendChild(script);
};

export function AddressAutocomplete() {
  const { control, setValue, trigger } = useFormContext();
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
        componentRestrictions: { country: 'us' }, // Restrict to US for now, can be dynamic
        fields: ['address_components'],
        types: ['address'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.address_components) {
          const streetNumber = place.address_components.find(c => c.types.includes('street_number'))?.long_name || '';
          const route = place.address_components.find(c => c.types.includes('route'))?.long_name || '';
          const city = place.address_components.find(c => c.types.includes('locality'))?.long_name || '';
          const state = place.address_components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '';
          
          setValue('address', `${streetNumber} ${route}`.trim());
          setValue('city', city);
          setValue('state', state);

          // Trigger validation for the fields that were just updated
          trigger(['address', 'city', 'state']);
        }
      });
      autocompleteRef.current = autocomplete;
    }
  }, [scriptLoaded, setValue, trigger]);

  return (
    <FormField
        control={control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Street Address</FormLabel>
            <FormControl>
               <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--store-primary)]" />
                <ThemedInput 
                  placeholder="123 Main St" 
                  {...field} 
                  ref={inputRef} 
                  className="pl-10"
                  onChange={(e) => {
                    field.onChange(e); // Keep react-hook-form's onChange
                    // You can add more logic here if needed as the user types
                  }}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
  );
}
