'use client';

import { useEffect, useState } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
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
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';

interface AnnouncementBarConfig {
  enabled: boolean;
  message: string;
  link: string;
  background_color: string;
  text_color: string;
}

const DEFAULT_CONFIG: AnnouncementBarConfig = {
  enabled: true,
  message: 'Welcome to our store! Check out our latest deals.',
  link: '/category/deals',
  background_color: '#000000',
  text_color: '#ffffff',
};

export default function AnnouncementBarPage() {
  const { merchant, updateMerchant, loading } = useMerchant();
  const { toast } = useToast();
  const [config, setConfig] = useState<AnnouncementBarConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (merchant?.published_config?.announcement_bar) {
      setConfig({
        ...DEFAULT_CONFIG,
        ...(merchant.published_config
          .announcement_bar as Partial<AnnouncementBarConfig>),
      });
    }
  }, [merchant]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...merchant?.published_config,
        announcement_bar: config,
      };

      await updateMerchant({
        published_config: updatedConfig,
      });

      toast({
        title: 'Settings saved',
        description: 'Announcement bar settings have been updated.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <BagLoader size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Announcement Bar 📢
          </h1>
          <p className="text-muted-foreground">
            Display a message at the top of your store to announce sales or
            news.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Preview Card */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              This is how it will look on your store.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config.enabled ? (
              <div
                className="w-full py-2 px-4 text-center text-sm font-medium transition-colors"
                style={{
                  backgroundColor: config.background_color,
                  color: config.text_color,
                }}
              >
                {config.message || 'Your announcement message here'}
              </div>
            ) : (
              <div className="w-full py-2 px-4 text-center text-sm font-medium bg-gray-100 text-gray-400 border border-dashed border-gray-300">
                Announcement Bar Disabled
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enable Announcement Bar</Label>
                <p className="text-sm text-muted-foreground">
                  Show or hide the announcement bar on your storefront.
                </p>
              </div>
              <Switch
                id="enabled"
                checked={config.enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Input
                id="message"
                value={config.message}
                onChange={(e) =>
                  setConfig({ ...config, message: e.target.value })
                }
                placeholder="Free shipping on orders over $50!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Link (Optional)</Label>
              <Input
                id="link"
                value={config.link}
                onChange={(e) => setConfig({ ...config, link: e.target.value })}
                placeholder="/category/sale"
              />
              <p className="text-xs text-muted-foreground">
                Where should users go when they click the bar? Leave empty for
                no link.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bg-color">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="bg-color"
                    type="color"
                    className="w-12 h-10 p-1 cursor-pointer"
                    value={config.background_color}
                    onChange={(e) =>
                      setConfig({ ...config, background_color: e.target.value })
                    }
                  />
                  <Input
                    value={config.background_color}
                    onChange={(e) =>
                      setConfig({ ...config, background_color: e.target.value })
                    }
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text-color">Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="text-color"
                    type="color"
                    className="w-12 h-10 p-1 cursor-pointer"
                    value={config.text_color}
                    onChange={(e) =>
                      setConfig({ ...config, text_color: e.target.value })
                    }
                  />
                  <Input
                    value={config.text_color}
                    onChange={(e) =>
                      setConfig({ ...config, text_color: e.target.value })
                    }
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <BagLoader size={16} />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
