'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { SearchAutocompleteProps } from '@/components/storefront/search-autocomplete';

type SearchAutocompleteComponent = React.ComponentType<SearchAutocompleteProps>;

let searchAutocompleteLoader: Promise<SearchAutocompleteComponent> | null = null;

function loadSearchAutocomplete() {
  if (!searchAutocompleteLoader) {
    searchAutocompleteLoader = import('@/components/storefront/search-autocomplete').then(
      (mod) => mod.SearchAutocomplete
    );
  }

  return searchAutocompleteLoader;
}

interface NavbarSearchProps {
  basePath: string;
  isBlogPage: boolean;
  merchantId?: string;
}

const SEARCH_INPUT_CLASS_NAME =
  '[&_input]:h-11 md:[&_input]:h-12 [&_input]:bg-white [&_input]:rounded-md [&_input]:border-0 [&_input]:text-gray-800 [&_input]:placeholder-gray-500 [&_input]:text-[15px] [&_input]:focus:ring-2 [&_input]:focus:ring-primary/50';

export function NavbarSearch({
  basePath,
  isBlogPage,
  merchantId,
}: NavbarSearchProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [SearchAutocompleteComponent, setSearchAutocompleteComponent] =
    useState<SearchAutocompleteComponent | null>(null);
  const [shouldAutoFocusAutocomplete, setShouldAutoFocusAutocomplete] =
    useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (!merchantId) {
    return null;
  }

  const pushSearchRoute = (query: string) => {
    const trimmedQuery = query.trim().slice(0, 100);
    if (!trimmedQuery) {
      return;
    }

    if (isBlogPage) {
      router.push(
        `${basePath}/blog?search=${encodeURIComponent(trimmedQuery)}` as `/${string}`
      );
      return;
    }

    router.push(
      `${basePath}/search?q=${encodeURIComponent(trimmedQuery)}` as `/${string}`
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushSearchRoute(searchQuery);
  };

  const handleProductSelect = (url: string) => {
    const isValidRelativePath =
      url.startsWith('/') &&
      !url.startsWith('//') &&
      !url.includes('\\') &&
      !/^https?:\/\//i.test(url);

    if (!isValidRelativePath) {
      console.warn('Invalid product URL rejected:', url);
      return;
    }

    const fullUrl = basePath ? `${basePath}${url}` : url;
    router.push(fullUrl as `/${string}`);
  };

  const activateAutocomplete = (focusAutocomplete = false) => {
    if (focusAutocomplete) {
      setShouldAutoFocusAutocomplete(true);
    }

    if (SearchAutocompleteComponent || isBlogPage) {
      return;
    }

    void loadSearchAutocomplete().then((component) => {
      if (!isMountedRef.current) {
        return;
      }

      setSearchAutocompleteComponent(() => component);
    });
  };

  if (isBlogPage) {
    return (
      <form onSubmit={handleSubmit} className="relative">
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search blog posts..."
          maxLength={100}
          aria-label="Search blog posts"
          id="blog-search-input"
          name="search"
          className="w-full h-11 md:h-12 bg-white rounded-md border-0 text-gray-800 placeholder-gray-500 text-[15px] focus:ring-2 focus:ring-primary/50 pl-10 pr-4"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      </form>
    );
  }

  if (SearchAutocompleteComponent) {
    return (
      <SearchAutocompleteComponent
        merchantId={merchantId}
        value={searchQuery}
        onChange={setSearchQuery}
        onSelectProduct={handleProductSelect}
        placeholder="Search products, brands and categories"
        className={SEARCH_INPUT_CLASS_NAME}
        autoFocus={shouldAutoFocusAutocomplete}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input
        type="search"
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          activateAutocomplete(false);
        }}
        onFocus={() => activateAutocomplete(true)}
        onPointerDown={() => activateAutocomplete(false)}
        placeholder="Search products, brands and categories"
        maxLength={100}
        aria-label="Search products"
        id="search-input"
        name="q"
        className="w-full h-11 md:h-12 bg-white rounded-md border-0 text-gray-800 placeholder-gray-500 text-[15px] focus:ring-2 focus:ring-primary/50 pl-10 pr-4"
      />
    </form>
  );
}
