'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface TemplatesHeaderProps {
  businessName?: string;
  isFiltered: boolean;
  userBusinessType?: string;
}

export function TemplatesHeader({
  businessName,
  isFiltered,
  userBusinessType,
}: TemplatesHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAll = searchParams.get('showAll') === 'true';

  const toggleFilter = () => {
    const params = new URLSearchParams(searchParams);
    if (showAll) {
      params.delete('showAll');
    } else {
      params.set('showAll', 'true');
    }
    router.push(`/dashboard/templates?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Template Gallery</h1>
        <p className="text-muted-foreground">
          {isFiltered
            ? `Recommended templates for your ${businessName || 'business'}`
            : 'Explore our collection of premium storefront designs'}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {userBusinessType && (
          <Button
            variant={showAll ? 'secondary' : 'default'}
            onClick={toggleFilter}
            aria-pressed={showAll}
            aria-label={
              showAll ? 'Show only recommended templates' : 'Show all templates'
            }
          >
            {showAll ? 'Show Recommended Only' : 'Show All Templates'}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/developers/submit">Submit Template</Link>
        </Button>
      </div>
    </div>
  );
}
