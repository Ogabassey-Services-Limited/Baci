'use client';

import {
  AlertCircle,
  BarChart3,
  Code2,
  Globe,
  Image as ImageIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

export interface SetupSettings {
  // Site Settings
  site: {
    title: string;
    tagline: string;
    faviconUrl?: string;
    logoUrl?: string;
    contactEmail?: string;
    currency: string;
    timezone: string;
    language: string;
    units: 'metric' | 'imperial';
  };
  // Social Media
  social: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
    linkedin?: string;
  };
  // Analytics
  analytics: {
    googleAnalyticsId?: string;
    metaPixelId?: string;
    tiktokPixelId?: string;
    customTrackingCode?: string;
  };
  // Custom Code
  customCode: {
    customCss?: string;
    customJs?: string;
    headScripts?: string;
    bodyScripts?: string;
  };
}

interface SetupPanelProps {
  settings: SetupSettings;
  onChange: (settings: SetupSettings) => void;
}

const defaultSettings: SetupSettings = {
  site: {
    title: 'My Store',
    tagline: 'Premium products at affordable prices',
    currency: 'USD',
    timezone: 'America/New_York',
    language: 'en',
    units: 'imperial',
  },
  social: {},
  analytics: {},
  customCode: {},
};

const currencies = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'INR', label: 'INR (₹)' },
];

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

export function SetupPanel({ settings, onChange }: SetupPanelProps) {
  const [data, setData] = useState<SetupSettings>(settings || defaultSettings);
  const [prevSettings, setPrevSettings] = useState(settings);

  // React-recommended pattern: Reset state when prop changes (during render)
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setData(settings || defaultSettings);
  }

  const handleChange = (
    section: keyof SetupSettings,
    field: string,
    value: unknown
  ) => {
    const updated = {
      ...data,
      [section]: {
        ...data[section],
        [field]: value,
      },
    };
    setData(updated);
    onChange(updated);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Site Setup & Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure your site settings, analytics, and custom code
          </p>
        </div>

        {/* Site Settings */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <h3 className="font-medium">General Site Settings</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="site-title">Site Title</Label>
              <Input
                id="site-title"
                value={data.site.title}
                onChange={(e) => handleChange('site', 'title', e.target.value)}
                placeholder="My Awesome Store"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Appears in browser tabs and search results
              </p>
            </div>

            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={data.site.tagline}
                onChange={(e) =>
                  handleChange('site', 'tagline', e.target.value)
                }
                placeholder="Premium products at affordable prices"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Brief description of your store
              </p>
            </div>

            <div>
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={data.site.contactEmail || ''}
                onChange={(e) =>
                  handleChange('site', 'contactEmail', e.target.value)
                }
                placeholder="contact@yourstore.com"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={data.site.currency}
                  onValueChange={(value) =>
                    handleChange('site', 'currency', value)
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((curr) => (
                      <SelectItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="units">Measurement Units</Label>
                <Select
                  value={data.site.units}
                  onValueChange={(value) =>
                    handleChange('site', 'units', value)
                  }
                >
                  <SelectTrigger id="units">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imperial">
                      Imperial (lb, oz, in)
                    </SelectItem>
                    <SelectItem value="metric">Metric (kg, g, cm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={data.site.timezone}
                onValueChange={(value) =>
                  handleChange('site', 'timezone', value)
                }
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="language">Default Language</Label>
              <Select
                value={data.site.language}
                onValueChange={(value) =>
                  handleChange('site', 'language', value)
                }
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Branding */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" />
            <h3 className="font-medium">Branding</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                type="url"
                value={data.site.logoUrl || ''}
                onChange={(e) =>
                  handleChange('site', 'logoUrl', e.target.value)
                }
                placeholder="https://yourcdn.com/logo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 200x60px PNG with transparent background
              </p>
            </div>

            <div>
              <Label htmlFor="favicon-url">Favicon URL</Label>
              <Input
                id="favicon-url"
                type="url"
                value={data.site.faviconUrl || ''}
                onChange={(e) =>
                  handleChange('site', 'faviconUrl', e.target.value)
                }
                placeholder="https://yourcdn.com/favicon.ico"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 32x32px ICO or PNG
              </p>
            </div>
          </div>
        </Card>

        {/* Social Media */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <h3 className="font-medium">Social Media Links</h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                type="url"
                value={data.social.facebook || ''}
                onChange={(e) =>
                  handleChange('social', 'facebook', e.target.value)
                }
                placeholder="https://facebook.com/yourstore"
              />
            </div>

            <div>
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                type="url"
                value={data.social.instagram || ''}
                onChange={(e) =>
                  handleChange('social', 'instagram', e.target.value)
                }
                placeholder="https://instagram.com/yourstore"
              />
            </div>

            <div>
              <Label htmlFor="twitter">Twitter / X</Label>
              <Input
                id="twitter"
                type="url"
                value={data.social.twitter || ''}
                onChange={(e) =>
                  handleChange('social', 'twitter', e.target.value)
                }
                placeholder="https://twitter.com/yourstore"
              />
            </div>

            <div>
              <Label htmlFor="tiktok">TikTok</Label>
              <Input
                id="tiktok"
                type="url"
                value={data.social.tiktok || ''}
                onChange={(e) =>
                  handleChange('social', 'tiktok', e.target.value)
                }
                placeholder="https://tiktok.com/@yourstore"
              />
            </div>
          </div>
        </Card>

        {/* Analytics Integration */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <h3 className="font-medium">Analytics & Tracking</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="ga4">
                Google Analytics 4 (GA4) Measurement ID
              </Label>
              <Input
                id="ga4"
                value={data.analytics.googleAnalyticsId || ''}
                onChange={(e) =>
                  handleChange('analytics', 'googleAnalyticsId', e.target.value)
                }
                placeholder="G-XXXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: G-XXXXXXXXXX
              </p>
            </div>

            <div>
              <Label htmlFor="meta-pixel">Meta Pixel ID (Facebook)</Label>
              <Input
                id="meta-pixel"
                value={data.analytics.metaPixelId || ''}
                onChange={(e) =>
                  handleChange('analytics', 'metaPixelId', e.target.value)
                }
                placeholder="1234567890123456"
              />
              <p className="text-xs text-muted-foreground mt-1">
                15-16 digit number from Meta Events Manager
              </p>
            </div>

            <div>
              <Label htmlFor="tiktok-pixel">TikTok Pixel ID</Label>
              <Input
                id="tiktok-pixel"
                value={data.analytics.tiktokPixelId || ''}
                onChange={(e) =>
                  handleChange('analytics', 'tiktokPixelId', e.target.value)
                }
                placeholder="ABCDEFGHIJK1234567890"
              />
              <p className="text-xs text-muted-foreground mt-1">
                From TikTok Events Manager
              </p>
            </div>

            <div>
              <Label htmlFor="custom-tracking">Custom Tracking Code</Label>
              <Textarea
                id="custom-tracking"
                value={data.analytics.customTrackingCode || ''}
                onChange={(e) =>
                  handleChange(
                    'analytics',
                    'customTrackingCode',
                    e.target.value
                  )
                }
                placeholder="<!-- Other analytics scripts -->"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Any other analytics scripts (Hotjar, Mixpanel, etc.)
              </p>
            </div>
          </div>
        </Card>

        {/* Custom Code Injection */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            <h3 className="font-medium">Custom Code Injection</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="custom-css">Custom CSS</Label>
              <Textarea
                id="custom-css"
                value={data.customCode.customCss || ''}
                onChange={(e) =>
                  handleChange('customCode', 'customCss', e.target.value)
                }
                placeholder=".my-custom-class { color: red; }"
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Custom CSS to override default styles
              </p>
            </div>

            <div>
              <Label htmlFor="custom-js">Custom JavaScript</Label>
              <Textarea
                id="custom-js"
                value={data.customCode.customJs || ''}
                onChange={(e) =>
                  handleChange('customCode', 'customJs', e.target.value)
                }
                placeholder="console.log('Hello from custom JS');"
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Custom JavaScript for advanced functionality
              </p>
            </div>

            <Separator />

            <div>
              <Label htmlFor="head-scripts">
                Head Scripts (before &lt;/head&gt;)
              </Label>
              <Textarea
                id="head-scripts"
                value={data.customCode.headScripts || ''}
                onChange={(e) =>
                  handleChange('customCode', 'headScripts', e.target.value)
                }
                placeholder="<script>/* Injected before </head> */</script>"
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Scripts to load in the {`<head>`} section
              </p>
            </div>

            <div>
              <Label htmlFor="body-scripts">
                Body Scripts (before &lt;/body&gt;)
              </Label>
              <Textarea
                id="body-scripts"
                value={data.customCode.bodyScripts || ''}
                onChange={(e) =>
                  handleChange('customCode', 'bodyScripts', e.target.value)
                }
                placeholder="<script>/* Injected before </body> */</script>"
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Scripts to load at the end of {`<body>`}
              </p>
            </div>
          </div>
        </Card>

        {/* Tips */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="size-4 text-primary" />
            Setup Tips
          </h4>
          <ul className="text-xs space-y-1.5 text-muted-foreground">
            <li>
              • Add Google Analytics to track visitor behavior and conversions
            </li>
            <li>
              • Meta Pixel is essential for Facebook/Instagram ad tracking
            </li>
            <li>• Test custom code in a staging environment first</li>
            <li>• Keep your logo under 50KB for fast loading</li>
            <li>• Use HTTPS URLs for all external resources</li>
          </ul>
        </Card>
      </div>
    </ScrollArea>
  );
}
