import { ArrowLeft, Building2, Mail, Smartphone, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAdminMerchantUserDirectory } from '@/lib/admin-merchant-users';
import { createClient } from '@/lib/supabase/server';
import { adminMerchantRouteParamsSchema } from '@/schemas/admin-merchant-route-params';
import { MerchantUserRows } from './merchant-user-rows';

type MerchantUsersPageProps = {
  params: Promise<{
    merchantId: string;
  }>;
};

const merchantEmailSchema = z.string().email();

function getMailtoHref(email: string | null): string | null {
  const result = merchantEmailSchema.safeParse(email);
  if (!result.success) {
    return null;
  }

  return `mailto:${result.data}`;
}

export default async function MerchantUsersPage({
  params,
}: MerchantUsersPageProps) {
  const parseResult = adminMerchantRouteParamsSchema.safeParse(await params);
  if (!parseResult.success) {
    notFound();
  }

  const { merchantId } = parseResult.data;
  const supabase = await createClient();
  const { data, error } = await getAdminMerchantUserDirectory(
    supabase,
    merchantId
  );

  if (error) {
    console.error('[Admin] Failed to load merchant users:', {
      error: error.message,
      merchantId,
    });
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Merchant users could not load</CardTitle>
          <CardDescription>Merchant ID: {merchantId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The user directory is temporarily unavailable. Go back to the
            merchant list and try again.
          </p>
          <Button asChild variant="outline">
            <Link href="/admin/merchants">Back to merchants</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    notFound();
  }

  const merchantName = data.merchant.businessName ?? 'Unnamed merchant';
  const merchantMailtoHref = getMailtoHref(data.merchant.email);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/admin/merchants">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Merchants
            </Link>
          </Button>
          <div>
            <h1 className="text-page-title">{merchantName}</h1>
            <p className="text-muted-foreground">
              Users and app access registered to this merchant.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {merchantMailtoHref ? (
            <Button asChild variant="outline" size="sm">
              <a href={merchantMailtoHref}>
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                Email owner
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card role="group" aria-label="Web users summary">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" aria-hidden="true" />
            <div>
              <p className="text-stat">{data.summary.webUsers}</p>
              <p className="text-xs text-muted-foreground">Web users</p>
            </div>
          </CardContent>
        </Card>
        <Card role="group" aria-label="Staff users summary">
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="h-8 w-8 text-primary" aria-hidden="true" />
            <div>
              <p className="text-stat">{data.summary.staffUsers}</p>
              <p className="text-xs text-muted-foreground">Staff users</p>
            </div>
          </CardContent>
        </Card>
        <Card role="group" aria-label="Admin app installations summary">
          <CardContent className="flex items-center gap-3 p-4">
            <Smartphone className="h-8 w-8 text-primary" aria-hidden="true" />
            <div>
              <p className="text-stat">
                {data.summary.activeAdminAppInstallations}
              </p>
              <p className="text-xs text-muted-foreground">
                Admin app installs
              </p>
            </div>
          </CardContent>
        </Card>
        <Card role="group" aria-label="Storefront app installations summary">
          <CardContent className="flex items-center gap-3 p-4">
            <Smartphone className="h-8 w-8 text-primary" aria-hidden="true" />
            <div>
              <p className="text-stat">
                {data.summary.activeStorefrontAppInstallations}
              </p>
              <p className="text-xs text-muted-foreground">
                Storefront app installs
              </p>
            </div>
          </CardContent>
        </Card>
        <Card role="group" aria-label="App-only users summary">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" aria-hidden="true" />
            <div>
              <p className="text-stat">{data.summary.unmatchedAppUsers}</p>
              <p className="text-xs text-muted-foreground">App-only users</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card role="group" aria-label="Owner users">
        <CardHeader>
          <CardTitle>Owner</CardTitle>
          <CardDescription>
            {data.merchant.email ?? 'No email on file'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantUserRows
            emptyLabel="No owner user found"
            users={data.users.owner ? [data.users.owner] : []}
          />
        </CardContent>
      </Card>

      <Card role="group" aria-label="Staff users directory">
        <CardHeader>
          <CardTitle>Staff</CardTitle>
          <CardDescription>
            Merchant dashboard and mobile admin app access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantUserRows
            emptyLabel="No staff users yet"
            users={data.users.staff}
          />
        </CardContent>
      </Card>

      <Card role="group" aria-label="Customer users directory">
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            Storefront web accounts and customer app access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantUserRows
            emptyLabel="No customer users yet"
            users={data.users.customers}
          />
        </CardContent>
      </Card>

      <Card role="group" aria-label="App-only users directory">
        <CardHeader>
          <CardTitle>App-only users</CardTitle>
          <CardDescription>
            App registrations that are not yet matched to owner, staff, or
            customer records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantUserRows
            emptyLabel="No app-only users found"
            users={data.users.unmatchedAppUsers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
