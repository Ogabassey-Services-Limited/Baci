'use client';

import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { createClient } from '@/lib/supabase/client';

interface TaxSettingsFormProps {
  merchantId: string;
  initialVatEnabled: boolean;
  initialVatRate: number;
  initialTaxId: string;
}

export function TaxSettingsForm({
  merchantId,
  initialVatEnabled,
  initialVatRate,
  initialTaxId,
}: TaxSettingsFormProps) {
  const { toast } = useToast();
  const [vatEnabled, setVatEnabled] = useState(initialVatEnabled);
  const [taxId, setTaxId] = useState(initialTaxId);
  const [isLoading, setIsLoading] = useState(false);

  const handleVatToggle = async (enabled: boolean) => {
    setIsLoading(true);
    setVatEnabled(enabled); // Optimistic update

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('merchants')
        .update({
          vat_registration_status: enabled ? 'registered' : 'not_registered',
        })
        .eq('id', merchantId);

      if (error) throw error;

      toast({
        title: enabled ? 'VAT Enabled' : 'VAT Disabled',
        description: enabled
          ? '7.5% VAT will be applied to all orders.'
          : 'VAT will no longer be applied to orders.',
      });
    } catch (_error) {
      // Revert on error
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
    // Validate TIN format (10 digits for Nigeria)
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
      const supabase = createClient();
      const { error } = await supabase
        .from('merchants')
        .update({
          tax_identification_number: taxId || null,
        })
        .eq('id', merchantId);

      if (error) throw error;

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
              <span className="font-semibold">Nigeria 🇳🇬</span>
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
