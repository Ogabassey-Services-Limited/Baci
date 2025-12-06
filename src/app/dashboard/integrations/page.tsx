'use client';

import { ArrowRight, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

const integrations = [
  {
    id: 'google-merchant',
    name: 'Google Merchant Center',
    description:
      'Sync your products to Google Shopping and run product ads across Google Search.',
    href: '/dashboard/integrations/google-merchant',
    icon: (
      <Image
        src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png"
        alt="Google"
        width={40}
        height={40}
        className="h-10 w-10"
      />
    ),
    color: 'bg-white',
  },
  {
    id: 'facebook',
    name: 'Facebook & Instagram',
    description:
      'Sell products directly on Facebook Shops and Instagram Shopping.',
    href: '/dashboard/integrations/facebook',
    icon: (
      <svg
        className="h-10 w-10 text-blue-600"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    color: 'bg-blue-50',
  },
  {
    id: 'tiktok',
    name: 'TikTok Shopping',
    description:
      'Showcase products in videos and run shoppable ads to reach younger audiences.',
    href: '/dashboard/integrations/tiktok',
    icon: (
      <svg
        className="h-10 w-10"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
          fill="currentColor"
        />
      </svg>
    ),
    color: 'bg-gray-50',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    description:
      'Reach the Snapchat generation with dynamic product ads and tracking.',
    href: '/dashboard/integrations/snapchat',
    icon: (
      <svg
        className="h-10 w-10 text-yellow-500"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.003 1.936c-2.096 0-3.905 1.144-4.629 2.651-.233.456-.252.887-.061 1.285.125.267.314.391.734.426.687.058 1.109.281 1.259.664.129.351-.048.835-.615 1.706-.523.79-.806 1.455-.806 1.889 0 .809.529 1.419 1.478 1.693.303.09.554.128.567.242.023.238-.636.526-1.579.69-.64.113-2.094.204-2.83.69-.327.217-.5.53-.5.908 0 .578.432 1.05.972 1.267.399.16.988.225 1.898.242.176.002.324.018.441.045.541.139.734.404.598.812-.08.232-.375.361-1.002.438-1.57.195-2.222.455-2.222 1.044 0 .428.324.78.966 1.05.655.275 2.126.541 4.298.541 2.227 0 3.737-.28 4.402-.562.632-.266.953-.615.953-1.029 0-.578-.621-.839-2.086-1.044-.093-.014-.15-.028-.184-.044-.543-.105-.826-.237-.899-.415-.145-.353.076-.621.611-.796.11-.035.244-.055.405-.055.903 0 1.488-.068 1.884-.23.538-.215.968-.691.968-1.267 0-.374-.17-.688-.492-.904-.733-.487-2.18-.58-2.818-.692-.953-.162-1.613-.45-1.588-.689.012-.112.258-.152.559-.241.956-.275 1.489-.884 1.489-1.693 0-.435-.285-1.096-.807-1.89-.567-.869-.743-1.354-.613-1.705.148-.383.57-.606 1.258-.664.417-.035.606-.159.73-.424.195-.403.176-.832-.057-1.288-.724-1.507-2.531-2.651-4.63-2.651z" />
      </svg>
    ),
    color: 'bg-yellow-50',
  },
  {
    id: 'twitter',
    name: 'Twitter (X)',
    description: 'Track conversions and optimize ads with the X Pixel.',
    href: '/dashboard/integrations/twitter',
    icon: (
      <svg
        className="h-10 w-10 text-black dark:text-white"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    color: 'bg-slate-50',
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics 4',
    description:
      'Track website traffic and user behavior with the latest Google Analytics.',
    href: '/dashboard/integrations/google-analytics',
    icon: (
      <Image
        src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg"
        alt="GA4"
        width={40}
        height={40}
        className="h-10 w-10"
      />
    ),
    color: 'bg-orange-50',
  },
];

export default function IntegrationsPage() {
  const { merchant } = useMerchant();

  if (!merchant) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
          Integrations
        </h1>
        <p className="text-muted-foreground mt-2">
          Connect your store to external platforms and services
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card
            key={integration.id}
            className="glass hover:shadow-lg transition-shadow group"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div
                  className={`p-3 rounded-lg ${integration.color} flex items-center justify-center`}
                >
                  {integration.icon}
                </div>
              </div>
              <CardTitle className="mt-4">{integration.name}</CardTitle>
              <CardDescription>{integration.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full group-hover:bg-primary/90">
                <Link href={asRoute(integration.href)}>
                  Configure
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">More Coming Soon</h3>
          <p className="text-muted-foreground text-center max-w-md">
            We're working on integrations with more platforms including Amazon,
            Jumia, and Konga. Stay tuned for updates!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
