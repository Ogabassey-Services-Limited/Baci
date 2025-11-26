'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Product {
    id: string;
    name: string;
    category: string;
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
    onSelectProduct?: (productId: string) => void;
    placeholder?: string;
    className?: string;
}

export function SearchAutocomplete({
    merchantId,
    value,
    onChange,
    onSelectProduct,
    placeholder = 'Search products...',
    className,
}: SearchAutocompleteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch autocomplete suggestions
    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSuggestions([]);
            setPopularSearches([]);
            setIsOpen(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(
                `/api/search/autocomplete?q=${encodeURIComponent(query)}&merchant_id=${merchantId}&limit=10`
            );
            const data = await response.json();

            setSuggestions(data.suggestions || []);
            setPopularSearches(data.popularSearches || []);
            setIsOpen(true);
            setHighlightedIndex(-1);
        } catch (error) {
            console.error('Autocomplete error:', error);
            setSuggestions([]);
            setPopularSearches([]);
        } finally {
            setLoading(false);
        }
    }, [merchantId]);

    // Debounced search
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [value, fetchSuggestions]);

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
                onSelectProduct?.(product.id);
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
            aria-owns={listboxId}
        >
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                    type="search"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => value.length >= 2 && setIsOpen(true)}
                    className="pl-10"
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    aria-activedescendant={highlightedIndex >= 0 ? `search-option-${highlightedIndex}` : undefined}
                    aria-label="Search products"
                />
            </div>

            {/* Screen reader announcement for results */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {isOpen && hasResults && `${resultsCount} ${resultsCount === 1 ? 'result' : 'results'} available`}
                {isOpen && !hasResults && value.length >= 2 && 'No results found'}
            </div>

            {isOpen && hasResults && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label="Search suggestions"
                    className="absolute z-50 mt-2 w-full rounded-md border bg-popover shadow-lg"
                >
                    <div className="max-h-96 overflow-y-auto p-2">
                        {/* Product suggestions */}
                        {suggestions.length > 0 && (
                            <div className="mb-2" role="group" aria-labelledby="products-group-label">
                                <div id="products-group-label" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    Products
                                </div>
                                {suggestions.map((product, index) => (
                                    <button
                                        key={product.id}
                                        id={`search-option-${index}`}
                                        role="option"
                                        aria-selected={highlightedIndex === index}
                                        onClick={() => {
                                            onSelectProduct?.(product.id);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors',
                                            highlightedIndex === index
                                                ? 'bg-accent text-accent-foreground'
                                                : 'hover:bg-accent/50'
                                        )}
                                    >
                                        {product.image_small && (
                                            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                                                <Image
                                                    src={product.image_small}
                                                    alt=""
                                                    fill
                                                    className="object-cover"
                                                    aria-hidden="true"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate font-medium">{product.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {product.category && (
                                                    <span className="rounded bg-muted px-1.5 py-0.5">
                                                        {product.category}
                                                    </span>
                                                )}
                                                <span className="font-semibold">
                                                    <span className="sr-only">Price: </span>₦{product.price.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Popular searches */}
                        {popularSearches.length > 0 && (
                            <div role="group" aria-labelledby="popular-searches-label">
                                <div id="popular-searches-label" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    Popular searches
                                </div>
                                {popularSearches.map((search, index) => {
                                    const optionIndex = suggestions.length + index;
                                    return (
                                        <button
                                            key={search.search_query}
                                            id={`search-option-${optionIndex}`}
                                            role="option"
                                            aria-selected={highlightedIndex === optionIndex}
                                            onClick={() => {
                                                onChange(search.search_query);
                                                setIsOpen(false);
                                            }}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors',
                                                highlightedIndex === optionIndex
                                                    ? 'bg-accent text-accent-foreground'
                                                    : 'hover:bg-accent/50'
                                            )}
                                        >
                                            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                            <span className="flex-1 truncate">{search.search_query}</span>
                                            <span className="text-xs text-muted-foreground">
                                                <span className="sr-only">Searched </span>{search.search_count} <span className="sr-only">times</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {loading && (
                        <div className="border-t p-2 text-center text-xs text-muted-foreground" aria-live="polite">
                            Loading...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
