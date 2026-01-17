'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useState } from 'react';
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

export interface JumiaBrand {
  BrandId?: string | number;
  Name: string;
}

interface BrandSelectorProps {
  merchantId: string;
  value?: string; // Brand Name (Jumia often uses name as key or ID)
  onSelect: (brandName: string) => void;
}

export function JumiaBrandSelector({
  merchantId,
  value,
  onSelect,
}: BrandSelectorProps) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<JumiaBrand[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && brands.length === 0) {
      setLoading(true);
      fetch(`/api/marketplace/jumia/brands?merchantId=${merchantId}`)
        .then((res) => res.json())
        .then((data) => {
          // Ensure uniq
          setBrands(data || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [open, merchantId, brands.length]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || 'Select Jumia Brand...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search brand..." />
          <CommandList>
            <CommandEmpty>No brand found.</CommandEmpty>
            {loading ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Loading brands...
              </div>
            ) : (
              <CommandGroup>
                <ScrollArea className="h-72">
                  {brands.map((brand, idx) => (
                    <CommandItem
                      key={`${brand.Name}-${idx}`}
                      value={brand.Name}
                      onSelect={(_currentValue) => {
                        onSelect(brand.Name); // Use original case if possible, but Command forces lowercase val.
                        // Better to just pass brand.Name
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === brand.Name ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {brand.Name}
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
