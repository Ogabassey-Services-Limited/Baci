import { ArrowRight, Megaphone, TicketPercent } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getMerchantForUser } from '@/lib/merchant-server';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Marketing | Baci',
  description:
    'Reach more customers and track them efficiently across social platforms.',
};

const marketingSections = [
  {
    id: 'discount-codes',
    title: 'Discount Codes',
    description:
      'Create promotional codes, set limits, and track active customer incentives.',
    href: routes.dashboardDiscountCodes,
    icon: TicketPercent,
  },
  {
    id: 'social-platforms',
    title: 'Social Platforms',
    description:
      'Connect sales channels and tracking pixels for Google, Meta, TikTok, and more.',
    href: routes.dashboardIntegrations,
    icon: Megaphone,
  },
];

export default async function MarketingPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return redirect(routes.login);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="bg-linear-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-3xl font-bold text-transparent">
          Marketing
        </h1>
        <p className="mt-2 text-muted-foreground">
          Reach more customers and track them efficiently across social
          platforms.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {marketingSections.map((section) => {
          const Icon = section.icon;

          return (
            <Card
              key={section.id}
              className="group bg-card transition-shadow hover:border-primary/50 hover:shadow-lg"
            >
              <CardHeader>
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={section.href}>
                    Open {section.title}
                    <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
