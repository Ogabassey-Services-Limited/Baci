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

export interface JumiaCategory {
  id: string | number;
  name: string;
  children?: JumiaCategory[];
}

interface CategorySelectorProps {
  merchantId: string;
  value?: string | number; // Category ID
  onSelect: (id: string, name: string) => void;
}

const flattenCategories = (
  cats: JumiaCategory[],
  parentName = ''
): JumiaCategory[] => {
  let flat: JumiaCategory[] = [];
  cats.forEach((cat) => {
    const fullName = parentName ? `${parentName} > ${cat.name}` : cat.name;
    // Push current
    flat.push({ ...cat, name: fullName });
    // Recurse
    if (cat.children) {
      flat = flat.concat(flattenCategories(cat.children, fullName));
    }
  });
  return flat;
};

export function JumiaCategorySelector({
  merchantId,
  value,
  onSelect,
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<JumiaCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState<string>('');

  useEffect(() => {
    if (open && categories.length === 0) {
      setLoading(true);
      fetch(`/api/marketplace/jumia/categories?merchantId=${merchantId}`)
        .then((res) => res.json())
        .then((data) => {
          // Flatten the tree or handle it? simplified flat search for command
          // Jumia tree can be deep. For now, let's just flatten it for the search
          const flattened = flattenCategories(data);
          setCategories(flattened);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [open, merchantId, categories.length]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedName ||
            (value ? `Category ID: ${value}` : 'Select Jumia Category...')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          {/* Note: Client side filtering on 1000s of cats might be heavy, but let's try standard Command first. 
                Actually, Jumia has thousands. We should enable filtering.
                'shouldFilter={true}' is default.
            */}
          <CommandInput placeholder="Search Jumia category..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            {loading ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                Loading categories...
              </div>
            ) : (
              <CommandGroup>
                <ScrollArea className="h-72">
                  {categories.map((category) => (
                    <CommandItem
                      key={category.id}
                      value={category.name} // Search by name
                      onSelect={() => {
                        onSelect(String(category.id), category.name);
                        setSelectedName(category.name);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          String(value) === String(category.id)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {category.name}
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
