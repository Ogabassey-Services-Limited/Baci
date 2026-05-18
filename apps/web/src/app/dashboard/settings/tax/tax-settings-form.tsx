'use client';

import { NIGERIAN_STATES, type RegisteredAddress } from '@baci/shared';
import { Building2, CheckCircle2, Info, Loader2, MapPin } from 'lucide-react';
import { useState } from 'react';
import {
  AddressAutocomplete,
  type PlaceDetails,
} from '@/components/address-autocomplete';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiPatch } from '@/lib/api-client';

interface TaxSettingsFormProps {
  initialVatEnabled: boolean;
  initialVatRate: number;
  initialTaxId: string;
  initialLegalEntityName: string;
  initialRegisteredAddress: RegisteredAddress;
  initialStateCode: string;
}

export function TaxSettingsForm({
  initialVatEnabled,
  initialVatRate,
  initialTaxId,
  initialLegalEntityName,
  initialRegisteredAddress,
  initialStateCode,
}: TaxSettingsFormProps) {
  const { toast } = useToast();
  const [vatEnabled, setVatEnabled] = useState(initialVatEnabled);
  const [taxId, setTaxId] = useState(initialTaxId);
  const [legalEntityName, setLegalEntityName] = useState(
    initialLegalEntityName
  );
  const [address, setAddress] = useState<RegisteredAddress>({
    ...initialRegisteredAddress,
    country: initialRegisteredAddress.country ?? 'Nigeria',
  });
  const [stateCode, setStateCode] = useState(initialStateCode);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingEntity, setIsSavingEntity] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const saveSettings = async (payload: Record<string, unknown>) => {
    await apiPatch('/api/merchant/settings', payload);
  };

  const handleVatToggle = async (enabled: boolean) => {
    setIsLoading(true);
    setVatEnabled(enabled);

    try {
      await saveSettings({
        vat_registration_status: enabled ? 'registered' : 'not_registered',
      });

      toast({
        title: enabled ? 'VAT Enabled' : 'VAT Disabled',
        description: enabled
          ? '7.5% VAT will be applied to all orders.'
          : 'VAT will no longer be applied to orders.',
      });
    } catch (_error) {
      setVatEnabled(!enabled);
      toast({
        title: 'Update Failed',
        description: 'Could not update VAT settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTaxId = async () => {
    if (taxId && !/^\d{10}$/.test(taxId)) {
      toast({
        title: 'Invalid Tax ID',
        description: 'Nigerian TIN must be exactly 10 digits.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await saveSettings({
        tax_identification_number: taxId || null,
      });

      toast({
        title: 'Tax ID Saved',
        description: 'Your Tax Identification Number has been updated.',
      });
    } catch (_error) {
      toast({
        title: 'Update Failed',
        description: 'Could not save Tax ID. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLegalEntity = async () => {
    setIsSavingEntity(true);
    try {
      await saveSettings({
        legal_entity_name: legalEntityName || null,
      });

      toast({
        title: 'Legal Entity Name Saved',
        description: 'Your registered business name has been updated.',
      });
    } catch (_error) {
      toast({
        title: 'Update Failed',
        description: 'Could not save legal entity name. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEntity(false);
    }
  };

  const handleStreetChange = (
    e: React.ChangeEvent<HTMLInputElement> | string
  ) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setAddress((prev) => ({ ...prev, street: value }));
  };

  const handleAddressSelect = (place: PlaceDetails) => {
    const street = [place.streetNumber, place.route].filter(Boolean).join(' ');
    setAddress((prev) => ({
      ...prev,
      street: street || prev.street,
      city: place.city || prev.city,
      postal_code: place.zip || prev.postal_code,
      state: place.state || prev.state,
    }));

    // Auto-match state name to Nigerian state code
    if (place.state) {
      const matchedState = NIGERIAN_STATES.find(
        (s) => s.name.toLowerCase() === place.state.toLowerCase()
      );
      if (matchedState) {
        setStateCode(matchedState.code);
      }
    }
  };

  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    try {
      const selectedState = NIGERIAN_STATES.find((s) => s.code === stateCode);
      await saveSettings({
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
    } catch (_error) {
      toast({
        title: 'Update Failed',
        description: 'Could not save address. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingAddress(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* VAT Toggle Card */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                VAT Collection
                {vatEnabled && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Enable to charge 7.5% VAT on all orders
              </CardDescription>
            </div>
            <Switch
              checked={vatEnabled}
              onCheckedChange={handleVatToggle}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">VAT Rate</span>
              <span className="font-semibold">{initialVatRate}%</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Country</span>
              <span className="font-semibold">Nigeria</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax ID Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Tax Identification</CardTitle>
          <CardDescription>
            Your FIRS Tax Identification Number (TIN) for invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tax-id">Tax Identification Number (TIN)</Label>
            <div className="flex gap-2">
              <Input
                id="tax-id"
                placeholder="1234567890"
                value={taxId}
                onChange={(e) =>
                  setTaxId(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                maxLength={10}
                className="font-mono"
              />
              <Button onClick={handleSaveTaxId} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              10-digit Nigerian TIN issued by FIRS
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Legal Entity Name Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Legal Entity Name
          </CardTitle>
          <CardDescription>
            Your officially registered business name as it appears on CAC
            documents. This will be used on invoices and tax documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="legal-entity-name">Registered Business Name</Label>
            <div className="flex gap-2">
              <Input
                id="legal-entity-name"
                placeholder="e.g. Acme Enterprises Limited"
                value={legalEntityName}
                onChange={(e) => setLegalEntityName(e.target.value)}
              />
              <Button onClick={handleSaveLegalEntity} disabled={isSavingEntity}>
                {isSavingEntity && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The full legal name registered with CAC (Corporate Affairs
              Commission)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Registered Address Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
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
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-postal">Postal Code</Label>
              <Input
                id="address-postal"
                placeholder="e.g. 100001"
                value={address.postal_code ?? ''}
                onChange={(e) =>
                  setAddress((prev) => ({
                    ...prev,
                    postal_code: e.target.value,
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
              onChange={(e) => setStateCode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select state...</option>
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
            {isSavingAddress && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Address
          </Button>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About VAT in Nigeria</AlertTitle>
        <AlertDescription>
          VAT is mandatory for businesses with annual turnover above ₦25
          million. Ensure you are registered with FIRS before enabling VAT
          collection. The current rate is 7.5% as per the Finance Act 2020.
        </AlertDescription>
      </Alert>
    </div>
  );
}
