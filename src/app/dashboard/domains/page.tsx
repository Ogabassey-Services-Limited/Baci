'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, Search, Plus, Check, AlertCircle, Clock, ExternalLink } from 'lucide-react';

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

                    {domain.status === 'pending' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Domain verification pending. Please add the required DNS records.
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
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You'll need to add DNS records to verify domain ownership
                  </AlertDescription>
                </Alert>

                <Button>Add Domain</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
