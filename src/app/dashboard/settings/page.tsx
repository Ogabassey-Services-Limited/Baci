import { ChevronRight, CreditCard, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/app/dashboard/settings/components/settings-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Settings | Baci',
  description: "Manage your store's branding, features, and configuration.",
};

export default async function SettingsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  // Fetch feature settings server-side
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: featureSettings, error: featureError } = await supabase
    .from('merchant_feature_settings')
    .select('blog_enabled')
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  if (featureError) {
    console.error('Failed to fetch feature settings:', featureError);
  }

  const blogEnabled = featureSettings?.blog_enabled ?? false;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
          Settings ⚙️
        </h1>
      </div>

      {/* Main Settings Form (Branding, Features, Favicon, Hero, Social) */}
      <SettingsForm
        initialMerchant={merchant}
        initialBlogEnabled={blogEnabled}
      />

      {/* Navigation Cards for Sub-Settings */}
      <div className="grid gap-6">
        {/* Payment Settings Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Settings
            </CardTitle>
            <CardDescription>
              Configure payment gateways, bank settlement, and transaction
              preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full justify-between"
              asChild
            >
              <Link href="/dashboard/settings/payments">
                <span>Manage Payment Settings</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Team Management Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Management
            </CardTitle>
            <CardDescription>
              Invite team members to help manage your store with role-based
              permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full justify-between"
              asChild
            >
              <Link href="/dashboard/settings/team">
                <span>Manage Team Members</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Support & Legal */}
        <div className="mt-8 pt-8 border-t">
          <h2 className="text-lg font-semibold mb-4">Support & Legal</h2>
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">We value your privacy</h3>
              <p className="text-sm text-muted-foreground">
                Data usage policies and terms of service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
