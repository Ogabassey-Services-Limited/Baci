'use client';

import { ArrowLeft, Bell, Save } from 'lucide-react';
import Link from 'next/link';
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
import { useToast } from '@/hooks/use-toast';
import type {
  NotificationPreferences,
  UpdatePreferencesInput,
} from '@/types/notifications';

export default function NotificationPreferencesPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/notifications/preferences');
        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }
        const data = await response.json();
        setPreferences(data);
      } catch (error) {
        console.error('Error fetching preferences:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notification preferences',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, [toast]);

  const updatePreference = (updates: UpdatePreferencesInput) => {
    if (!preferences) return;
    setPreferences({ ...preferences, ...updates });
  };

  const handleSave = async () => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          in_app_enabled: preferences.in_app_enabled,
          banner_enabled: preferences.banner_enabled,
          quiet_hours_start: preferences.quiet_hours_start,
          quiet_hours_end: preferences.quiet_hours_end,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Saved',
        description: 'Your notification preferences have been updated',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <BagLoader size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/notifications">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Notification Preferences
          </h1>
          <p className="text-muted-foreground">
            Manage how you receive notifications
          </p>
        </div>
      </div>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in_app">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications in the notification center
              </p>
            </div>
            <Switch
              id="in_app"
              checked={preferences?.in_app_enabled ?? true}
              onCheckedChange={(checked) =>
                updatePreference({ in_app_enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="banner">Banner Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show important notifications as banners at the top of the
                dashboard
              </p>
            </div>
            <Switch
              id="banner"
              checked={preferences?.banner_enabled ?? true}
              onCheckedChange={(checked) =>
                updatePreference({ banner_enabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>
            Set times when you don't want to receive notification alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quiet_start">Start Time</Label>
              <Input
                id="quiet_start"
                type="time"
                value={preferences?.quiet_hours_start || ''}
                onChange={(e) =>
                  updatePreference({
                    quiet_hours_start: e.target.value || null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet_end">End Time</Label>
              <Input
                id="quiet_end"
                type="time"
                value={preferences?.quiet_hours_end || ''}
                onChange={(e) =>
                  updatePreference({ quiet_hours_end: e.target.value || null })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            During quiet hours, notifications will still be delivered but won't
            show alerts.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <BagLoader size={16} />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
