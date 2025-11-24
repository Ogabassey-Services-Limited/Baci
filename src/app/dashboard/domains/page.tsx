'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, Search, Plus, Check, AlertCircle, Clock, ExternalLink, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Domain {
  id: string;
  domain: string;
  tld: string;
  domain_type: 'subdomain' | 'custom' | 'purchased';
  status: 'pending' | 'verifying' | 'active' | 'failed' | 'expired';
  is_primary: boolean;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'custom'>('overview');
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(new Set());
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<{
    domain: string;
    token: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/domains');
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Domain['status']) => {
    const variants: Record<Domain['status'], { variant: any; label: string; icon: any }> = {
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
          description: data.error || 'Could not verify domain. Please check your DNS records.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast({
        title: 'Verification Error',
        description: 'An error occurred while verifying the domain. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setVerifyingDomains((prev) => {
        const next = new Set(prev);
        next.delete(domain.domain);
        return next;
      });
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
          description: 'Your custom domain has been added. Please verify ownership.',
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

        // Switch to overview tab after a moment
        setTimeout(() => {
          setActiveTab('overview');
        }, 3000);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Domains</h1>
          <p className="text-muted-foreground">Manage your store domains and custom URLs</p>
        </div>
        <Button onClick={() => setActiveTab('search')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Domain
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="overview">
            <Globe className="w-4 h-4 mr-2" />
            My Domains
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="w-4 h-4 mr-2" />
            Search & Buy
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Domain
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading domains...
              </CardContent>
            </Card>
          ) : domains.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center space-y-4">
                <Globe className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">No domains yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by searching for a domain or adding your own
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => setActiveTab('search')}>Search Domains</Button>
                    <Button variant="outline" onClick={() => setActiveTab('custom')}>
                      Add Custom Domain
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <Card key={domain.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {domain.domain}
                          {domain.is_primary && (
                            <Badge variant="secondary">Primary</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-2">
                          {getTypeBadge(domain.domain_type)}
                          {getStatusBadge(domain.status)}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.location.href = `/dashboard/domains/${domain.domain}`}>
                          Manage
                        </Button>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Visit
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">SSL Status:</span>
                        <Badge variant={domain.ssl_status === 'active' ? 'default' : 'secondary'} className="ml-2">
                          {domain.ssl_status}
                        </Badge>
                      </div>
                      {domain.purchase_info?.expires_at && (
                        <div>
                          <span className="text-muted-foreground">Expires:</span>
                          <span className="ml-2 font-medium">
                            {new Date(domain.purchase_info.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {domain.status === 'pending' && domain.domain_type === 'custom' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                          <span>
                            Domain verification pending. Please add the required DNS records.
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleVerifyDomain(domain)}
                            disabled={verifyingDomains.has(domain.domain)}
                            className="ml-4"
                          >
                            {verifyingDomains.has(domain.domain) ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Verify Now
                              </>
                            )}
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                    {domain.status === 'active' && domain.verified_at && (
                      <Alert className="border-green-200 bg-green-50">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          Domain verified on {new Date(domain.verified_at).toLocaleDateString()}
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
          <Card>
            <CardHeader>
              <CardTitle>Search for a Domain</CardTitle>
              <CardDescription>
                Find and purchase the perfect domain for your store
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter domain name (e.g., mystore)"
                    className="flex-1"
                  />
                  <Button>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Popular TLDs: .com.ng (₦8,399/yr), .com (₦19,499/yr), .store (₦60,000/yr)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Domain Tab */}
        <TabsContent value="custom">
          <Card>
            <CardHeader>
              <CardTitle>Add Your Own Domain</CardTitle>
              <CardDescription>
                Connect a domain you already own to your Baci store
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Domain Name</label>
                  <Input
                    placeholder="yourdomain.com"
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
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You'll need to add DNS records to verify domain ownership
                  </AlertDescription>
                </Alert>

                {verificationInfo && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-900">
                      <div className="space-y-2">
                        <p className="font-semibold">DNS Verification Required</p>
                        <p className="text-sm">Add this TXT record to your DNS:</p>
                        <div className="bg-white p-3 rounded border mt-2 font-mono text-xs">
                          <div><strong>Type:</strong> TXT</div>
                          <div><strong>Name:</strong> _baci-verification.{verificationInfo.domain}</div>
                          <div><strong>Value:</strong> {verificationInfo.token}</div>
                        </div>
                        <p className="text-sm mt-2">
                          DNS propagation can take up to 48 hours. You can verify once the record is added.
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Button onClick={handleAddCustomDomain} disabled={addingDomain}>
                  {addingDomain ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Domain'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
