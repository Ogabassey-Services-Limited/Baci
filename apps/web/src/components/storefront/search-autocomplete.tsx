'use client';

import { Search, TrendingUp, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { trackEvent } from '@/lib/event-tracking';
import { getProductUrl } from '@/lib/seo-utils';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  slug?: string;
  category?: string; // Backward compatibility (TEXT column - deprecated)
  category_id?: string; // FK to categories table
  categories?: {
    id: string;
    name: string;
    slug?: string;
  }; // Joined category object
  condition?: 'new' | 'used' | string;
  condition_detail?: string;
  price: number;
  image_small: string;
}

interface PopularSearch {
  search_query: string;
  search_count: number;
}

interface SearchAutocompleteProps {
  merchantId: string;
  value: string;
  onChange: (value: string) => void;
  onSelectProduct?: (url: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function SearchAutocomplete({
  merchantId,
  value,
  onChange,
  onSelectProduct,
  placeholder = 'Search products...',
  className,
  id = 'search-input',
  name = 'q',
}: SearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search with autocomplete suggestions
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.length < 2) {
      setSuggestions([]);
      setPopularSearches([]);
      setIsOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search/autocomplete?q=${encodeURIComponent(value)}&merchant_id=${merchantId}&limit=10`
        );
        const data = await response.json();

        setSuggestions(data.suggestions || []);
        setPopularSearches(data.popularSearches || []);
        setIsOpen(true);
        setHighlightedIndex(-1);

        // Track search event for merchant analytics
        const resultsCount =
          (data.suggestions?.length || 0) + (data.popularSearches?.length || 0);
        trackEvent.search(merchantId, value, resultsCount);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
        setPopularSearches([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value, merchantId]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + popularSearches.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      if (highlightedIndex < suggestions.length) {
        const product = suggestions[highlightedIndex];
        onSelectProduct?.(getProductUrl(product));
        setIsOpen(false);
      } else {
        const searchIndex = highlightedIndex - suggestions.length;
        const search = popularSearches[searchIndex];
        onChange(search.search_query);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const hasResults = suggestions.length > 0 || popularSearches.length > 0;
  const listboxId = `search-listbox-${merchantId}`;
  const resultsCount = suggestions.length + popularSearches.length;

  return (
    <div
      ref={wrapperRef}
      className={cn('relative w-full', className)}
      role="combobox"
      aria-expanded={isOpen && hasResults}
      aria-haspopup="listbox"
      aria-controls={listboxId}
      aria-owns={listboxId}
      tabIndex={-1}
    >
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && setIsOpen(true)}
          className={cn(
            'pl-10 [&::-webkit-search-cancel-button]:appearance-none',
            value ? 'pr-10' : ''
          )}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            highlightedIndex >= 0
              ? `search-option-${highlightedIndex}`
              : undefined
          }
          aria-label="Search products"
          id={id}
          name={name}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              setSuggestions([]);
              setPopularSearches([]);
              inputRef.current?.focus();
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm z-20 h-8 w-8 flex items-center justify-center"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Screen reader announcement for results */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isOpen &&
          hasResults &&
          `${resultsCount} ${resultsCount === 1 ? 'result' : 'results'} available`}
        {isOpen && !hasResults && value.length >= 2 && 'No results found'}
      </div>

      {isOpen && hasResults && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute z-50 mt-2 w-full rounded-xl border border-gray-100 shadow-2xl bg-white text-gray-900 overflow-hidden ring-1 ring-black/5"
        >
          <div className="max-h-[400px] overflow-y-auto py-2">
            {/* Product suggestions */}
            {suggestions.length > 0 && (
              // biome-ignore lint/a11y/useSemanticElements: role="group" is correct for listbox groups
              <div
                className="mb-2"
                role="group"
                aria-labelledby="products-group-label"
              >
                <div
                  id="products-group-label"
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400"
                >
                  Products
                </div>
                {suggestions.map((product, index) => (
                  <button
                    type="button"
                    key={product.id}
                    id={`search-option-${index}`}
                    role="option"
                    aria-selected={highlightedIndex === index}
                    onClick={() => {
                      onSelectProduct?.(getProductUrl(product));
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                      highlightedIndex === index
                        ? 'bg-red-50/80 text-gray-900'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    {product.image_small ? (
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-100 border border-gray-100">
                        <Image
                          src={product.image_small}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          aria-hidden="true"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-gray-400">
                        <Search size={16} />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate font-semibold text-sm text-gray-900">
                        {product.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {(product.categories?.name || product.category) && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            {product.categories?.name || product.category}
                          </span>
                        )}
                        <span className="font-bold text-red-600">
                          <span className="sr-only">Price: </span>₦
                          {product.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Popular searches */}
            {popularSearches.length > 0 && (
              // biome-ignore lint/a11y/useSemanticElements: role="group" is correct for listbox groups
              <div role="group" aria-labelledby="popular-searches-label">
                <div
                  id="popular-searches-label"
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-t border-gray-50 mt-2"
                >
                  Popular searches
                </div>
                {popularSearches.map((search, index) => {
                  const optionIndex = suggestions.length + index;
                  return (
                    <button
                      type="button"
                      key={search.search_query}
                      id={`search-option-${optionIndex}`}
                      role="option"
                      aria-selected={highlightedIndex === optionIndex}
                      onClick={() => {
                        onChange(search.search_query);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                        highlightedIndex === optionIndex
                          ? 'bg-red-50/80 text-gray-900'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex bg-gray-100 rounded-full p-1.5 text-gray-500">
                        <TrendingUp
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="flex-1 truncate text-sm font-medium text-gray-700">
                        {search.search_query}
                      </span>
                      {search.search_count > 10 && (
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                          Trending
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loading && (
            <div
              className="border-t border-gray-100 bg-gray-50 p-2 text-center text-xs font-medium text-gray-500"
              aria-live="polite"
            >
              Searching...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
