'use client';

import {
  BarChart3,
  Bell,
  FileText,
  Loader2,
  Package,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  type MerchantFeatureSettings,
  useMerchantFeatures,
} from '@/hooks/use-merchant-features';

interface FeatureToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: string;
}

function FeatureToggle({
  label,
  description,
  enabled,
  onToggle,
  disabled,
  badge,
}: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
}

export function FeatureSettingsPanel() {
  const { settings, isLoading, isSaving, error, updateSettings } =
    useMerchantFeatures();

  const [localSettings, setLocalSettings] = useState<
    Partial<MerchantFeatureSettings>
  >({});

  // Handle toggle changes
  const handleToggle = async (field: keyof MerchantFeatureSettings) => {
    if (!settings) return;
    const currentValue = settings[field];
    if (typeof currentValue !== 'boolean') return;

    await updateSettings({ [field]: !currentValue });
  };

  // Handle input changes (debounced save)
  const handleInputChange = (
    field: keyof MerchantFeatureSettings,
    value: string | number | null
  ) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveInputs = async () => {
    if (Object.keys(localSettings).length === 0) return;
    await updateSettings(localSettings);
    setLocalSettings({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center gap-2 shadow-lg z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={['features', 'checkout']}
        className="space-y-4"
      >
        {/* Core Features */}
        <AccordionItem value="features" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <span className="font-semibold">Core Features</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="divide-y">
              <FeatureToggle
                label="Loyalty Program"
                description="Enable points, tiers, and rewards for customers"
                enabled={settings.loyalty_enabled}
                onToggle={() => handleToggle('loyalty_enabled')}
                badge="Premium"
              />
              <FeatureToggle
                label="Product Reviews"
                description="Allow customers to leave reviews on products"
                enabled={settings.reviews_enabled}
                onToggle={() => handleToggle('reviews_enabled')}
              />
              <FeatureToggle
                label="Wishlist"
                description="Let customers save products for later"
                enabled={settings.wishlist_enabled}
                onToggle={() => handleToggle('wishlist_enabled')}
              />
              <FeatureToggle
                label="Order Tracking"
                description="Allow customers to track their order status"
                enabled={settings.order_tracking_enabled}
                onToggle={() => handleToggle('order_tracking_enabled')}
              />
              <FeatureToggle
                label="Discount Codes"
                description="Enable promotional discount codes"
                enabled={settings.discount_codes_enabled}
                onToggle={() => handleToggle('discount_codes_enabled')}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Checkout Settings */}
        <AccordionItem value="checkout" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span className="font-semibold">Checkout Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="divide-y">
              <FeatureToggle
                label="Guest Checkout"
                description="Allow customers to checkout without creating an account"
                enabled={settings.guest_checkout_enabled}
                onToggle={() => handleToggle('guest_checkout_enabled')}
              />
              <FeatureToggle
                label="Collect Phone Number"
                description="Require phone number during checkout"
                enabled={settings.checkout_collect_phone}
                onToggle={() => handleToggle('checkout_collect_phone')}
              />
              <FeatureToggle
                label="Order Notes"
                description="Allow customers to add notes to their order"
                enabled={settings.checkout_show_order_notes}
                onToggle={() => handleToggle('checkout_show_order_notes')}
              />

              <div className="py-4 space-y-4">
                <div>
                  <Label>Free Shipping Threshold</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Orders above this amount get free shipping (leave empty to
                    disable)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="50000"
                      defaultValue={settings.free_shipping_threshold || ''}
                      onChange={(e) =>
                        handleInputChange(
                          'free_shipping_threshold',
                          e.target.value
                            ? Number.parseFloat(e.target.value)
                            : null
                        )
                      }
                    />
                    {localSettings.free_shipping_threshold !== undefined && (
                      <Button onClick={handleSaveInputs} disabled={isSaving}>
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Shipping Insurance */}
        <AccordionItem value="insurance" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">Shipping Insurance</span>
              <Badge variant="secondary" className="text-xs">
                MyCover.ai
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground mb-4">
              Offer customers shipping protection at checkout powered by
              MyCover.ai (Sovereign Trust Insurance)
            </p>
            <div className="divide-y">
              <FeatureToggle
                label="Enable Shipping Insurance"
                description="Allow customers to add shipping protection to their orders"
                enabled={settings.shipping_insurance_enabled ?? false}
                onToggle={() => handleToggle('shipping_insurance_enabled')}
              />
              <FeatureToggle
                label="Pre-select Insurance"
                description="Insurance option is checked by default at checkout"
                enabled={settings.shipping_insurance_opt_in_default ?? false}
                onToggle={() =>
                  handleToggle('shipping_insurance_opt_in_default')
                }
                disabled={!settings.shipping_insurance_enabled}
              />

              <div className="py-4 space-y-4">
                <div>
                  <Label>Minimum Order Value</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Only show insurance option for orders above this amount
                    (NGN)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="5000"
                      defaultValue={
                        settings.shipping_insurance_min_order_value || 5000
                      }
                      onChange={(e) =>
                        handleInputChange(
                          'shipping_insurance_min_order_value',
                          e.target.value
                            ? Number.parseFloat(e.target.value)
                            : 5000
                        )
                      }
                      disabled={!settings.shipping_insurance_enabled}
                    />
                    {localSettings.shipping_insurance_min_order_value !==
                      undefined && (
                      <Button onClick={handleSaveInputs} disabled={isSaving}>
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Store Pages */}
        <AccordionItem value="pages" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span className="font-semibold">Store Pages</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground mb-4">
              Enable or disable pages in your storefront navigation
            </p>
            <div className="divide-y">
              <FeatureToggle
                label="About Page"
                description="Your store's story and mission"
                enabled={settings.about_page_enabled}
                onToggle={() => handleToggle('about_page_enabled')}
              />
              <FeatureToggle
                label="Contact Page"
                description="Contact form and information"
                enabled={settings.contact_page_enabled}
                onToggle={() => handleToggle('contact_page_enabled')}
              />
              <FeatureToggle
                label="FAQ Page"
                description="Frequently asked questions"
                enabled={settings.faq_page_enabled}
                onToggle={() => handleToggle('faq_page_enabled')}
              />
              <FeatureToggle
                label="Privacy Policy"
                description="Your privacy policy page"
                enabled={settings.privacy_page_enabled}
                onToggle={() => handleToggle('privacy_page_enabled')}
              />
              <FeatureToggle
                label="Terms of Service"
                description="Your terms and conditions"
                enabled={settings.terms_page_enabled}
                onToggle={() => handleToggle('terms_page_enabled')}
              />
              <FeatureToggle
                label="Rewards Page"
                description="Loyalty program page (requires loyalty to be enabled)"
                enabled={settings.rewards_page_enabled}
                onToggle={() => handleToggle('rewards_page_enabled')}
                disabled={!settings.loyalty_enabled}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Social Proof */}
        <AccordionItem value="social" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="font-semibold">Social Proof</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="divide-y">
              <FeatureToggle
                label="Recent Purchases"
                description="Show notifications of recent purchases to visitors"
                enabled={settings.show_recent_purchases}
                onToggle={() => handleToggle('show_recent_purchases')}
              />
              <FeatureToggle
                label="Stock Levels"
                description="Show low stock warnings on products"
                enabled={settings.show_stock_levels}
                onToggle={() => handleToggle('show_stock_levels')}
              />

              <div className="py-4 space-y-4">
                <div>
                  <Label>Low Stock Threshold</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Show &quot;Low Stock&quot; warning when quantity is below
                    this number
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      defaultValue={settings.low_stock_threshold}
                      onChange={(e) =>
                        handleInputChange(
                          'low_stock_threshold',
                          Number.parseInt(e.target.value, 10) || 10
                        )
                      }
                    />
                    {localSettings.low_stock_threshold !== undefined && (
                      <Button onClick={handleSaveInputs} disabled={isSaving}>
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Analytics */}
        <AccordionItem value="analytics" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <span className="font-semibold">Analytics & Tracking</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <Label>Google Analytics ID</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  e.g., G-XXXXXXXXXX
                </p>
                <Input
                  placeholder="G-XXXXXXXXXX"
                  defaultValue={settings.google_analytics_id || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'google_analytics_id',
                      e.target.value || null
                    )
                  }
                />
              </div>
              <div>
                <Label>Facebook Pixel ID</Label>
                <Input
                  placeholder="Your Pixel ID"
                  defaultValue={settings.facebook_pixel_id || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'facebook_pixel_id',
                      e.target.value || null
                    )
                  }
                />
              </div>
              <div>
                <Label>TikTok Pixel ID</Label>
                <Input
                  placeholder="Your TikTok Pixel ID"
                  defaultValue={settings.tiktok_pixel_id || ''}
                  onChange={(e) =>
                    handleInputChange('tiktok_pixel_id', e.target.value || null)
                  }
                />
              </div>
              {Object.keys(localSettings).some((k) =>
                [
                  'google_analytics_id',
                  'facebook_pixel_id',
                  'tiktok_pixel_id',
                ].includes(k)
              ) && (
                <Button onClick={handleSaveInputs} disabled={isSaving}>
                  Save Analytics Settings
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <AccordionItem value="notifications" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <span className="font-semibold">Notifications</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="divide-y">
              <FeatureToggle
                label="Email Notifications"
                description="Send order confirmations and updates via email"
                enabled={settings.email_notifications_enabled}
                onToggle={() => handleToggle('email_notifications_enabled')}
              />
              <FeatureToggle
                label="SMS Notifications"
                description="Send order updates via SMS"
                enabled={settings.sms_notifications_enabled}
                onToggle={() => handleToggle('sms_notifications_enabled')}
                badge="Coming Soon"
                disabled
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default FeatureSettingsPanel;
