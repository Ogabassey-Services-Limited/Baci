'use client';

import {
  BarChart3,
  DollarSign,
  Eye,
  EyeOff,
  Facebook,
  Loader2,
  Save,
  Settings2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  PlatformSettingsResponse,
  PlatformSettingsSecretStatus,
} from '@/app/api/admin/settings/route';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiPut } from '@/lib/api-client';
import {
  buildPlatformSettingsUpdatePayload,
  EMPTY_PLATFORM_SETTINGS_SECRET_INPUTS,
  type PlatformSettingsSecretInputs,
} from './settings-payload';

type EditablePlatformSettings = Omit<
  PlatformSettingsResponse,
  'id' | 'created_at' | 'updated_at' | 'secretStatus'
>;

function getSecretPlaceholder(
  configured: boolean,
  emptyPlaceholder: string
): string {
  return configured
    ? 'Stored securely. Enter a new value to replace it.'
    : emptyPlaceholder;
}

function getSecretHelperText(configured: boolean, configuredLabel: string) {
  return configured
    ? `${configuredLabel} is already stored. Leave this blank to keep the current value.`
    : `No ${configuredLabel.toLowerCase()} has been configured yet.`;
}

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettingsResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [secretInputs, setSecretInputs] =
    useState<PlatformSettingsSecretInputs>(
      EMPTY_PLATFORM_SETTINGS_SECRET_INPUTS
    );
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load platform settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  useEffect(() => {
    fetchSettings();
  }, [toast]);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await apiPut<PlatformSettingsResponse>(
        '/api/admin/settings',
        buildPlatformSettingsUpdatePayload(settings, secretInputs)
      );
      setSettings(updated);
      setSecretInputs(EMPTY_PLATFORM_SETTINGS_SECRET_INPUTS);

      toast({
        title: 'Settings Saved',
        description: 'Platform settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save platform settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof EditablePlatformSettings>(
    key: K,
    value: EditablePlatformSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const updateSecretInput = <K extends keyof PlatformSettingsSecretStatus>(
    key: K,
    value: string
  ) => {
    setSecretInputs((current) => ({ ...current, [key]: value }));
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load settings. Please try refreshing the page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Platform Settings</h1>
          <p className="text-muted-foreground">
            Configure your platform analytics, fees, and features.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="fees" className="flex items-center gap-2">
            <DollarSign className="size-4" />
            Fees
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Settings2 className="size-4" />
            Features
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Google Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg
                  className="size-5 text-orange-500"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M22.84 2.998a2.157 2.157 0 0 0-2.157-2.16 2.157 2.157 0 1 0 0 4.314 2.157 2.157 0 0 0 2.157-2.154zm-2.157 6.312a2.157 2.157 0 0 0-2.157 2.157v10.376a2.157 2.157 0 0 0 4.314 0V11.467a2.157 2.157 0 0 0-2.157-2.157zM7.157 0A7.157 7.157 0 0 0 0 7.157v9.686a7.157 7.157 0 0 0 14.314 0V7.157A7.157 7.157 0 0 0 7.157 0zm2.843 16.843a2.843 2.843 0 1 1-5.686 0V7.157a2.843 2.843 0 0 1 5.686 0v9.686z" />
                </svg>
                Google Analytics 4
              </CardTitle>
              <CardDescription>
                Track platform traffic, merchant signups, and conversions in
                your GA4 dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ga4_id">Measurement ID</Label>
                  <Input
                    id="ga4_id"
                    placeholder="G-XXXXXXXXXX"
                    value={settings.google_analytics_id || ''}
                    onChange={(e) =>
                      updateSetting(
                        'google_analytics_id',
                        e.target.value || null
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Found in GA4 Admin → Data Streams → Your Stream
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ga4_secret">API Secret (Server-Side)</Label>
                  <div className="relative">
                    <Input
                      id="ga4_secret"
                      type={showSecrets.ga4_secret ? 'text' : 'password'}
                      placeholder={getSecretPlaceholder(
                        settings.secretStatus.ga4_api_secret,
                        'xxxxxxxxxxxxxxxx'
                      )}
                      value={secretInputs.ga4_api_secret}
                      onChange={(e) =>
                        updateSecretInput('ga4_api_secret', e.target.value)
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecretVisibility('ga4_secret')}
                    >
                      {showSecrets.ga4_secret ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getSecretHelperText(
                      settings.secretStatus.ga4_api_secret,
                      'GA4 API secret'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Facebook */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Facebook className="size-5 text-blue-600" />
                Facebook / Meta
              </CardTitle>
              <CardDescription>
                Track your Facebook/Instagram ad campaigns and merchant signup
                conversions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fb_pixel">Pixel ID</Label>
                  <Input
                    id="fb_pixel"
                    placeholder="1234567890123456"
                    value={settings.facebook_pixel_id || ''}
                    onChange={(e) =>
                      updateSetting('facebook_pixel_id', e.target.value || null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fb_capi">Conversions API Token</Label>
                  <div className="relative">
                    <Input
                      id="fb_capi"
                      type={showSecrets.fb_capi ? 'text' : 'password'}
                      placeholder={getSecretPlaceholder(
                        settings.secretStatus.facebook_capi_token,
                        'EAAxxxxxxxx...'
                      )}
                      value={secretInputs.facebook_capi_token}
                      onChange={(e) =>
                        updateSecretInput('facebook_capi_token', e.target.value)
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecretVisibility('fb_capi')}
                    >
                      {showSecrets.fb_capi ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getSecretHelperText(
                      settings.secretStatus.facebook_capi_token,
                      'Facebook Conversions API token'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TikTok */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
                TikTok
              </CardTitle>
              <CardDescription>
                Track TikTok ad campaigns for merchant acquisition.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tiktok_pixel">Pixel ID</Label>
                  <Input
                    id="tiktok_pixel"
                    placeholder="XXXXXXXXXX"
                    value={settings.tiktok_pixel_id || ''}
                    onChange={(e) =>
                      updateSetting('tiktok_pixel_id', e.target.value || null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok_token">Events API Token</Label>
                  <div className="relative">
                    <Input
                      id="tiktok_token"
                      type={showSecrets.tiktok_token ? 'text' : 'password'}
                      placeholder={getSecretPlaceholder(
                        settings.secretStatus.tiktok_access_token,
                        'xxxxxxxx...'
                      )}
                      value={secretInputs.tiktok_access_token}
                      onChange={(e) =>
                        updateSecretInput('tiktok_access_token', e.target.value)
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecretVisibility('tiktok_token')}
                    >
                      {showSecrets.tiktok_token ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getSecretHelperText(
                      settings.secretStatus.tiktok_access_token,
                      'TikTok Events API token'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Snapchat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg
                  className="size-5 text-yellow-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.422.422 0 01.493.075c.134.134.15.348.045.51a4.13 4.13 0 01-.39.554.862.862 0 00-.183.39c-.029.189-.009.391.194.596.049.05.096.09.156.136.178.135.333.232.465.315.36.24.63.435.795.645.197.254.229.515.132.765a1.184 1.184 0 01-.555.659c-.418.24-.98.375-1.593.494a4.83 4.83 0 00-.301.081c-.06.022-.12.045-.164.075-.06.045-.07.09-.06.135.03.12.09.21.165.314.064.091.121.165.139.192.271.39.48.69.376 1.022-.082.266-.35.46-.679.595a4.64 4.64 0 01-1.139.33 2.44 2.44 0 00-.449.121c-.123.06-.205.135-.255.24-.118.254-.165.599-.195.93-.042.449-.097.841-.298 1.159-.3.48-.865.72-1.67.72H8.91c-.806 0-1.372-.24-1.67-.72-.2-.318-.256-.71-.3-1.159-.029-.331-.075-.676-.194-.93-.05-.105-.133-.18-.256-.24a2.47 2.47 0 00-.45-.12 4.622 4.622 0 01-1.14-.33c-.328-.135-.597-.33-.68-.596-.103-.33.105-.63.377-1.021.018-.027.074-.1.138-.192.075-.104.135-.194.166-.314.009-.045 0-.09-.061-.135a1.02 1.02 0 00-.165-.075 5.13 5.13 0 00-.3-.082c-.615-.119-1.176-.254-1.594-.495a1.19 1.19 0 01-.555-.66c-.096-.249-.064-.509.133-.764.165-.21.434-.405.795-.645.132-.083.287-.18.465-.315l.156-.136c.203-.205.224-.407.195-.596a.862.862 0 00-.184-.39 4.11 4.11 0 01-.389-.555.358.358 0 01.045-.51.42.42 0 01.494-.075c.374.18.733.285 1.033.3.198 0 .326-.044.401-.09l-.03-.51-.002-.059c-.104-1.628-.23-3.654.299-4.847C7.86 1.069 11.216.793 12.206.793z" />
                </svg>
                Snapchat
              </CardTitle>
              <CardDescription>
                Track Snapchat ad campaigns for merchant acquisition.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="snap_pixel">Pixel ID</Label>
                  <Input
                    id="snap_pixel"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
                    value={settings.snapchat_pixel_id || ''}
                    onChange={(e) =>
                      updateSetting('snapchat_pixel_id', e.target.value || null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snap_capi">Conversions API Token</Label>
                  <div className="relative">
                    <Input
                      id="snap_capi"
                      type={showSecrets.snap_capi ? 'text' : 'password'}
                      placeholder={getSecretPlaceholder(
                        settings.secretStatus.snapchat_capi_token,
                        'xxxxxxxx...'
                      )}
                      value={secretInputs.snapchat_capi_token}
                      onChange={(e) =>
                        updateSecretInput('snapchat_capi_token', e.target.value)
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecretVisibility('snap_capi')}
                    >
                      {showSecrets.snap_capi ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getSecretHelperText(
                      settings.secretStatus.snapchat_capi_token,
                      'Snapchat Conversions API token'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Twitter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Twitter / X
              </CardTitle>
              <CardDescription>
                Track Twitter/X ad campaigns (client-side pixel only).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="twitter_pixel">Pixel ID</Label>
                <Input
                  id="twitter_pixel"
                  placeholder="xxxxxxxxx"
                  value={settings.twitter_pixel_id || ''}
                  onChange={(e) =>
                    updateSetting('twitter_pixel_id', e.target.value || null)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fees Tab */}
        <TabsContent value="fees" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Fees</CardTitle>
              <CardDescription>
                Configure the fees you charge merchants on each transaction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fee_percent">Platform Fee (%)</Label>
                  <div className="relative">
                    <Input
                      id="fee_percent"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      value={settings.platform_fee_percentage || ''}
                      onChange={(e) =>
                        updateSetting(
                          'platform_fee_percentage',
                          Number.parseFloat(e.target.value) || 0
                        )
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Percentage of each transaction that goes to the platform.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee_flat">Platform Flat Fee (NGN)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      ₦
                    </span>
                    <Input
                      id="fee_flat"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={settings.platform_fee_flat || ''}
                      onChange={(e) =>
                        updateSetting(
                          'platform_fee_flat',
                          Number.parseFloat(e.target.value) || 0
                        )
                      }
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fixed amount charged per transaction (in addition to %).
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-medium mb-4">
                  Payment Processor Fees (for reference)
                </h4>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="processor_percent">Processor Fee (%)</Label>
                    <div className="relative">
                      <Input
                        id="processor_percent"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="1.50"
                        value={settings.payment_processor_fee_percentage || ''}
                        onChange={(e) =>
                          updateSetting(
                            'payment_processor_fee_percentage',
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Korapay/Paystack percentage fee.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="processor_flat">
                      Processor Flat Fee (NGN)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        ₦
                      </span>
                      <Input
                        id="processor_flat"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="100.00"
                        value={settings.payment_processor_fee_flat || ''}
                        onChange={(e) =>
                          updateSetting(
                            'payment_processor_fee_flat',
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="pl-8"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Korapay/Paystack flat fee per transaction.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fee Calculator Preview */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-medium mb-4">
                  Fee Calculator Preview
                </h4>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    For a ₦10,000 transaction:
                  </p>
                  <ul className="space-y-1 text-sm">
                    <li className="flex justify-between">
                      <span>Platform Fee:</span>
                      <span className="font-medium">
                        ₦
                        {(
                          (settings.platform_fee_percentage / 100) * 10000 +
                          settings.platform_fee_flat
                        ).toFixed(2)}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Processor Fee:</span>
                      <span className="font-medium">
                        ₦
                        {(
                          (settings.payment_processor_fee_percentage / 100) *
                            10000 +
                          settings.payment_processor_fee_flat
                        ).toFixed(2)}
                      </span>
                    </li>
                    <li className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-medium">Net to Merchant:</span>
                      <span className="font-bold text-green-600">
                        ₦
                        {(
                          10000 -
                          ((settings.platform_fee_percentage / 100) * 10000 +
                            settings.platform_fee_flat) -
                          ((settings.payment_processor_fee_percentage / 100) *
                            10000 +
                            settings.payment_processor_fee_flat)
                        ).toFixed(2)}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable platform features.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Merchant Signups</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow new merchants to create accounts.
                  </p>
                </div>
                <Switch
                  checked={settings.enable_merchant_signups}
                  onCheckedChange={(checked) =>
                    updateSetting('enable_merchant_signups', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Custom Domains</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow merchants to connect custom domains.
                  </p>
                </div>
                <Switch
                  checked={settings.enable_custom_domains}
                  onCheckedChange={(checked) =>
                    updateSetting('enable_custom_domains', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Analytics Export</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow merchants to export their analytics data.
                  </p>
                </div>
                <Switch
                  checked={settings.enable_analytics_export}
                  onCheckedChange={(checked) =>
                    updateSetting('enable_analytics_export', checked)
                  }
                />
              </div>

              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-amber-600">Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Put the platform in maintenance mode (blocks all access).
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenance_mode}
                    onCheckedChange={(checked) =>
                      updateSetting('maintenance_mode', checked)
                    }
                  />
                </div>

                {settings.maintenance_mode && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="maintenance_msg">Maintenance Message</Label>
                    <Input
                      id="maintenance_msg"
                      placeholder="We'll be back shortly..."
                      value={settings.maintenance_message || ''}
                      onChange={(e) =>
                        updateSetting(
                          'maintenance_message',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Branding</CardTitle>
              <CardDescription>
                Customize your platform&apos;s identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="platform_name">Platform Name</Label>
                  <Input
                    id="platform_name"
                    placeholder="Baci"
                    value={settings.platform_name || ''}
                    onChange={(e) =>
                      updateSetting('platform_name', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform_logo">Logo URL</Label>
                  <Input
                    id="platform_logo"
                    placeholder="https://..."
                    value={settings.platform_logo_url || ''}
                    onChange={(e) =>
                      updateSetting('platform_logo_url', e.target.value || null)
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="support_email">Support Email</Label>
                  <Input
                    id="support_email"
                    type="email"
                    placeholder="support@baci.app"
                    value={settings.support_email || ''}
                    onChange={(e) =>
                      updateSetting('support_email', e.target.value || null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support_phone">Support Phone</Label>
                  <Input
                    id="support_phone"
                    placeholder="+234..."
                    value={settings.support_phone || ''}
                    onChange={(e) =>
                      updateSetting('support_phone', e.target.value || null)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(settings.updated_at).toLocaleString()}
      </p>
    </div>
  );
}
