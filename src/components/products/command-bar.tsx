'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { processPriceList } from '@/app/dashboard/products/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProductContext } from '@/contexts/product-context';

export function CommandBar() {
  const {
    products,
    setWorkflowStep,
    setAiResponse,
    searchTerm,
    setSearchTerm,
  } = useProductContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Heuristic to decide if it's a command or just a search
    const isCommand =
      searchTerm.split(' ').length > 2 ||
      searchTerm.includes('$') ||
      searchTerm.toLowerCase().startsWith('update');

    if (isCommand) {
      setIsLoading(true);
      setWorkflowStep('processing');
      const response = await processPriceList(
        products,
        searchTerm,
        'pasted text',
        'text'
      );
      setAiResponse(response);
      setWorkflowStep('review');
      setIsLoading(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="p-4 border-t bg-background mt-auto">
      <div className="flex items-center gap-4">
        <form onSubmit={handleCommandSubmit} className="flex-1">
          <div className="relative">
            <Input
              type="text"
              placeholder={
                'Search products or enter an AI command (e.g., "update SKU-123 to $105")'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-20"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Run AI'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
