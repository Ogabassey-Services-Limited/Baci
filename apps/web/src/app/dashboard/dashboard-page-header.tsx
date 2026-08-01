import { ArrowUp, Globe, Loader2, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardPageHeaderProps {
  businessName?: string | null;
  isPublished?: boolean | null;
  isPublishing: boolean;
  onPublishToggle: () => void;
  slug?: string | null;
}

export function DashboardPageHeader({
  businessName,
  isPublished,
  isPublishing,
  onPublishToggle,
  slug,
}: DashboardPageHeaderProps) {
  return (
    <>
      <div
        className={cn(
          'hidden md:flex rounded-lg border p-4 flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
          isPublished
            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-full',
              isPublished
                ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400'
            )}
          >
            <Globe className="size-5" />
          </div>
          <div>
            <p className="font-medium">
              {isPublished ? 'Store is Live' : 'Store is Offline'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isPublished
                ? 'Customers can access your store and place orders.'
                : 'Your store is not visible to customers. Publish when ready.'}
            </p>
          </div>
        </div>
        <Button
          onClick={onPublishToggle}
          disabled={isPublishing}
          variant={isPublished ? 'outline' : 'default'}
          className={cn(!isPublished && 'bg-green-600 hover:bg-green-700')}
        >
          {isPublishing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Globe className="mr-2 size-4" />
          )}
          {isPublishing
            ? 'Updating...'
            : isPublished
              ? 'Unpublish Store'
              : 'Publish Store'}
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="md:hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground border">
                {businessName?.charAt(0) || 'B'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">
                    Hi,{' '}
                    <span className="capitalize bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 bg-clip-text text-transparent">
                      {businessName?.split(' ')[0] || 'Merchant'}
                    </span>
                  </h2>
                  {isPublished && (
                    <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Share your referral code today. 🎉
                </p>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="relative size-9">
              <div className="absolute top-1 right-1 size-2 bg-red-500 rounded-full" />
              <Users className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-full border-muted-foreground/30"
              asChild
            >
              <a
                href={slug ? `/${slug}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="size-3 mr-1.5" />
                Visit store
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-full border-muted-foreground/30"
              onClick={() => {
                navigator.clipboard.writeText(
                  slug ? `${window.location.origin}/${slug}` : ''
                );
              }}
            >
              <ArrowUp className="size-3 mr-1.5 rotate-45" />
              Share link
            </Button>
          </div>
        </div>

        <div className="hidden md:block space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your store's performance
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
            <Sparkles className="mr-2 size-4" />
            Ask AI Assistant
          </Button>
        </div>
      </div>
    </>
  );
}
