'use client';

import type { RegisteredAddress } from '@baci/shared';
import { Building2, Info, Loader2 } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { apiPatch, apiPost } from '@/lib/api-client';
import {
  isValidTaxIdentificationNumber,
  normalizeTaxIdentificationNumber,
  TAX_IDENTIFICATION_NUMBER_MAX_LENGTH,
} from '@/lib/tax-identification';
import { TaxSettingsAddressCard } from './tax-settings-address-card';
import type { VerifyTaxIdResponse } from './tax-settings-types';
import { TaxSettingsVatCard } from './tax-settings-vat-card';
import { useTaxSettingsMutationScope } from './use-tax-settings-mutation-scope';

interface TaxSettingsFormProps {
  merchantId: string;
  initialVatEnabled: boolean;
  initialVatRate: number;
  initialTaxId: string;
  initialLegalEntityName: string;
  initialRegisteredAddress: RegisteredAddress;
  initialStateCode: string;
}

export function TaxSettingsForm({
  merchantId,
  initialVatEnabled,
  initialVatRate,
  initialTaxId,
  initialLegalEntityName,
  initialRegisteredAddress,
  initialStateCode,
}: TaxSettingsFormProps) {
  const { toast } = useToast();
  const [vatEnabled, setVatEnabled] = useState(initialVatEnabled);
  const [taxId, setTaxId] = useState(
    normalizeTaxIdentificationNumber(initialTaxId)
  );
  const [legalEntityName, setLegalEntityName] = useState(
    initialLegalEntityName
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingEntity, setIsSavingEntity] = useState(false);
  const { beginRequest } = useTaxSettingsMutationScope(merchantId);

  useLayoutEffect(() => {
    // Merchant identity is a reset boundary even when incoming values match.
    void merchantId;
    setVatEnabled(initialVatEnabled);
    setTaxId(normalizeTaxIdentificationNumber(initialTaxId));
    setLegalEntityName(initialLegalEntityName);
    setIsLoading(false);
    setIsSavingEntity(false);
  }, [initialLegalEntityName, initialTaxId, initialVatEnabled, merchantId]);

  const saveSettings = async (payload: Record<string, unknown>) => {
    await apiPatch('/api/merchant/settings', { merchantId, ...payload });
  };

  const handleVatToggle = async (enabled: boolean) => {
    const isCurrentRequest = beginRequest('vat');
    setIsLoading(true);
    setVatEnabled(enabled);

    try {
      await saveSettings({
        vat_registration_status: enabled ? 'registered' : 'not_registered',
      });
      if (!isCurrentRequest()) return;

      toast({
        title: enabled ? 'VAT Enabled' : 'VAT Disabled',
        description: enabled
          ? '7.5% VAT will be applied to all orders.'
          : 'VAT will no longer be applied to orders.',
      });
    } catch (_error) {
      if (!isCurrentRequest()) return;
      setVatEnabled(!enabled);
      toast({
        title: 'Update Failed',
        description: 'Could not update VAT settings. Please try again.',
        variant: 'destructive',
      });
    }

    if (isCurrentRequest()) setIsLoading(false);
  };

  const handleSaveTaxId = async () => {
    const normalizedTaxId = normalizeTaxIdentificationNumber(taxId);

    if (normalizedTaxId && !isValidTaxIdentificationNumber(normalizedTaxId)) {
      toast({
        title: 'Invalid Tax ID',
        description: 'Nigerian TIN must be 10 to 15 digits.',
        variant: 'destructive',
      });
      return;
    }

    const isCurrentRequest = beginRequest('taxId');
    setIsLoading(true);
    try {
      if (!normalizedTaxId) {
        await saveSettings({
          tax_identification_number: null,
        });

        if (!isCurrentRequest()) return;
        toast({
          title: 'Tax ID Saved',
          description: 'Your Tax Identification Number has been cleared.',
        });
      } else {
        const verification = await apiPost<VerifyTaxIdResponse>(
          '/api/merchant/verify-tax-id',
          {
            merchantId,
            taxIdentificationNumber: normalizedTaxId,
            legalEntityName: legalEntityName.trim() || undefined,
          }
        );

        if (!isCurrentRequest()) return;
        setTaxId(verification.taxIdentificationNumber ?? normalizedTaxId);
        toast({
          title: 'Tax ID Verified',
          description: 'Your Tax Identification Number matches the CAC record.',
        });
      }
    } catch (error) {
      if (!isCurrentRequest()) return;
      toast({
        title: 'Tax ID Verification Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Could not verify Tax ID. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (isCurrentRequest()) setIsLoading(false);
    }
  };

  const handleSaveLegalEntity = async () => {
    const isCurrentRequest = beginRequest('legalEntity');
    setIsSavingEntity(true);
    try {
      await saveSettings({
        legal_entity_name: legalEntityName || null,
      });
      if (!isCurrentRequest()) return;

      toast({
        title: 'Legal Entity Name Saved',
        description: 'Your registered business name has been updated.',
      });
    } catch (_error) {
      if (!isCurrentRequest()) return;
      toast({
        title: 'Update Failed',
        description: 'Could not save legal entity name. Please try again.',
        variant: 'destructive',
      });
    }

    if (isCurrentRequest()) setIsSavingEntity(false);
  };

  return (
    <div className="grid gap-6">
      <TaxSettingsVatCard
        disabled={isLoading}
        initialVatRate={initialVatRate}
        onToggle={handleVatToggle}
        vatEnabled={vatEnabled}
      />

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
                placeholder="2522599781276"
                value={taxId}
                onChange={(e) =>
                  setTaxId(
                    normalizeTaxIdentificationNumber(e.target.value).slice(
                      0,
                      TAX_IDENTIFICATION_NUMBER_MAX_LENGTH
                    )
                  )
                }
                maxLength={TAX_IDENTIFICATION_NUMBER_MAX_LENGTH}
                className="font-mono"
              />
              <Button onClick={handleSaveTaxId} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {taxId ? 'Verify & Save' : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              TIN issued to this CAC-registered business
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
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
                  <Loader2 className="mr-2 size-4 animate-spin" />
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

      <TaxSettingsAddressCard
        initialRegisteredAddress={initialRegisteredAddress}
        initialStateCode={initialStateCode}
        onSaveAddress={saveSettings}
      />

      {/* Info Alert */}
      <Alert>
        <Info className="size-4" />
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
