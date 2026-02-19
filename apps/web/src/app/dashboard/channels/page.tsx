'use client';

/**
 * Marketplace Channels Page
 * Connect and manage marketplace integrations (Jumia, Konga, etc.)
 */

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildCsrfHeaders } from '@/lib/csrf';

interface JumiaIntegration {
  id: string;
  shop_id: string;
  shop_name: string;
  country_code: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

export default function ChannelsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<JumiaIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [refreshToken, setRefreshToken] = useState('');
  const [shopName, setShopName] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/marketplace/jumia/connect');
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check for success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (success === 'jumia_connected') {
      setMessage({
        type: 'success',
        text: 'Jumia account connected successfully!',
      });
      setShowConnectModal(false);
      fetchIntegrations();
      router.replace('/dashboard/channels');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_code: 'Authorization failed - no code received',
        invalid_state: 'Security validation failed - please try again',
        session_expired: 'Session expired - please try again',
        database_error: 'Failed to save connection - please try again',
        connection_failed: 'Connection failed - please try again',
      };
      setMessage({
        type: 'error',
        text:
          errorMessages[error] ||
          (errorDescription
            ? `Error: ${decodeURIComponent(errorDescription)}`
            : `Error: ${error}`),
      });
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler auto-memoizes fetchIntegrations
  }, [searchParams, fetchIntegrations, router]);

  useEffect(() => {
    fetchIntegrations();
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler auto-memoizes fetchIntegrations
  }, [fetchIntegrations]);

  const handleConnect = async () => {
    if (!refreshToken.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter your Jumia refresh token',
      });
      return;
    }

    setConnecting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/marketplace/jumia/connect', {
        method: 'POST',
        headers: buildCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          connectionType: 'self_authorization',
          refreshToken: refreshToken.trim(),
          shopName: shopName.trim() || 'My Jumia Shop',
          countryCode: 'NG',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Jumia account connected successfully!',
        });
        setShowConnectModal(false);
        setRefreshToken('');
        setShopName('');
        fetchIntegrations();
      } else {
        setMessage({ type: 'error', text: data.error || 'Connection failed' });
      }
    } catch (_error) {
      setMessage({
        type: 'error',
        text: 'Connection failed - please try again',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this Jumia account?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/marketplace/jumia/connect?id=${integrationId}`,
        {
          method: 'DELETE',
          headers: buildCsrfHeaders(),
        }
      );

      if (response.ok) {
        setMessage({ type: 'success', text: 'Jumia account disconnected' });
        // Optimistically remove from UI
        setIntegrations((prev) => prev.filter((i) => i.id !== integrationId));
        // Background refresh
        fetchIntegrations();
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    }
  };

  const handleSyncOrders = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/marketplace/jumia/orders', {
        method: 'POST',
        headers: buildCsrfHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `Synced ${data.synced} orders (${data.newOrders} new)`,
        });
        fetchIntegrations();
      } else {
        const fullError = data.details
          ? `${data.error}\nDetails: ${data.details}`
          : data.error || 'Sync failed';
        setMessage({ type: 'error', text: fullError });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Sync failed - please try again' });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-NG', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Sales Channels
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Connect marketplaces to sell on multiple platforms from Baci
        </p>
      </header>

      {/* Messages */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {message.text}
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Jumia Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-100 overflow-hidden relative p-2 shadow-sm">
                <Image
                  src="/images/jumia-logo.png"
                  alt="Jumia Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Jumia
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Africa&apos;s largest e-commerce platform
                </p>
              </div>
            </div>

            {integrations.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Connect
              </button>
            ) : (
              <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
                Connected
              </span>
            )}
          </div>
        </div>

        {/* Connected Shops */}
        {integrations.length > 0 && (
          <div className="p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
              Connected Shops
            </h3>

            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {integration.shop_name || 'Unnamed Shop'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {integration.country_code || 'NG'} • Last sync:{' '}
                      {formatDate(integration.last_sync_at)}
                    </p>
                    {integration.sync_error && (
                      <p className="text-sm text-red-500 mt-1">
                        ⚠️ {integration.sync_error}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSyncOrders}
                      disabled={syncing}
                      className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg hover:bg-orange-200 disabled:opacity-50"
                    >
                      {syncing ? 'Syncing...' : 'Sync Orders'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(integration.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Links */}
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Quick Actions
              </h3>
              <div className="flex gap-3">
                <Link
                  href="/dashboard/orders?source=jumia"
                  className="flex-1 px-4 py-3 text-center bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  📦 View Jumia Orders
                </Link>
                <a
                  href="https://vendorcenter.jumia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-3 text-center bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  🔗 Jumia Vendor Center
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && integrations.length === 0 && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p className="mb-2">Connect your Jumia Vendor Center account to:</p>
            <ul className="text-sm space-y-1">
              <li>✅ Receive orders in your Baci dashboard</li>
              <li>✅ Get push notifications for new orders</li>
              <li>✅ Manage inventory across platforms</li>
            </ul>
          </div>
        )}
      </div>

      {/* Coming Soon - Konga */}
      <div className="mt-6 bg-gray-100 dark:bg-gray-800/50 rounded-xl p-6 opacity-75">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-2xl font-bold text-white">K</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
              Konga
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Coming Soon
            </p>
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-800 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Connect Jumia Account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Option 1: OAuth (Recommended) */}
            <div className="p-4 border border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-900/30 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-xl">🚀</span> Fast Connection
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Log in to your Jumia Vendor Center account to connect
                automatically.
              </p>
              <a
                href="/api/marketplace/jumia/connect?connectionType=oauth"
                className="block w-full py-2.5 bg-[#f68b1e] text-white text-center rounded-lg font-medium hover:bg-[#e07e1b] transition-colors"
              >
                Connect with Jumia
              </a>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">
                  Or connect manually
                </span>
              </div>
            </div>

            {/* Option 2: Manual Token */}
            <div>
              <button
                type="button"
                onClick={() => setShowManualForm(!showManualForm)}
                className="w-full py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                {showManualForm
                  ? 'Hide Manual Entry'
                  : 'Enter Refresh Token Manually'}
              </button>

              {showManualForm && (
                <div className="mt-4 space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-400">
                    Go to <strong>Settings → Applications</strong> in Jumia
                    Seller Center, create a &quot;Self Authorization&quot; app,
                    and copy the token.
                  </div>

                  <div>
                    <label
                      htmlFor="shopName"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Shop Name (optional)
                    </label>
                    <input
                      id="shopName"
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="My Jumia Shop"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-shadow"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="refreshToken"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Refresh Token *
                    </label>
                    <textarea
                      id="refreshToken"
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      placeholder="Paste your token..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-shadow"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting || !refreshToken.trim()}
                    className="w-full py-2 bg-gray-900 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {connecting ? 'Connecting...' : 'Connect Token'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
