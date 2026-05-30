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

interface JumiaCategoryItem {
  code: number;
  name: string;
  completePath: string;
  attributeSet?: string;
}

interface CategorySelectorProps {
  merchantId: string;
  value?: number;
  onSelect: (code: number, name: string) => void;
}

export function JumiaCategorySelector({
  merchantId,
  value,
  onSelect,
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<JumiaCategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCategories = (currentValue: number | null | undefined) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 10_000);
    fetch(
      `/api/marketplace/jumia/categories?merchantId=${encodeURIComponent(merchantId)}`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load categories');
        return res.json();
      })
      .then((data) => {
        // Categories are already flat from the Vendor Center API
        const cats = Array.isArray(data.categories)
          ? data.categories.filter(
              (c: unknown): c is JumiaCategoryItem =>
                typeof c === 'object' &&
                c !== null &&
                typeof (c as Record<string, unknown>).code === 'number' &&
                typeof (c as Record<string, unknown>).name === 'string' &&
                typeof (c as Record<string, unknown>).completePath === 'string'
            )
          : [];
        setCategories(cats);
        // Restore selectedName if value is already set (e.g. controlled prop)
        if (currentValue != null) {
          const match = cats.find(
            (c: JumiaCategoryItem) => c.code === currentValue
          );
          if (match) {
            setSelectedName(match.completePath || match.name);
          }
        }
      })
      .catch((err: unknown) => {
        if (didTimeout) {
          setError('Timeout while loading categories');
          return;
        }
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(
          err instanceof Error ? err.message : 'Failed to load categories'
        );
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted || didTimeout) {
          setLoading(false);
        }
      });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally depends only on merchantId to reset state when merchant context changes
  useEffect(() => {
    setCategories([]);
    setSelectedName('');
    setError(null);
    setLoading(false);
    return () => abortControllerRef.current?.abort();
  }, [merchantId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchCategories intentionally omitted; merchantId used as proxy dependency
  useEffect(() => {
    if (open && categories.length === 0 && !error) {
      fetchCategories(value);
    }
  }, [open, merchantId, categories.length, error]);

  // Sync selectedName when value changes and categories are already loaded
  useEffect(() => {
    if (value != null && categories.length > 0) {
      const match = categories.find((c) => c.code === value);
      if (match) {
        setSelectedName(match.completePath || match.name);
      } else {
        // Value doesn't match any loaded category — clear stale label
        setSelectedName('');
      }
    } else if (value == null) {
      setSelectedName('');
    }
  }, [value, categories]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && error) {
          setError(null);
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedName ||
            (value
              ? loading
                ? 'Loading...'
                : 'Category selected'
              : 'Select Jumia Category...')}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search Jumia category..." />
          <CommandList>
            <CommandEmpty>
              {error ? (
                <div className="p-4 text-sm text-center">
                  <p className="text-destructive">{error}</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => fetchCategories(value)}
                    className="mt-2 text-sm underline"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                'No category found.'
              )}
            </CommandEmpty>
            {loading ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Loading categories…
              </div>
            ) : (
              <CommandGroup>
                <ScrollArea className="h-72">
                  {categories.map((category) => (
                    <CommandItem
                      key={category.code}
                      value={category.completePath || category.name}
                      onSelect={() => {
                        onSelect(category.code, category.name);
                        setSelectedName(category.completePath || category.name);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4',
                          value === category.code ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {category.completePath || category.name}
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
