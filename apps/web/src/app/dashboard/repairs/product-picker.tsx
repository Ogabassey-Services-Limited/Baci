'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type ProductSearchResult,
  searchLinkableProducts,
} from './catalog-api';

/**
 * Search-and-link widget for binding a repair device to a storefront product.
 *
 * Search is debounced client-side; results are rendered as a plain list of
 * buttons so keyboard and screen-reader users can select an item without a
 * combobox implementation.
 */

const SEARCH_DEBOUNCE_MS = 300;

export interface ProductPickerValue {
  id: string;
  name: string;
}

interface ProductPickerProps {
  value: ProductPickerValue | null;
  onChange: (value: ProductPickerValue | null) => void;
}

export default function ProductPicker({ value, onChange }: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      searchLinkableProducts(trimmed)
        .then((rows) => {
          if (cancelled) {
            return;
          }
          setResults(rows);
          setSearched(true);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setError('Could not search products.');
          setResults([]);
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (product: ProductSearchResult) => {
    onChange({ id: product.id, name: product.name });
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span className="truncate">{value.name}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(null)}
        >
          Clear
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        type="search"
        placeholder="Search products to link…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search products"
      />
      {loading ? (
        <div className="space-y-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : searched && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products found.</p>
      ) : results.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => handleSelect(product)}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {product.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
