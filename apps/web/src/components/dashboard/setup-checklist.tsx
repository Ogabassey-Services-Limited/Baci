'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  CreditCard,
  FileText,
  Megaphone,
  Package,
  Rocket,
  Store,
  X,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  SetupItem,
  StoreReadiness,
} from '@/app/api/merchant/readiness/route';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const categoryIcons = {
  payments: CreditCard,
  products: Package,
  store: Store,
  legal: FileText,
  marketing: Megaphone,
};

const priorityColors = {
  required:
    'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
  recommended:
    'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
  optional:
    'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
};

const priorityLabels = {
  required: 'Required',
  recommended: 'Recommended',
  optional: 'Optional',
};

interface SetupChecklistProps {
  onPublish?: () => void;
  compact?: boolean;
  dismissible?: boolean;
}

// Mobile Widget for compact view
function SetupChecklistMobileWidget({
  readiness,
  onClick,
}: {
  readiness: StoreReadiness;
  onClick: () => void;
}) {
  if (readiness.isReady && readiness.isPublished) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        readiness.isReady
          ? 'Ready to Launch, tap to publish your store'
          : `Finish Setup, ${readiness.completedRequired} of ${readiness.totalRequired} required steps done`
      }
      className="md:hidden w-full bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-all touch-manipulation cursor-pointer select-none"
    >
      <div className="flex items-center gap-4">
        {/* Progress Ring */}
        <div className="relative h-12 w-12 shrink-0">
          <svg
            className="h-full w-full -rotate-90 text-background"
            viewBox="0 0 36 36"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Progress Ring</title>
            <path
              className="text-muted/20"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className={cn(
                'transition-all duration-1000 ease-out',
                readiness.isReady ? 'text-green-500' : 'text-primary'
              )}
              strokeDasharray={`${readiness.overallProgress}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
            {readiness.overallProgress}%
          </div>
        </div>

        <div className="flex flex-col">
          <span className="font-semibold text-sm">
            {readiness.isReady ? 'Ready to Launch' : 'Finish Setup'}
          </span>
          <span className="text-xs text-muted-foreground">
            {readiness.isReady
              ? 'Tap to publish your store'
              : `${readiness.completedRequired}/${readiness.totalRequired} required steps done`}
          </span>
        </div>
      </div>

      <div className="h-8 w-8 rounded-full bg-background/50 flex items-center justify-center">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

export function SetupChecklist({
  onPublish,
  compact = false,
  dismissible = false,
}: SetupChecklistProps) {
  const { toast } = useToast();
  const [readiness, setReadiness] = useState<StoreReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Handle completion highlighting - must be before any early returns
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const completedCategory = params.get('setup_complete');

    if (completedCategory) {
      // Clear the param
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Show success toast
      toast({
        title: 'Step Completed! 🎉',
        description: 'Great job! Moving to the next step.',
        className:
          'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/50 dark:border-green-800 dark:text-green-200',
      });
    }
  }, [toast]);

  useEffect(() => {
    const fetchReadiness = async () => {
      try {
        const response = await fetch('/api/merchant/readiness');
        if (response.ok) {
          const data = await response.json();
          setReadiness(data);
        }
      } catch (error) {
        console.error('Failed to fetch readiness:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReadiness();
  }, []);

  const handlePublish = async () => {
    if (!readiness?.isReady) {
      toast({
        variant: 'destructive',
        title: 'Cannot publish store',
        description: 'Please complete all required setup items first.',
      });
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch('/api/merchant/publish', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Store published!',
          description: 'Your store is now live and accepting orders.',
        });
        setReadiness((prev) => (prev ? { ...prev, isPublished: true } : null));
        onPublish?.();
        setIsSheetOpen(false);
      } else {
        throw new Error('Failed to publish');
      }
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Failed to publish',
        description: 'Please try again later.',
      });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <Card className={cn(compact && 'border-0 shadow-none')}>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!readiness) return null;

  // If store is published and all required items are done, return null or minimal state
  if (readiness.isPublished && readiness.isReady && dismissible && dismissed) {
    return null;
  }

  // Group items
  const incompleteItems = readiness.items.filter((item) => !item.completed);
  const displayItems = showAll
    ? readiness.items
    : compact
      ? incompleteItems.slice(0, 3)
      : incompleteItems;
  const requiredIncomplete = incompleteItems.filter(
    (item) => item.priority === 'required'
  );

  // Main Card Content (refactored for reuse in Drawer)
  const ChecklistContent = () => (
    <CardContent className={cn(compact && 'px-0 pb-0', 'p-0 sm:p-6 sm:pt-0')}>
      {/* Required items warning */}
      {!readiness.isReady && requiredIncomplete.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            {requiredIncomplete.length} required{' '}
            {requiredIncomplete.length === 1 ? 'item' : 'items'} remaining
          </div>
          <p className="mt-1 text-red-600 dark:text-red-400">
            Complete these to publish your store and start accepting orders.
          </p>
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <SetupItemRow
            key={item.id}
            item={item}
            isNext={index === 0 && !item.completed && !compact && showAll}
          />
        ))}
      </div>

      {/* Show more/less toggle */}
      {incompleteItems.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-4 text-sm text-primary hover:underline flex items-center gap-1"
        >
          {showAll
            ? 'Show less'
            : `Show ${incompleteItems.length - 3} more items`}
          <ArrowRight
            className={cn(
              'h-3 w-3 transition-transform',
              showAll && 'rotate-90'
            )}
          />
        </button>
      )}

      {/* All done state */}
      {incompleteItems.length === 0 && (
        <div className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <p className="font-medium text-lg">All set up!</p>
          <p className="text-muted-foreground text-sm">
            Your store is fully configured and ready for customers.
          </p>
        </div>
      )}
    </CardContent>
  );

  // Drawer Header (for mobile)
  const DrawerHeader = () => (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {readiness.isPublished ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Store is Live
              </>
            ) : readiness.isReady ? (
              <>
                <Rocket className="h-5 w-5 text-primary" />
                Ready to Launch
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Store Setup
              </>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {readiness.isPublished
              ? `${readiness.overallProgress}% complete`
              : `${readiness.completedRequired}/${readiness.totalRequired} required steps`}
          </p>
        </div>
        {!readiness.isPublished && readiness.isReady && (
          <Button
            onClick={handlePublish}
            disabled={publishing}
            size="sm"
            className="shrink-0"
          >
            {publishing ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
            ) : (
              <Rocket className="h-3 w-3 mr-2" />
            )}
            Publish
          </Button>
        )}
      </div>
      <Progress
        value={readiness.overallProgress}
        className="h-2"
        aria-label="Setup progress"
      />
    </div>
  );

  return (
    <>
      {/* Mobile: Compact Widget + Drawer */}
      <div className="block md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <div>
              <SetupChecklistMobileWidget
                readiness={readiness}
                onClick={() => setIsSheetOpen(true)}
              />
            </div>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl pt-6">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle>Complete Setup</SheetTitle>
              <SheetDescription>
                Finish these steps to get your store ready for customers.
              </SheetDescription>
            </SheetHeader>
            <div className="h-full overflow-y-auto pb-20 no-scrollbar">
              <DrawerHeader />
              <ChecklistContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Full Card */}
      <Card
        className={cn(
          'relative overflow-hidden hidden md:block',
          compact && 'border-0 shadow-none bg-transparent',
          !readiness.isReady &&
            'border-amber-200 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/20'
        )}
      >
        {/* Dismiss button */}
        {dismissible && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Dismiss setup checklist"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        <CardHeader className={cn(compact && 'px-0 pt-0')}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {readiness.isPublished ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Store is Live
                  </>
                ) : readiness.isReady ? (
                  <>
                    <Rocket className="h-5 w-5 text-primary" />
                    Ready to Launch
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    Complete Your Store Setup
                  </>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {readiness.isPublished
                  ? `${readiness.overallProgress}% complete - Keep improving your store`
                  : readiness.isReady
                    ? 'All required items complete. Publish your store to start selling!'
                    : `${readiness.completedRequired}/${readiness.totalRequired} required items complete`}
              </CardDescription>
            </div>

            {/* Publish button */}
            {!readiness.isPublished && readiness.isReady && (
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="shrink-0"
              >
                {publishing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                Publish Store
              </Button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Setup Progress</span>
              <span className="font-medium">{readiness.overallProgress}%</span>
            </div>
            <Progress
              value={readiness.overallProgress}
              className="h-2"
              aria-label="Setup progress"
            />
          </div>
        </CardHeader>

        <ChecklistContent />
      </Card>
    </>
  );
}

function SetupItemRow({ item, isNext }: { item: SetupItem; isNext?: boolean }) {
  const Icon = categoryIcons[item.category];
  const href =
    `${item.href}${item.href.includes('?') ? '&' : '?'}onboarding=true` as Route;

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all relative group',
        item.completed
          ? 'bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/50'
          : isNext
            ? 'bg-primary/5 border-primary/50 shadow-sm ring-1 ring-primary/20'
            : 'bg-card border-border hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {/* Pulse indicator for next item */}
      {isNext && (
        <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full animate-pulse" />
      )}

      {/* Completion indicator */}
      <div
        className={cn(
          'shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-colors',
          item.completed
            ? 'bg-green-600 text-white'
            : isNext
              ? 'bg-primary/20 text-primary'
              : 'bg-muted'
        )}
      >
        {item.completed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle
            className={cn('h-4 w-4', isNext ? 'text-primary' : 'text-gray-400')}
          />
        )}
      </div>

      {/* Category icon */}
      <div
        className={cn(
          'shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
          item.completed
            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
            : isNext
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'font-medium text-sm',
              item.completed && 'line-through text-muted-foreground'
            )}
          >
            {item.label}
          </p>
          {isNext && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
              Next Step
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {item.description}
        </p>
      </div>

      {/* Priority badge */}
      {!item.completed && !isNext && (
        <span
          className={cn(
            'shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium',
            priorityColors[item.priority]
          )}
        >
          {priorityLabels[item.priority]}
        </span>
      )}

      {/* Arrow */}
      <ArrowRight
        className={cn(
          'shrink-0 h-4 w-4 transition-transform group-hover:translate-x-1',
          item.completed
            ? 'text-green-600 dark:text-green-400'
            : isNext
              ? 'text-primary'
              : 'text-muted-foreground'
        )}
      />
    </Link>
  );
}

// Compact version for sidebar or smaller spaces
export function SetupChecklistCompact() {
  return <SetupChecklist compact dismissible />;
}
