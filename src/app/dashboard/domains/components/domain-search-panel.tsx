'use client';

import { Loader2, Search, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { CachedMerchant } from '@/lib/cached-data';

interface SearchResult {
  domain: string;
  tld: string;
  available: boolean;
  price: number;
  renewalPrice: number;
  category: string;
  popular?: boolean;
  recommended?: boolean;
  note?: string;
}

interface DomainSearchPanelProps {
  merchant: CachedMerchant;
}

export function DomainSearchPanel({ merchant }: DomainSearchPanelProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null);
  const [domainToPurchase, setDomainToPurchase] = useState<{
    domain: string;
    price: number;
  } | null>(null);

  const handleSearch = async () => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      toast({
        title: 'Enter a domain name',
        description: 'Please enter a domain name to search.',
        variant: 'destructive',
      });
      return;
    }

    if (term.startsWith('.')) {
      toast({
        title: 'Invalid format',
        description:
          'Please enter a domain name (e.g., "mystore" or "mystore.com")',
        variant: 'destructive',
      });
      return;
    }

    const domainPart = term.split('.')[0];
    // RFC 1123 compliant: must start and end with alphanumeric, can have hyphens in middle
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
    if (!domainRegex.test(domainPart)) {
      toast({
        title: 'Invalid domain name',
        description:
          'Domain names must start and end with a letter or number, and can contain hyphens in the middle.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSearchWarning(null);

    try {
      const response = await fetch('/api/domains/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm: term }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to search domains');
      }

      const data = await response.json();
      setResults(data.results || []);
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
      setIsSearching(false);
    }
  };

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

      // Check response.ok before calling .json() to handle non-JSON error responses
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purchase failed');
      }

      const data = await response.json();

      toast({
        title: '🎉 Domain Purchased!',
        description: data.message || `Successfully registered ${domain}`,
      });

      // Clear search and refresh data
      setResults([]);
      setSearchTerm('');
      router.refresh(); // Refresh page to show new domain
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

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search for a domain (e.g. mystore.com)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Search'
          )}
        </Button>
      </div>

      {searchWarning && (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-200 p-3 rounded-md text-sm">
          ⚠️ {searchWarning}
        </div>
      )}

      <div className="space-y-3">
        {results.map((result) => (
          <Card key={result.domain} className="overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{result.domain}</span>
                  {result.available ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
                    >
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Unavailable</Badge>
                  )}
                  {result.popular && (
                    <Badge
                      variant="default"
                      className="bg-purple-500 hover:bg-purple-600"
                    >
                      Popular
                    </Badge>
                  )}
                </div>
                {result.note && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.note}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold text-lg">
                    {result.price > 0 ? (
                      `${merchant?.payout_currency || '₦'}${result.price.toLocaleString()}`
                    ) : (
                      <span className="text-green-600">Free</span>
                    )}
                  </div>
                  {result.renewalPrice > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Renews at ₦{result.renewalPrice.toLocaleString()}/yr
                    </div>
                  )}
                </div>

                {result.available && (
                  <Button
                    onClick={() =>
                      setDomainToPurchase({
                        domain: result.domain,
                        price: result.price,
                      })
                    }
                    disabled={!!purchasingDomain}
                  >
                    {purchasingDomain === result.domain ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={!!domainToPurchase}
        onOpenChange={(open) => !open && setDomainToPurchase(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to purchase{' '}
              <span className="font-semibold text-foreground">
                {domainToPurchase?.domain}
              </span>{' '}
              for{' '}
              <span className="font-semibold text-foreground">
                {domainToPurchase && domainToPurchase.price > 0
                  ? `₦${domainToPurchase.price.toLocaleString()}`
                  : 'Free'}
              </span>
              ?
              <br />
              <br />
              This will be charged to your wallet. You cannot undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPurchase}>
              Confirm Purchase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
