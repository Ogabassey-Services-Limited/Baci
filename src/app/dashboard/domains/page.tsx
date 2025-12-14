'use client';

import {
  AlertCircle,
  Check,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { setPrimaryDomain } from './actions';

interface Domain {
  id: string;
  domain: string;
  tld: string;
  domain_type: 'subdomain' | 'custom' | 'purchased';
  status: 'pending' | 'verifying' | 'active' | 'failed' | 'expired';
  is_primary: boolean;
  verification_token?: string;
  verified_at: string | null;
  ssl_status: 'pending' | 'active' | 'failed';
  purchase_info?: {
    expires_at?: string;
    auto_renew?: boolean;
    cost_price?: number;
    sell_price?: number;
  };
  created_at: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'custom'>(
    'overview'
  );
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(
    new Set()
  );
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<{
    domain: string;
    token: string;
  } | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);

  // Domain verification retry tracking
  const [lastVerificationAttempt, setLastVerificationAttempt] = useState<
    Record<string, Date>
  >({});
  const [autoRetryDomains, setAutoRetryDomains] = useState<
    Record<
      string,
      {
        retryCount: number;
        nextRetryAt: Date | null;
        intervalId?: NodeJS.Timeout;
      }
    >
  >({});

  // Domain search state
  const [domainSearchTerm, setDomainSearchTerm] = useState('');
  const [searchingDomains, setSearchingDomains] = useState(false);
  const [domainSearchResults, setDomainSearchResults] = useState<
    Array<{
      domain: string;
      tld: string;
      available: boolean;
      price: number;
      renewalPrice: number;
      category: string;
      popular?: boolean;
      recommended?: boolean;
      note?: string;
    }>
  >([]);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null);
  const [domainToPurchase, setDomainToPurchase] = useState<{
    domain: string;
    price: number;
  } | null>(null);

  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard.`,
    });
  };

  // Open purchase confirmation dialog
  const handlePurchaseDomain = (domain: string, price: number) => {
    setDomainToPurchase({ domain, price });
  };

  // Execute the actual purchase after confirmation
  const confirmPurchase = async () => {
    if (!domainToPurchase) return;

    const { domain } = domainToPurchase;
    setDomainToPurchase(null);
    setPurchasingDomain(domain);

    try {
      const response = await fetch('/api/domains/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, years: 1 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      toast({
        title: '🎉 Domain Purchased!',
        description: data.message || `Successfully registered ${domain}`,
      });

      // Refresh domains list
      fetchDomains();

      // Clear search results
      setDomainSearchResults([]);
      setDomainSearchTerm('');

      // Switch to overview tab
      setActiveTab('overview');
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: 'Purchase Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Please try again or contact support',
        variant: 'destructive',
      });
    } finally {
      setPurchasingDomain(null);
    }
  };

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/domains');
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch domains',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const getStatusBadge = (status: Domain['status']) => {
    const variants: Record<
      Domain['status'],
      {
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
        label: string;
        icon: React.ComponentType<{ className?: string }>;
      }
    > = {
      active: { variant: 'default', label: 'Active', icon: Check },
      pending: { variant: 'secondary', label: 'Pending', icon: Clock },
      verifying: { variant: 'secondary', label: 'Verifying', icon: Clock },
      failed: { variant: 'destructive', label: 'Failed', icon: AlertCircle },
      expired: { variant: 'destructive', label: 'Expired', icon: AlertCircle },
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: Domain['domain_type']) => {
    const labels = {
      subdomain: 'Free Subdomain',
      custom: 'Custom Domain',
      purchased: 'Purchased',
    };
    return <Badge variant="outline">{labels[type]}</Badge>;
  };

  // Auto-retry verification with exponential backoff
  const RETRY_INTERVALS = [30000, 60000, 120000, 240000]; // 30s, 1min, 2min, 4min
  const MAX_RETRIES = 4;

  const startAutoRetry = useCallback(
    (domain: Domain) => {
      const domainName = domain.domain;
      const currentRetry = autoRetryDomains[domainName]?.retryCount || 0;

      if (currentRetry >= MAX_RETRIES) {
        toast({
          title: 'Auto-retry stopped',
          description: `Maximum retries reached for ${domainName}. Please verify DNS and try manually.`,
          variant: 'destructive',
        });
        setAutoRetryDomains((prev) => {
          const { [domainName]: _, ...rest } = prev;
          return rest;
        });
        return;
      }

      const delay =
        RETRY_INTERVALS[currentRetry] ||
        RETRY_INTERVALS[RETRY_INTERVALS.length - 1];
      const nextRetryAt = new Date(Date.now() + delay);

      toast({
        title: '🔄 Auto-retry enabled',
        description: `Will automatically check ${domainName} again in ${delay / 1000} seconds.`,
      });

      const intervalId = setTimeout(async () => {
        // Attempt verification
        try {
          const response = await fetch(`/api/domains/${domainName}/verify`, {
            method: 'POST',
          });
          const data = await response.json();

          if (response.ok && data.success) {
            toast({
              title: '🎉 Domain Verified!',
              description: `${domainName} has been automatically verified and is now active.`,
            });
            setAutoRetryDomains((prev) => {
              const { [domainName]: _, ...rest } = prev;
              return rest;
            });
            fetchDomains();
          } else {
            // Not verified, schedule next retry
            setAutoRetryDomains((prev) => ({
              ...prev,
              [domainName]: {
                retryCount: (prev[domainName]?.retryCount || 0) + 1,
                nextRetryAt: null,
                intervalId: undefined,
              },
            }));
            // Recursively start next retry
            startAutoRetry(domain);
          }
        } catch (error) {
          console.error('Auto-retry error:', error);
        }

        setLastVerificationAttempt((prev) => ({
          ...prev,
          [domainName]: new Date(),
        }));
      }, delay);

      setAutoRetryDomains((prev) => ({
        ...prev,
        [domainName]: {
          retryCount: currentRetry,
          nextRetryAt,
          intervalId,
        },
      }));
    },
    [autoRetryDomains, fetchDomains, toast]
  );

  const stopAutoRetry = useCallback(
    (domainName: string) => {
      const retryInfo = autoRetryDomains[domainName];
      if (retryInfo?.intervalId) {
        clearTimeout(retryInfo.intervalId);
      }
      setAutoRetryDomains((prev) => {
        const { [domainName]: _, ...rest } = prev;
        return rest;
      });
      toast({
        title: 'Auto-retry stopped',
        description: `Automatic verification for ${domainName} has been disabled.`,
      });
    },
    [autoRetryDomains, toast]
  );

  const handleVerifyDomain = async (domain: Domain) => {
    setVerifyingDomains((prev) => new Set(prev).add(domain.domain));

    try {
      const response = await fetch(`/api/domains/${domain.domain}/verify`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Domain Verified! ✅',
          description: `${domain.domain} has been verified and is now active.`,
        });
        // Refresh domains list
        fetchDomains();
      } else {
        toast({
          title: 'Verification Failed',
          description:
            data.error ||
            'Could not verify domain. Please check your DNS records.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast({
        title: 'Verification Error',
        description:
          'An error occurred while verifying the domain. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setVerifyingDomains((prev) => {
        const next = new Set(prev);
        next.delete(domain.domain);
        return next;
      });
      // Track when we last attempted verification
      setLastVerificationAttempt((prev) => ({
        ...prev,
        [domain.domain]: new Date(),
      }));
    }
  };

  const handleDeleteDomain = async () => {
    if (!domainToDelete) return;

    try {
      const response = await fetch(`/api/domains/${domainToDelete.domain}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Domain Deleted',
          description: 'The domain has been successfully removed.',
        });
        fetchDomains();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete domain',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while deleting the domain',
        variant: 'destructive',
      });
    } finally {
      setDomainToDelete(null);
    }
  };

  const handleDomainSearch = async () => {
    const searchTerm = domainSearchTerm.trim().toLowerCase();

    if (!searchTerm) {
      toast({
        title: 'Enter a domain name',
        description: 'Please enter a domain name to search.',
        variant: 'destructive',
      });
      return;
    }

    // Validate search term
    // Allow dots for full domains like "claire.com", but reject if just a TLD like ".com"
    if (searchTerm.startsWith('.')) {
      toast({
        title: 'Invalid format',
        description:
          'Please enter a domain name (e.g., "mystore" or "mystore.com")',
        variant: 'destructive',
      });
      return;
    }

    // Extract domain name part (before first dot) for validation
    const domainPart = searchTerm.split('.')[0];
    const domainRegex = /^[a-z0-9-]+$/i;
    if (!domainRegex.test(domainPart)) {
      toast({
        title: 'Invalid domain name',
        description:
          'Domain names can only contain letters, numbers, and hyphens.',
        variant: 'destructive',
      });
      return;
    }

    setSearchingDomains(true);
    setDomainSearchResults([]);
    setSearchWarning(null);

    try {
      const response = await fetch('/api/domains/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to search domains');
      }

      const data = await response.json();
      setDomainSearchResults(data.results || []);
      if (data.warning) {
        setSearchWarning(data.warning);
      }
    } catch (error) {
      console.error('Domain search error:', error);
      toast({
        title: 'Search failed',
        description:
          error instanceof Error ? error.message : 'Failed to search domains',
        variant: 'destructive',
      });
    } finally {
      setSearchingDomains(false);
    }
  };

  const handleAddCustomDomain = async () => {
    if (!customDomainInput.trim()) {
      toast({
        title: 'Invalid Domain',
        description: 'Please enter a valid domain name.',
        variant: 'destructive',
      });
      return;
    }

    setAddingDomain(true);

    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: customDomainInput.trim().toLowerCase(),
          isPrimary: domains.length === 0, // Make primary if it's the first custom domain
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Domain Added! 🎉',
          description:
            'Your custom domain has been added. Please verify ownership.',
        });

        // Store verification info to show instructions
        setVerificationInfo({
          domain: data.domain.domain,
          token: data.verification.value,
        });

        // Refresh domains list
        fetchDomains();

        // Clear input
        setCustomDomainInput('');

        // Don't auto-switch tab, let user see verification info
        // setTimeout(() => {
        //   setActiveTab('overview');
        // }, 3000);
      } else {
        toast({
          title: 'Failed to Add Domain',
          description: data.error || 'Could not add domain. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while adding the domain.',
        variant: 'destructive',
      });
    } finally {
      setAddingDomain(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header with subtle gradient background */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900/50 dark:via-slate-800/30 dark:to-slate-900/50 border p-6 shadow-sm">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-xl" />

        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
              <Globe className="w-8 h-8 text-primary" />
              Domains
            </h1>
            <p className="text-muted-foreground">
              Manage your store domains and custom URLs
            </p>
          </div>
          <Button
            onClick={() => setActiveTab('custom')}
            className="shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary to-purple-600 hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Domain
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'overview' | 'search')}
      >
        <TabsList className="bg-slate-100/80 dark:bg-slate-800/50 p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"
          >
            <Globe className="w-4 h-4 mr-2" />
            My Domains
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"
          >
            <Search className="w-4 h-4 mr-2" />
            Search & Buy
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect Existing Domain
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {loading ? (
            <Card className="border-2 border-dashed">
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center animate-pulse">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    Loading your domains...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : domains.length === 0 ? (
            <Card className="relative overflow-hidden border-2 border-dashed hover:border-primary/50 transition-colors">
              {/* Decorative background pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl" />

              <CardContent className="relative p-12 text-center space-y-6">
                {/* Animated globe icon */}
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full animate-pulse" />
                  <div className="absolute inset-2 bg-background rounded-full flex items-center justify-center shadow-inner">
                    <Globe className="w-10 h-10 text-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    No domains yet
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Connect your custom domain or get a free subdomain to make
                    your store accessible to customers
                  </p>
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                  <Button
                    onClick={() => setActiveTab('search')}
                    className="shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search & Buy Domain
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('custom')}
                    className="shadow-sm hover:shadow-md transition-shadow"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Connect Existing Domain
                  </Button>
                </div>

                {/* Feature highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t">
                  <div className="text-center p-3">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-sm font-medium">Free SSL</p>
                    <p className="text-xs text-muted-foreground">
                      Auto-provisioned
                    </p>
                  </div>
                  <div className="text-center p-3">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium">Free Subdomain</p>
                    <p className="text-xs text-muted-foreground">
                      yourstore.usebaci.com
                    </p>
                  </div>
                  <div className="text-center p-3">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-sm font-medium">Custom Domain</p>
                    <p className="text-xs text-muted-foreground">
                      yourbrand.com
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <Card
                  key={domain.id}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg border-2 ${
                    domain.status === 'active'
                      ? 'border-green-200 dark:border-green-800 hover:border-green-300'
                      : domain.status === 'failed'
                        ? 'border-red-200 dark:border-red-800'
                        : 'border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {/* Status indicator bar at top */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      domain.status === 'active'
                        ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                        : domain.status === 'failed'
                          ? 'bg-gradient-to-r from-red-400 to-rose-500'
                          : 'bg-gradient-to-r from-amber-400 to-yellow-500'
                    }`}
                  />

                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-4">
                        {/* Domain Icon with status-based styling */}
                        <div
                          className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center shadow-sm ${
                            domain.status === 'active'
                              ? 'bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20'
                              : domain.status === 'failed'
                                ? 'bg-gradient-to-br from-red-100 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20'
                                : 'bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/20'
                          }`}
                        >
                          <Globe
                            className={`w-7 h-7 ${
                              domain.status === 'active'
                                ? 'text-green-600 dark:text-green-400'
                                : domain.status === 'failed'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }`}
                          />
                        </div>

                        <div>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <span className="font-semibold">
                              {domain.domain}
                            </span>
                            {domain.is_primary && (
                              <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                                ⭐ Primary
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-2">
                            {getTypeBadge(domain.domain_type)}
                            {getStatusBadge(domain.status)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!domain.is_primary && domain.status === 'active' && (
                          <Button
                            variant="default"
                            size="sm"
                            className="shadow-sm hover:shadow-md transition-shadow bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={async () => {
                              try {
                                const result = await setPrimaryDomain(
                                  domain.domain
                                );
                                if (!result.success) {
                                  throw new Error(result.error);
                                }
                                toast({
                                  title: 'Success',
                                  description: 'Domain set as primary',
                                });
                                // No need to reload, revalidatePath handles it
                              } catch (error) {
                                toast({
                                  title: 'Error',
                                  description:
                                    error instanceof Error
                                      ? error.message
                                      : 'Failed to set primary domain',
                                  variant: 'destructive',
                                });
                              }
                            }}
                          >
                            <span className="mr-2">⭐</span> Make Primary
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="shadow-sm hover:shadow-md transition-shadow"
                          onClick={() => {
                            window.location.href = `/dashboard/domains/${domain.domain}`;
                          }}
                        >
                          Manage
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shadow-sm hover:shadow-md transition-shadow"
                          onClick={() =>
                            window.open(`https://${domain.domain}`, '_blank')
                          }
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Visit
                        </Button>
                        {domain.domain_type !== 'subdomain' && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-9 w-9 shadow-sm"
                            onClick={() => setDomainToDelete(domain)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {/* Info Grid with visual cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* SSL Status Card */}
                      <div
                        className={`p-4 rounded-lg border ${
                          domain.ssl_status === 'active'
                            ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                            : domain.ssl_status === 'failed'
                              ? 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                              : 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              domain.ssl_status === 'active'
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : domain.ssl_status === 'failed'
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : 'bg-amber-100 dark:bg-amber-900/30'
                            }`}
                          >
                            {domain.ssl_status === 'active' ? (
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : domain.ssl_status === 'failed' ? (
                              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium">
                              SSL Certificate
                            </p>
                            <p
                              className={`font-semibold ${
                                domain.ssl_status === 'active'
                                  ? 'text-green-700 dark:text-green-400'
                                  : domain.ssl_status === 'failed'
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {domain.ssl_status === 'active'
                                ? '🔒 Secured'
                                : domain.ssl_status === 'failed'
                                  ? '⚠️ Failed'
                                  : '⏳ Provisioning...'}
                            </p>
                          </div>
                        </div>
                        {domain.ssl_status === 'failed' && (
                          <p className="text-xs text-red-600 mt-2">
                            Check DNS configuration
                          </p>
                        )}
                      </div>

                      {/* Domain Type / Expires Card */}
                      <div className="p-4 rounded-lg border bg-slate-50/50 border-slate-200 dark:bg-slate-900/10 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium">
                              {domain.purchase_info?.expires_at
                                ? 'Expires'
                                : 'Type'}
                            </p>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              {domain.purchase_info?.expires_at
                                ? new Date(
                                    domain.purchase_info.expires_at
                                  ).toLocaleDateString()
                                : domain.domain_type === 'subdomain'
                                  ? '🆓 Free Subdomain'
                                  : domain.domain_type === 'custom'
                                    ? '🔗 Custom Domain'
                                    : '💳 Purchased'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {domain.status === 'pending' &&
                      domain.domain_type === 'custom' && (
                        <div className="space-y-6 pt-2">
                          <Alert className="border-amber-200 bg-amber-50/50">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-900">
                              <strong>Connect Your Domain</strong>
                              <p className="text-sm mt-1">
                                To activate <strong>{domain.domain}</strong>,
                                please configure your DNS records below.
                              </p>
                            </AlertDescription>
                          </Alert>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">
                                Step 1: Add DNS Records
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Log in to your domain provider (GoDaddy,
                                Namecheap, etc.) and add these DNS records:
                              </p>
                            </div>

                            {/* A Record */}
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px]">
                                  Required
                                </span>
                                For your root domain ({domain.domain})
                              </h5>
                              <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                                <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Type
                                  </span>
                                  <code className="text-sm font-mono bg-background px-2 py-1 rounded border w-fit">
                                    A
                                  </code>
                                  <div />
                                </div>
                                <div className="h-[1px] bg-border/50" />
                                <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Name
                                  </span>
                                  <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                                    @
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      copyToClipboard('@', 'Host Name')
                                    }
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="h-[1px] bg-border/50" />
                                <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Value
                                  </span>
                                  <code className="text-2xl font-mono bg-background px-3 py-2 rounded border text-primary font-bold">
                                    76.76.21.21
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      copyToClipboard(
                                        '76.76.21.21',
                                        'IP Address'
                                      )
                                    }
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-2 items-start text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <p>
                                  <strong>Important:</strong> If you already
                                  have an A record for @, you must{' '}
                                  <strong>delete or edit it</strong> to match
                                  this value. Do not keep multiple A records.
                                </p>
                              </div>
                            </div>

                            {/* CNAME Record */}
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[10px]">
                                  Optional
                                </span>
                                For www.{domain.domain}
                              </h5>
                              <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                                <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Type
                                  </span>
                                  <code className="text-sm font-mono bg-background px-2 py-1 rounded border w-fit">
                                    CNAME
                                  </code>
                                  <div />
                                </div>
                                <div className="h-[1px] bg-border/50" />
                                <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Name
                                  </span>
                                  <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                                    www
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      copyToClipboard('www', 'Host Name')
                                    }
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="h-[1px] bg-border/50" />
                                <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Value
                                  </span>
                                  <code className="text-sm font-mono bg-background px-2 py-1 rounded border break-all">
                                    cname.vercel-dns.com
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      copyToClipboard(
                                        'cname.vercel-dns.com',
                                        'CNAME Value'
                                      )
                                    }
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-2 items-start text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
                                <p>
                                  Delete any existing CNAME record for "www"
                                  before adding this one.
                                </p>
                              </div>
                            </div>

                            {/* TXT Ownership Verification Record (Only if Vercel requires it) */}
                            {domain.verification_token?.startsWith(
                              'vc-domain-verify='
                            ) && (
                              <div className="space-y-3">
                                <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                  <span className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded text-[10px]">
                                    Required
                                  </span>
                                  Ownership Verification
                                </h5>
                                <Alert
                                  variant="destructive"
                                  className="border-red-200 bg-red-50/50"
                                >
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription className="text-red-900 text-sm">
                                    <strong>Additional Step Required:</strong>{' '}
                                    This domain was previously used on another
                                    Vercel project. You must add this TXT record
                                    to prove ownership.
                                  </AlertDescription>
                                </Alert>
                                <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                                  <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                                      Type
                                    </span>
                                    <code className="text-sm font-mono bg-background px-2 py-1 rounded border w-fit">
                                      TXT
                                    </code>
                                    <div />
                                  </div>
                                  <div className="h-[1px] bg-border/50" />
                                  <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                                      Name
                                    </span>
                                    <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                                      _vercel
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        copyToClipboard('_vercel', 'Host Name')
                                      }
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="h-[1px] bg-border/50" />
                                  <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                                      Value
                                    </span>
                                    <code className="text-xs font-mono bg-background px-2 py-1.5 rounded border break-all">
                                      {domain.verification_token}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        copyToClipboard(
                                          domain.verification_token || '',
                                          'TXT Value'
                                        )
                                      }
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <Button
                                size="sm"
                                onClick={() => handleVerifyDomain(domain)}
                                disabled={verifyingDomains.has(domain.domain)}
                                className="w-full sm:w-auto"
                              >
                                {verifyingDomains.has(domain.domain) ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 motion-safe:animate-spin" />
                                    Verifying...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    I've Added the Records, Verify Now
                                  </>
                                )}
                              </Button>
                              {lastVerificationAttempt[domain.domain] && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Last checked:{' '}
                                  {new Date(
                                    lastVerificationAttempt[domain.domain]
                                  ).toLocaleTimeString()}
                                </span>
                              )}
                            </div>

                            {/* Auto-retry controls */}
                            <div className="flex items-center gap-3">
                              {autoRetryDomains[domain.domain] ? (
                                <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>
                                    Auto-retry enabled (attempt{' '}
                                    {autoRetryDomains[domain.domain]
                                      .retryCount + 1}
                                    /4)
                                    {autoRetryDomains[domain.domain]
                                      .nextRetryAt && (
                                      <>
                                        {' '}
                                        • Next check at{' '}
                                        {autoRetryDomains[
                                          domain.domain
                                        ].nextRetryAt?.toLocaleTimeString()}
                                      </>
                                    )}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-blue-700 hover:text-blue-900"
                                    onClick={() => stopAutoRetry(domain.domain)}
                                  >
                                    Stop
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => startAutoRetry(domain)}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  Enable Auto-Retry
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* DNS Propagation Note */}
                          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 space-y-1">
                            <p className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              <strong>Propagation Time:</strong> DNS changes can
                              take 1-48 hours to propagate globally.
                            </p>
                            <p>
                              If verification fails, wait a few minutes and try
                              again. Most changes propagate within 5 minutes.
                            </p>
                          </div>

                          {/* Cloudflare Tip */}
                          <div className="text-xs text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-1">
                            <p className="flex items-center gap-1.5">
                              <Globe className="w-3 h-3" />
                              <strong>Using Cloudflare?</strong>
                            </p>
                            <p>
                              Set the A and CNAME records to{' '}
                              <strong>DNS only</strong> (grey cloud icon), not
                              "Proxied" (orange cloud). Vercel handles SSL and
                              caching automatically.
                            </p>
                          </div>

                          {/* Email/MX Record Warning */}
                          <Alert
                            variant="destructive"
                            className="border-red-200 bg-red-50/50"
                          >
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-red-900 text-xs">
                              <strong>⚠️ Protect Your Email:</strong> Do NOT
                              delete MX, SPF, or DKIM records. These are for
                              your email (e.g., Zoho, Google Workspace). Only
                              modify A and CNAME records as instructed above.
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}

                    {domain.status === 'active' && domain.verified_at && (
                      <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-800 dark:text-green-300">
                          Domain verified on{' '}
                          {new Date(domain.verified_at).toLocaleDateString()}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Search for a Domain</CardTitle>
              <CardDescription>
                Find and purchase the perfect domain for your store
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter domain name (e.g., mystore)"
                    className="flex-1"
                    value={domainSearchTerm}
                    onChange={(e) => setDomainSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleDomainSearch();
                      }
                    }}
                    disabled={searchingDomains}
                  />
                  <Button
                    onClick={handleDomainSearch}
                    disabled={searchingDomains}
                  >
                    {searchingDomains ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    {searchingDomains ? 'Searching...' : 'Search'}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Popular TLDs: .com.ng (₦8,399/yr), .com (₦19,499/yr), .store
                  (₦60,000/yr)
                </p>

                {searchWarning && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{searchWarning}</AlertDescription>
                  </Alert>
                )}

                {domainSearchResults.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Available Domains</h3>
                    <div className="grid gap-3">
                      {domainSearchResults.map((result) => (
                        <div
                          key={result.domain}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            result.available
                              ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
                              : 'border-gray-200 bg-gray-50/50 dark:bg-slate-900/10 dark:border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {result.domain}
                                {result.popular && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Popular
                                  </Badge>
                                )}
                                {result.recommended && (
                                  <Badge className="text-xs bg-green-600">
                                    Recommended
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {result.available
                                  ? 'Available'
                                  : 'Not Available'}
                                {result.note && ` • ${result.note}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-semibold">
                                ₦{result.price.toLocaleString()}/yr
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Renewal: ₦{result.renewalPrice.toLocaleString()}
                                /yr
                              </div>
                            </div>
                            {result.available && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  handlePurchaseDomain(
                                    result.domain,
                                    result.price
                                  )
                                }
                                disabled={purchasingDomain === result.domain}
                              >
                                {purchasingDomain === result.domain ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    Buying...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4 mr-1" />
                                    Buy
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Domain Tab */}
        <TabsContent value="custom">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Connect Existing Domain</CardTitle>
              <CardDescription>
                Use a domain you already own (e.g., from GoDaddy, Namecheap)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {!verificationInfo ? (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="custom-domain-input"
                        className="text-sm font-medium"
                      >
                        Enter your domain name
                      </label>
                      <Input
                        id="custom-domain-input"
                        placeholder="example.com"
                        className="mt-2"
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCustomDomain();
                          }
                        }}
                        disabled={addingDomain}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Don't include "http://" or "www."
                      </p>
                    </div>

                    <Button
                      onClick={handleAddCustomDomain}
                      disabled={addingDomain}
                      className="w-full"
                    >
                      {addingDomain ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 motion-safe:animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Continue'
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Alert className="border-amber-200 bg-amber-50/50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-900">
                        <strong>Connect Your Domain</strong>
                        <p className="text-sm mt-1">
                          When you connect your domain to your store, visitors
                          will be directed to your Baci storefront.
                        </p>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">
                          Step 1: Add DNS Records
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Log in to your domain provider (GoDaddy, Namecheap,
                          etc.) and add these DNS records:
                        </p>
                      </div>

                      {/* A Record Section */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                          <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px]">
                            Required
                          </span>
                          For your root domain ({verificationInfo.domain})
                        </h5>
                        <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                          <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Type
                            </span>
                            <code className="text-sm font-mono bg-background px-2 py-1 rounded border w-fit">
                              A
                            </code>
                            <div />
                          </div>
                          <div className="h-[1px] bg-border/50" />
                          <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Name
                            </span>
                            <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                              @
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard('@', 'Host Name')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="h-[1px] bg-border/50" />
                          <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Value
                            </span>
                            <code className="text-2xl font-mono bg-background px-3 py-2 rounded border text-primary font-bold">
                              76.76.21.21
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                copyToClipboard('76.76.21.21', 'IP Address')
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 items-start text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <p>
                            <strong>Important:</strong> If you already have an A
                            record for @, you must{' '}
                            <strong>delete or edit it</strong> to match this
                            value. Do not keep multiple A records.
                          </p>
                        </div>
                      </div>

                      {/* CNAME Record Section */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                          <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[10px]">
                            Optional
                          </span>
                          For www.{verificationInfo.domain}
                        </h5>
                        <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                          <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Type
                            </span>
                            <code className="text-sm font-mono bg-background px-2 py-1 rounded border w-fit">
                              CNAME
                            </code>
                            <div />
                          </div>
                          <div className="h-[1px] bg-border/50" />
                          <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Name
                            </span>
                            <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                              www
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                copyToClipboard('www', 'Host Name')
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="h-[1px] bg-border/50" />
                          <div className="grid grid-cols-[60px_1fr_40px] gap-2 items-center">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Value
                            </span>
                            <code className="text-sm font-mono bg-background px-2 py-1 rounded border break-all">
                              cname.vercel-dns.com
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                copyToClipboard(
                                  'cname.vercel-dns.com',
                                  'CNAME Value'
                                )
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Delete any existing CNAME record for "www" before
                          adding this one.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <Button
                        onClick={() =>
                          handleVerifyDomain({
                            domain: verificationInfo.domain,
                          } as Domain)
                        }
                      >
                        I've Added the Records, Verify Now
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setVerificationInfo(null);
                          setCustomDomainInput('');
                          setActiveTab('overview');
                        }}
                      >
                        Do this later
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={!!domainToDelete}
        onOpenChange={(open) => !open && setDomainToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the
              domain
              <strong> {domainToDelete?.domain} </strong> from your store.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteDomain}
            >
              Delete Domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog
        open={!!domainToPurchase}
        onOpenChange={(open) => !open && setDomainToPurchase(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Domain Purchase</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to purchase{' '}
                <strong className="text-foreground">
                  {domainToPurchase?.domain}
                </strong>
              </p>
              <p className="text-lg font-semibold text-foreground">
                ₦{domainToPurchase?.price.toLocaleString()}/year
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This amount will be deducted from your wallet. The domain will
                be registered and active immediately.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPurchase}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm Purchase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
