'use client';

import { NIGERIAN_STATES, type RegisteredAddress } from '@baci/shared';
import { Loader2, MapPin } from 'lucide-react';
import { useState } from 'react';
import {
  AddressAutocomplete,
  type PlaceDetails,
} from '@/components/address-autocomplete';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface TaxSettingsAddressCardProps {
  initialRegisteredAddress: RegisteredAddress;
  initialStateCode: string;
  onSaveAddress: (payload: Record<string, unknown>) => Promise<void>;
}

export function TaxSettingsAddressCard({
  initialRegisteredAddress,
  initialStateCode,
  onSaveAddress,
}: TaxSettingsAddressCardProps) {
  const { toast } = useToast();
  const [address, setAddress] = useState<RegisteredAddress>({
    ...initialRegisteredAddress,
    country: initialRegisteredAddress.country ?? 'Nigeria',
  });
  const [stateCode, setStateCode] = useState(initialStateCode);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const handleStreetChange = (
    event: React.ChangeEvent<HTMLInputElement> | string
  ) => {
    const street = typeof event === 'string' ? event : event.target.value;
    setAddress((previous) => ({ ...previous, street }));
  };

  const handleAddressSelect = (place: PlaceDetails) => {
    const street = [place.streetNumber, place.route].filter(Boolean).join(' ');
    setAddress((previous) => ({
      ...previous,
      street: street || previous.street,
      city: place.city || previous.city,
      postal_code: place.zip || previous.postal_code,
      state: place.state || previous.state,
    }));
    if (!place.state) return;
    const matchingState = NIGERIAN_STATES.find(
      (state) => state.name.toLowerCase() === place.state.toLowerCase()
    );
    if (matchingState) setStateCode(matchingState.code);
  };

  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    try {
      const selectedState = NIGERIAN_STATES.find(
        (state) => state.code === stateCode
      );
      await onSaveAddress({
        registered_address: {
          street: address.street || null,
          city: address.city || null,
          state: selectedState?.name || null,
          postal_code: address.postal_code || null,
          country: 'Nigeria',
        },
        state_code: stateCode || null,
      });
      toast({
        title: 'Address Saved',
        description: 'Your registered business address has been updated.',
      });
    } catch {
      toast({
        title: 'Update Failed',
        description: 'Could not save address. Please try again.',
        variant: 'destructive',
      });
    }
    setIsSavingAddress(false);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-5" />
          Registered Business Address
        </CardTitle>
        <CardDescription>
          Your official business address for tax invoices and FIRS compliance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address-street">Street Address</Label>
          <AddressAutocomplete
            id="address-street"
            placeholder="Start typing your address..."
            value={address.street ?? ''}
            onChange={handleStreetChange}
            onSelect={handleAddressSelect}
            country="ng"
          />
          <p className="text-xs text-muted-foreground">
            Type to search with Google Places or enter manually
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address-city">City</Label>
            <Input
              id="address-city"
              placeholder="e.g. Lagos"
              value={address.city ?? ''}
              onChange={(event) =>
                setAddress((previous) => ({
                  ...previous,
                  city: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-postal">Postal Code</Label>
            <Input
              id="address-postal"
              placeholder="e.g. 100001"
              value={address.postal_code ?? ''}
              onChange={(event) =>
                setAddress((previous) => ({
                  ...previous,
                  postal_code: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address-state">State</Label>
          <select
            id="address-state"
            value={stateCode}
            onChange={(event) => setStateCode(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select state…</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={handleSaveAddress}
          disabled={isSavingAddress}
          className="w-full"
        >
          {isSavingAddress && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Address
        </Button>
      </CardContent>
    </Card>
  );
}
