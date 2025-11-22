'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, ShoppingCart, Check, AlertCircle, Loader2 } from 'lucide-react';

interface DomainResult {
  domain: string;
  tld: string;
  available: boolean;
  price: number;
  originalPrice: number;
  renewalPrice: number;
  category: 'nigerian' | 'global' | 'premium';
  popular?: boolean;
  recommended?: boolean;
  note?: string;
}

export function DomainSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<DomainResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a domain name');
      return;
    }

    // Validate search term
    const searchRegex = /^[a-z0-9-]+$/i;
    if (!searchRegex.test(searchTerm)) {
      setError('Domain name can only contain letters, numbers, and hyphens');
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);
    setResults([]);

    try {
      const response = await fetch('/api/domains/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm: searchTerm.toLowerCase() }),
      });

      if (!response.ok) {
        throw new Error('Failed to check domain availability');
      }

      const data = await response.json();
      setResults(data.results || []);

      if (data.warning) {
        setWarning(data.warning);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (domain: string) => {
    // TODO: Implement purchase flow with payment
    alert(`Purchase flow for ${domain} - Coming soon!`);
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      nigerian: 'bg-green-100 text-green-800',
      global: 'bg-blue-100 text-blue-800',
      premium: 'bg-purple-100 text-purple-800',
    };
    return (
      <Badge className={colors[category as keyof typeof colors] || ''}>
        {category}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search for a Domain</CardTitle>
          <CardDescription>
            Find the perfect domain for your store. All prices shown are per year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter domain name (e.g., mystore)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              disabled={loading}
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {warning && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Popular Nigerian domains:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">.com.ng - ₦8,399/yr</Badge>
              <Badge variant="outline">.ng - ₦21,840/yr</Badge>
              <Badge variant="outline">.name.ng - ₦700/yr (Cheapest!)</Badge>
            </div>
            <p className="font-medium mt-2">Global domains:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">.com - ₦19,499/yr</Badge>
              <Badge variant="outline">.store - ₦60,000/yr</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">
            Search Results for "{searchTerm}"
          </h3>

          {/* Recommended domains first */}
          {results.filter(r => r.recommended).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Recommended</h4>
              {results.filter(r => r.recommended).map((result) => (
                <DomainResultCard
                  key={result.domain}
                  result={result}
                  onPurchase={handlePurchase}
                />
              ))}
            </div>
          )}

          {/* Popular domains */}
          {results.filter(r => r.popular && !r.recommended).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Popular</h4>
              {results.filter(r => r.popular && !r.recommended).map((result) => (
                <DomainResultCard
                  key={result.domain}
                  result={result}
                  onPurchase={handlePurchase}
                />
              ))}
            </div>
          )}

          {/* Other domains */}
          {results.filter(r => !r.popular && !r.recommended).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">More options</h4>
              {results.filter(r => !r.popular && !r.recommended).map((result) => (
                <DomainResultCard
                  key={result.domain}
                  result={result}
                  onPurchase={handlePurchase}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DomainResultCard({
  result,
  onPurchase,
}: {
  result: DomainResult;
  onPurchase: (domain: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-lg">{result.domain}</h4>
              {result.recommended && <Badge>Recommended</Badge>}
              {result.popular && !result.recommended && (
                <Badge variant="secondary">Popular</Badge>
              )}
              {result.available && (
                <Badge variant="outline" className="text-green-600">
                  <Check className="w-3 h-3 mr-1" />
                  Available
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {getCategoryBadge(result.category)}
              <span className="text-sm text-muted-foreground">
                Renewal: ₦{result.renewalPrice.toLocaleString()}/yr
              </span>
            </div>
            {result.note && (
              <p className="text-xs text-muted-foreground mt-1">{result.note}</p>
            )}
          </div>
          <div className="text-right space-y-2">
            <div>
              <div className="text-2xl font-bold">
                ₦{result.price.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">per year</div>
            </div>
            <Button
              size="sm"
              onClick={() => onPurchase(result.domain)}
              disabled={!result.available}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Buy Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
