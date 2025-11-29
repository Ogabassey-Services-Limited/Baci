'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MoreHorizontal,
  ExternalLink,
  Mail,
  RefreshCw,
  Building2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/seo-utils';

interface MerchantHealth {
  merchant_id: string;
  business_name: string;
  email: string;
  joined_at: string;
  total_gmv: number;
  total_orders: number;
  last_order_date: string | null;
  active_days: number;
  health_status: 'healthy' | 'at_risk' | 'churned' | 'new';
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getHealthBadge(status: string) {
  switch (status) {
    case 'healthy':
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Healthy
        </Badge>
      );
    case 'at_risk':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <AlertTriangle className="h-3 w-3 mr-1" />
          At Risk
        </Badge>
      );
    case 'churned':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Churned
        </Badge>
      );
    case 'new':
      return (
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
          <Clock className="h-3 w-3 mr-1" />
          New
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'gmv' | 'orders' | 'joined'>('gmv');
  const { toast } = useToast();

  const fetchMerchants = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('merchant_health')
        .select('*')
        .order(sortBy === 'gmv' ? 'total_gmv' : sortBy === 'orders' ? 'total_orders' : 'joined_at', {
          ascending: sortBy === 'joined',
        });

      if (error) throw error;
      setMerchants(data || []);
    } catch (error) {
      console.error('Failed to fetch merchants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load merchant data. The analytics views may not be set up yet.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  // Filter merchants
  const filteredMerchants = useMemo(() => merchants.filter((merchant) => {
    const matchesSearch =
      merchant.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesHealth = healthFilter === 'all' || merchant.health_status === healthFilter;
    return matchesSearch && matchesHealth;
  }), [merchants, searchQuery, healthFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: merchants.length,
    healthy: merchants.filter((m) => m.health_status === 'healthy').length,
    atRisk: merchants.filter((m) => m.health_status === 'at_risk').length,
    churned: merchants.filter((m) => m.health_status === 'churned').length,
    new: merchants.filter((m) => m.health_status === 'new').length,
    totalGmv: merchants.reduce((sum, m) => sum + (Number(m.total_gmv) || 0), 0),
  }), [merchants]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-page-title">Merchants</h1>
          <p className="text-muted-foreground">
            View and manage all merchants on your platform.
          </p>
        </div>
        <Button variant="outline" onClick={fetchMerchants} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'motion-safe:animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-stat">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Merchants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-stat">{stats.healthy}</p>
                <p className="text-xs text-muted-foreground">Healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-stat">{stats.atRisk}</p>
                <p className="text-xs text-muted-foreground">At Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-stat">{stats.churned}</p>
                <p className="text-xs text-muted-foreground">Churned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-indigo-500" />
              <div>
                <p className="text-stat">{stats.new}</p>
                <p className="text-xs text-muted-foreground">New (No Sales)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search merchants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Health Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmv">Highest GMV</SelectItem>
                  <SelectItem value="orders">Most Orders</SelectItem>
                  <SelectItem value="joined">Recently Joined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No merchants found</p>
              <p className="text-sm">
                {searchQuery || healthFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Merchants will appear here once they sign up'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="text-right">Total GMV</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMerchants.map((merchant) => (
                    <TableRow key={merchant.merchant_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{merchant.business_name || 'Unnamed Store'}</p>
                          <p className="text-sm text-muted-foreground">{merchant.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getHealthBadge(merchant.health_status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(merchant.total_gmv) || 0)}
                      </TableCell>
                      <TableCell className="text-right">{merchant.total_orders || 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(merchant.last_order_date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(merchant.joined_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => window.open(`mailto:${merchant.email}`, '_blank')}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const slug = generateSlug(merchant.business_name || '');
                                if (slug) {
                                  window.open(`/s/${slug}`, '_blank');
                                } else {
                                  toast({
                                    title: 'Error',
                                    description: 'Could not generate a valid storefront URL.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Store
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Footer */}
      {!loading && filteredMerchants.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {filteredMerchants.length} of {merchants.length} merchants
          </p>
          <p>
            Combined GMV: <span className="font-medium text-foreground">{formatCurrency(stats.totalGmv)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
