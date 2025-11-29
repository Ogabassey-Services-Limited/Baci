'use client';

import { useMerchantFeatures } from '@/hooks/use-merchant-features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Heart,
  Star,
  MessageSquare,
  Percent,
  Gift,
  UserCheck,
  StickyNote,
  Mail,
  Share2,
  Users,
  LayoutGrid,
  Clock,
  Sparkles,
  Bell,
  Package,
} from 'lucide-react';

interface FeatureConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresSetup?: boolean;
}

interface FeatureGroupConfig {
  title: string;
  description: string;
  features: FeatureConfig[];
}

const featureGroups: FeatureGroupConfig[] = [
  {
    title: 'Store Pages',
    description: 'Control which informational pages are available on your store',
    features: [
      {
        key: 'enable_about_page',
        label: 'About Page',
        description: 'Show an about page with your store story',
        icon: FileText,
      },
      {
        key: 'enable_faq_page',
        label: 'FAQ Page',
        description: 'Display frequently asked questions',
        icon: MessageSquare,
      },
      {
        key: 'enable_privacy_page',
        label: 'Privacy Policy',
        description: 'Show your privacy policy page',
        icon: FileText,
      },
      {
        key: 'enable_terms_page',
        label: 'Terms of Service',
        description: 'Show your terms and conditions',
        icon: FileText,
      },
      {
        key: 'enable_contact_page',
        label: 'Contact Page',
        description: 'Allow customers to contact you',
        icon: Mail,
      },
    ],
  },
  {
    title: 'Customer Features',
    description: 'Enhance the shopping experience for your customers',
    features: [
      {
        key: 'enable_loyalty_program',
        label: 'Loyalty Program',
        description: 'Reward customers with points for purchases',
        icon: Sparkles,
        requiresSetup: true,
      },
      {
        key: 'enable_wishlist',
        label: 'Wishlist',
        description: 'Let customers save products for later',
        icon: Heart,
      },
      {
        key: 'enable_reviews',
        label: 'Product Reviews',
        description: 'Allow customers to leave reviews',
        icon: Star,
      },
      {
        key: 'enable_product_questions',
        label: 'Product Q&A',
        description: 'Enable customer questions on products',
        icon: MessageSquare,
      },
    ],
  },
  {
    title: 'Checkout Features',
    description: 'Customize the checkout experience',
    features: [
      {
        key: 'enable_discount_codes',
        label: 'Discount Codes',
        description: 'Accept discount codes at checkout',
        icon: Percent,
      },
      {
        key: 'enable_gift_cards',
        label: 'Gift Cards',
        description: 'Sell and accept gift cards',
        icon: Gift,
        requiresSetup: true,
      },
      {
        key: 'enable_guest_checkout',
        label: 'Guest Checkout',
        description: 'Allow checkout without account',
        icon: UserCheck,
      },
      {
        key: 'enable_order_notes',
        label: 'Order Notes',
        description: 'Let customers add notes to orders',
        icon: StickyNote,
      },
    ],
  },
  {
    title: 'Marketing Features',
    description: 'Tools to grow your customer base',
    features: [
      {
        key: 'enable_newsletter',
        label: 'Newsletter Signup',
        description: 'Collect email addresses for marketing',
        icon: Mail,
      },
      {
        key: 'enable_social_share',
        label: 'Social Sharing',
        description: 'Add share buttons to products',
        icon: Share2,
      },
      {
        key: 'enable_referral_program',
        label: 'Referral Program',
        description: 'Reward customers for referrals',
        icon: Users,
        requiresSetup: true,
      },
    ],
  },
  {
    title: 'Advanced Features',
    description: 'Additional tools for your store',
    features: [
      {
        key: 'enable_product_comparison',
        label: 'Product Comparison',
        description: 'Let customers compare products',
        icon: LayoutGrid,
      },
      {
        key: 'enable_recently_viewed',
        label: 'Recently Viewed',
        description: 'Show recently viewed products',
        icon: Clock,
      },
      {
        key: 'enable_product_recommendations',
        label: 'Product Recommendations',
        description: 'Show personalized suggestions',
        icon: Sparkles,
      },
      {
        key: 'enable_inventory_alerts',
        label: 'Low Stock Alerts',
        description: 'Show low stock warnings',
        icon: Package,
      },
      {
        key: 'enable_back_in_stock_notifications',
        label: 'Back in Stock Alerts',
        description: 'Notify customers when items return',
        icon: Bell,
        requiresSetup: true,
      },
    ],
  },
];

export function FeatureSettingsPanel() {
  const { settings, loading, saving, toggleFeature } = useMerchantFeatures();
  const { toast } = useToast();

  const handleToggle = async (featureKey: string, enabled: boolean) => {
    const result = await toggleFeature(featureKey, enabled);
    if (result.success) {
      toast({
        title: 'Success',
        description: `Feature ${enabled ? 'enabled' : 'disabled'}`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update feature',
        variant: 'destructive',
      });
    }
  };

  const getFeatureValue = (key: string): boolean => {
    if (!settings) return false;

    // Map feature keys to their values in the settings object
    const mapping: Record<string, boolean | undefined> = {
      enable_about_page: settings.store_pages?.about,
      enable_faq_page: settings.store_pages?.faq,
      enable_privacy_page: settings.store_pages?.privacy,
      enable_terms_page: settings.store_pages?.terms,
      enable_contact_page: settings.store_pages?.contact,
      enable_loyalty_program: settings.customer_features?.loyalty_program,
      enable_wishlist: settings.customer_features?.wishlist,
      enable_reviews: settings.customer_features?.reviews,
      enable_product_questions: settings.customer_features?.product_questions,
      enable_discount_codes: settings.checkout_features?.discount_codes,
      enable_gift_cards: settings.checkout_features?.gift_cards,
      enable_guest_checkout: settings.checkout_features?.guest_checkout,
      enable_order_notes: settings.checkout_features?.order_notes,
      enable_newsletter: settings.marketing_features?.newsletter,
      enable_social_share: settings.marketing_features?.social_share,
      enable_referral_program: settings.marketing_features?.referral_program,
      enable_product_comparison: settings.advanced_features?.product_comparison,
      enable_recently_viewed: settings.advanced_features?.recently_viewed,
      enable_product_recommendations: settings.advanced_features?.product_recommendations,
      enable_inventory_alerts: settings.advanced_features?.inventory_alerts,
      enable_back_in_stock_notifications: settings.advanced_features?.back_in_stock_notifications,
    };

    return mapping[key] ?? false;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {featureGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {group.features.map((feature, index) => {
                const Icon = feature.icon;
                const isEnabled = getFeatureValue(feature.key);

                return (
                  <div key={feature.key}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={feature.key}
                              className="font-medium cursor-pointer"
                            >
                              {feature.label}
                            </Label>
                            {feature.requiresSetup && (
                              <Badge variant="outline" className="text-xs">
                                Requires Setup
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id={feature.key}
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          handleToggle(feature.key, checked)
                        }
                        disabled={saving}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
