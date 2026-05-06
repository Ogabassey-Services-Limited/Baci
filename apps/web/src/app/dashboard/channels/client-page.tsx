'use client';

import {
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Unlink,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import jumiaLogo from '@/assets/jumia-logo.png';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ConnectJumiaDialog } from './connect-jumia-dialog';
import {
  disconnectIntegration,
  syncOrders,
  syncStock,
  useJumiaIntegrations,
} from './use-jumia-integrations';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  no_code: 'Authorization failed — no code received',
  invalid_state: 'Security validation failed — please try again',
  session_expired: 'Session expired — please try again',
  database_error: 'Failed to save connection — please try again',
  connection_failed: 'Connection failed — please try again',
  token_exchange_failed:
    'Jumia rejected the token exchange — check redirect URI and credentials',
  merchant_not_found: 'Merchant account not found — please log in again',
  oauth_not_configured:
    'Jumia OAuth is not configured — please contact support or try again later',
};

function formatLastSync(dateString: string | null) {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString('en-NG', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function ChannelsClientPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const {
    integrations,
    setIntegrations,
    loading,
    error: fetchError,
    refetch,
  } = useJumiaIntegrations();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [stockSyncingIds, setStockSyncingIds] = useState<Set<string>>(
    new Set()
  );
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const handledOauthParamsRef = useRef<string | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const handledKey = success
      ? `success:${success}:${searchParams.get('shops') ?? ''}`
      : error
        ? `error:${error}`
        : null;

    if (!handledKey || handledOauthParamsRef.current === handledKey) {
      return;
    }
    handledOauthParamsRef.current = handledKey;

    if (success === 'jumia_connected') {
      const newShopIds =
        searchParams.get('shops')?.split(',').filter(Boolean) ?? [];
      toast({ title: 'Jumia account connected successfully!' });

      void refetch().then(async (freshIntegrations) => {
        router.replace('/dashboard/channels');

        if (newShopIds.length === 0) return;

        const newOnes = freshIntegrations.filter((i) =>
          newShopIds.includes(i.shop_id)
        );
        if (newOnes.length === 0) return;

        toast({ title: 'Syncing your Jumia orders...' });
        const results = await Promise.all(newOnes.map((i) => syncOrders(i.id)));
        const ok = results.filter((r) => r.ok);
        if (ok.length > 0) {
          toast({ title: ok[0].message || 'Orders synced!' });
          await refetch();
        } else {
          const fail = results.find((r) => !r.ok);
          toast({
            title: 'Order sync failed',
            description: fail?.error || 'Please try again',
            variant: 'destructive',
          });
        }
      });
    } else if (error) {
      toast({
        title: 'Connection Error',
        description: OAUTH_ERROR_MESSAGES[error] || `Error: ${error}`,
        variant: 'destructive',
      });
      router.replace('/dashboard/channels');
    }
  }, [searchParams, refetch, router, toast]);

  const handleDisconnect = async () => {
    if (!disconnectId) return;
    const result = await disconnectIntegration(disconnectId);

    if (result.ok) {
      toast({ title: 'Jumia account disconnected' });
      setIntegrations((prev) => prev.filter((i) => i.id !== disconnectId));
    } else {
      toast({
        title: 'Disconnect failed',
        description: result.error,
        variant: 'destructive',
      });
    }
    setDisconnectId(null);
  };

  const handleSync = async (integrationId: string) => {
    setSyncingIds((prev) => new Set(prev).add(integrationId));
    const result = await syncOrders(integrationId);

    if (result.ok) {
      toast({ title: result.message });
      void refetch();
    } else {
      toast({
        title: 'Sync failed',
        description: result.error,
        variant: 'destructive',
      });
    }

    setSyncingIds((prev) => {
      const next = new Set(prev);
      next.delete(integrationId);
      return next;
    });
  };

  const handleStockSync = async (integrationId: string) => {
    setStockSyncingIds((prev) => new Set(prev).add(integrationId));
    const result = await syncStock(integrationId);

    if (result.ok) {
      toast({ title: result.message });
      void refetch();
    } else {
      toast({
        title: 'Stock sync failed',
        description: result.error,
        variant: 'destructive',
      });
    }

    setStockSyncingIds((prev) => {
      const next = new Set(prev);
      next.delete(integrationId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <BagLoader size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
          Marketplaces
        </h1>
        <p className="text-muted-foreground mt-2">
          Connect marketplaces to sell on multiple platforms from Baci
        </p>
      </div>

      {fetchError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {fetchError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={refetch}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Jumia Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center border overflow-hidden p-1.5">
                <Image
                  src={jumiaLogo}
                  alt="Jumia"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <CardTitle>Jumia</CardTitle>
                <CardDescription>
                  Africa&apos;s largest e-commerce platform
                </CardDescription>
              </div>
            </div>

            {integrations.length === 0 ? (
              <Button onClick={() => setShowConnectModal(true)}>Connect</Button>
            ) : (
              <Badge
                variant="outline"
                className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700"
              >
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>

        {integrations.length > 0 ? (
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              Connected Shops
            </p>

            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex flex-col gap-4 p-4 rounded-lg border bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {integration.shop_name || 'Unnamed Shop'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {integration.country_code || 'NG'} &middot; Last sync:{' '}
                    {formatLastSync(integration.last_sync_at)}
                  </p>
                  {integration.sync_error && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {integration.sync_error}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(integration.id)}
                    disabled={syncingIds.has(integration.id)}
                  >
                    {syncingIds.has(integration.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">
                      {syncingIds.has(integration.id)
                        ? 'Syncing Orders'
                        : 'Sync Orders'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStockSync(integration.id)}
                    disabled={stockSyncingIds.has(integration.id)}
                  >
                    {stockSyncingIds.has(integration.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">
                      {stockSyncingIds.has(integration.id)
                        ? 'Syncing Stock'
                        : 'Sync Stock'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDisconnectId(integration.id)}
                  >
                    <Unlink className="h-4 w-4" />
                    <span>Disconnect Jumia</span>
                    <span className="sr-only">
                      {' '}
                      for {integration.shop_name || 'shop'}
                    </span>
                  </Button>
                </div>
              </div>
            ))}

            {/* Quick Actions */}
            <div className="pt-4 border-t flex gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/dashboard/orders?source=jumia">
                  <Package className="h-4 w-4 mr-2" />
                  View Jumia Orders
                </Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href="https://vendorcenter.jumia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Vendor Center
                </a>
              </Button>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-500" />
                Receive orders in your Baci dashboard
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" />
                Get push notifications for new orders
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-green-500" />
                Manage inventory across platforms
              </li>
            </ul>
          </CardContent>
        )}
      </Card>

      {/* Konga — Coming Soon */}
      <Card className="border-dashed opacity-60">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-white">K</span>
            </div>
            <div>
              <CardTitle>Konga</CardTitle>
              <CardDescription>Coming Soon</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Connect Modal */}
      <ConnectJumiaDialog
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
        onConnected={refetch}
      />

      {/* Disconnect Confirmation */}
      <AlertDialog
        open={disconnectId !== null}
        onOpenChange={(open) => !open && setDisconnectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Jumia Account?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need to reconnect to continue syncing orders from this
              shop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
