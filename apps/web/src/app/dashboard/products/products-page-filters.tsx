'use client';

import { ChevronDown, ListFilter, Search, Send } from 'lucide-react';
import type { FormEvent } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  getMigrationFilterLabel,
  getStatusFilterLabel,
  getStockFilterLabel,
  type MigrationFilterValue,
  type StatusFilterValue,
  type StockFilterValue,
} from '@/lib/product-list-filters';
import {
  migrationFilterOptions,
  statusFilterOptions,
  stockFilterOptions,
} from './products-filter-options';

interface ProductsPageFiltersProps {
  isLoading: boolean;
  searchTerm: string;
  migrationFilter: MigrationFilterValue;
  statusFilter: StatusFilterValue;
  stockFilter: StockFilterValue;
  onSearchTermChange: (value: string) => void;
  onSubmitSearch: (query: string) => Promise<void>;
  onMigrationFilterChange: (value: MigrationFilterValue) => void;
  onStatusFilterChange: (value: StatusFilterValue) => void;
  onStockFilterChange: (value: StockFilterValue) => void;
}

export function ProductsPageFilters({
  isLoading,
  searchTerm,
  migrationFilter,
  statusFilter,
  stockFilter,
  onSearchTermChange,
  onSubmitSearch,
  onMigrationFilterChange,
  onStatusFilterChange,
  onStockFilterChange,
}: ProductsPageFiltersProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmitSearch(searchTerm);
  };

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit}>
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
          <Textarea
            placeholder="Search products or paste a price list to run AI updates... ✨"
            className="w-full resize-none appearance-none bg-background pl-8 pr-12 shadow-none min-h-[40px] pt-2.5 border-primary/20"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            disabled={isLoading}
            rows={1}
            id="product-search"
            name="search"
            aria-label="Search products or paste price list"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 top-1.5 h-8 w-8"
            disabled={isLoading || !searchTerm.trim()}
          >
            {isLoading ? <BagLoader size={16} /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Submit</span>
          </Button>
        </div>
      </form>

      <div className="flex gap-2 items-center text-sm text-muted-foreground">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-1 border-primary/20 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-100"
            >
              <ListFilter className="h-4 w-4" />
              <span>Migration: {getMigrationFilterLabel(migrationFilter)}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {migrationFilterOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={migrationFilter === option.value}
                onCheckedChange={() => onMigrationFilterChange(option.value)}
                className="text-blue-800 dark:text-blue-100"
              >
                <option.icon className="mr-2 h-4 w-4" />
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-1 border-primary/20 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-100"
            >
              <ListFilter className="h-4 w-4" />
              <span>Status: {getStatusFilterLabel(statusFilter)}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {statusFilterOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={statusFilter === option.value}
                onCheckedChange={() => onStatusFilterChange(option.value)}
                className="text-blue-800 dark:text-blue-100"
              >
                <option.icon className="mr-2 h-4 w-4" />
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-1 border-primary/20 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-100"
            >
              <ListFilter className="h-4 w-4" />
              <span>Stock: {getStockFilterLabel(stockFilter)}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {stockFilterOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={stockFilter === option.value}
                onCheckedChange={() => onStockFilterChange(option.value)}
                className="text-blue-800 dark:text-blue-100"
              >
                <option.icon className="mr-2 h-4 w-4" />
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
