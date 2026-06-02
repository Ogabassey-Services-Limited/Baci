'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface JumiaBrandItem {
  code: number;
  name: string;
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

const BRAND_LISTBOX_ID = 'jumia-brand-selector-listbox';

interface BrandSelectorProps {
  merchantId: string;
  value?: JumiaBrandItem | null;
  onSelect: (brand: JumiaBrandItem) => void;
}

export function JumiaBrandSelector({
  merchantId,
  value,
  onSelect,
}: BrandSelectorProps) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<JumiaBrandItem[]>([]);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBrands = (currentMerchantId: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFetchStatus('loading');
    setErrorMessage(null);
    fetch(
      `/api/marketplace/jumia/brands?merchantId=${encodeURIComponent(currentMerchantId)}`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load brands');
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        // Differentiate malformed response from empty brands list
        if (!data || typeof data !== 'object' || !('brands' in data)) {
          setErrorMessage(
            'Unexpected response from brands API — please try again'
          );
          setFetchStatus('error');
          return;
        }
        if (!Array.isArray(data.brands)) {
          setErrorMessage('Malformed brands data received — please try again');
          setFetchStatus('error');
          return;
        }
        const items = data.brands.filter(
          (b: unknown): b is JumiaBrandItem =>
            typeof b === 'object' &&
            b !== null &&
            typeof (b as Record<string, unknown>).code === 'number' &&
            typeof (b as Record<string, unknown>).name === 'string'
        );
        setBrands(items);
        setFetchStatus('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to load brands'
        );
        setFetchStatus('error');
      });
  };

  // Reset brands when merchantId changes to avoid stale data
  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    setBrands([]);
    setErrorMessage(null);
    setFetchStatus('idle');
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [merchantId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchBrands intentionally omitted — it's a stable callback using currentMerchantId param; merchantId + fetchStatus are sufficient triggers
  useEffect(() => {
    if (open && fetchStatus === 'idle') {
      fetchBrands(merchantId);
    }
  }, [open, merchantId, fetchStatus]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-controls={BRAND_LISTBOX_ID}
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value?.name || 'Select Jumia Brand...'}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search brand..." />
          <CommandList id={BRAND_LISTBOX_ID}>
            {fetchStatus === 'error' && (
              <CommandEmpty>
                <div className="p-4 text-sm text-center">
                  <p className="text-destructive">{errorMessage}</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => fetchBrands(merchantId)}
                    className="mt-2 text-sm underline"
                  >
                    Retry
                  </Button>
                </div>
              </CommandEmpty>
            )}
            {fetchStatus === 'success' && brands.length === 0 && (
              <CommandEmpty>No brand found.</CommandEmpty>
            )}
            {fetchStatus === 'loading' || fetchStatus === 'idle' ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Loading brands…
              </div>
            ) : (
              <CommandGroup>
                <ScrollArea className="h-72">
                  {brands.map((brand) => (
                    <CommandItem
                      key={brand.code}
                      value={brand.name}
                      onSelect={() => {
                        onSelect(brand);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4',
                          value?.code === brand.code
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {brand.name}
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
