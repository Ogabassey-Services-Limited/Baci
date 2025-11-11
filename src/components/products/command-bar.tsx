
'use client';

import { useState } from 'react';
import { useProductContext } from '@/contexts/product-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { processPriceList } from '@/app/dashboard/products/actions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, User, UserCog } from 'lucide-react';

export function CommandBar() {
  const { products, setWorkflowStep, setAiResponse, searchTerm, setSearchTerm, userRole, toggleRole } = useProductContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Heuristic to decide if it's a command or just a search
    const isCommand = searchTerm.split(' ').length > 2 || searchTerm.includes('$') || searchTerm.toLowerCase().startsWith('update');

    if (isCommand && userRole === 'admin') {
      setIsLoading(true);
      setWorkflowStep('processing');
      const response = await processPriceList(products, searchTerm, 'pasted text', 'text');
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
              placeholder={userRole === 'admin' ? 'Search products or enter an AI command (e.g., "update SKU-123 to $105")' : 'Search products...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-20"
              disabled={isLoading}
            />
            {userRole === 'admin' && (
              <Button type="submit" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run AI'}
              </Button>
            )}
          </div>
        </form>
        <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <Switch id="role-switch" checked={userRole === 'admin'} onCheckedChange={toggleRole} aria-label="Toggle user role" />
            <UserCog className="h-5 w-5 text-muted-foreground" />
            <Label htmlFor="role-switch" className="text-sm font-medium">
                {userRole === 'admin' ? 'Admin' : 'Customer'} View
            </Label>
        </div>
      </div>
    </div>
  );
}
