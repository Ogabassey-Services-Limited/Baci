'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SetupItem, StoreReadiness } from '@/app/api/merchant/readiness/route';

const categoryIcons = {
  payments: CreditCard,
  products: Package,
  store: Store,
  legal: FileText,
  marketing: Megaphone,
};

const priorityColors = {
  required: 'text-red-600 bg-red-50 border-red-200',
  recommended: 'text-amber-600 bg-amber-50 border-amber-200',
  optional: 'text-blue-600 bg-blue-50 border-blue-200',
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

  useEffect(() => {
    fetchReadiness();
  }, []);

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
      } else {
        throw new Error('Failed to publish');
      }
    } catch (error) {
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

  // If store is published and all required items are done, show minimal state
  if (readiness.isPublished && readiness.isReady && dismissible && dismissed) {
    return null;
  }

  // Filter items based on view mode
  const incompleteItems = readiness.items.filter((item) => !item.completed);
  const displayItems = showAll
    ? readiness.items
    : compact
      ? incompleteItems.slice(0, 3)
      : incompleteItems;

  // Group items by priority
  const requiredIncomplete = incompleteItems.filter(
    (item) => item.priority === 'required'
  );
  const recommendedIncomplete = incompleteItems.filter(
    (item) => item.priority === 'recommended'
  );

  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        compact && 'border-0 shadow-none bg-transparent',
        !readiness.isReady && 'border-amber-200 bg-amber-50/30'
      )}
    >
      {/* Dismiss button */}
      {dismissible && readiness.isPublished && readiness.isReady && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      <CardHeader className={cn(compact && 'px-0 pt-0')}>
        <div className="flex items-start justify-between gap-4">
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
          <Progress value={readiness.overallProgress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className={cn(compact && 'px-0 pb-0')}>
        {/* Required items warning */}
        {!readiness.isReady && requiredIncomplete.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              {requiredIncomplete.length} required{' '}
              {requiredIncomplete.length === 1 ? 'item' : 'items'} remaining
            </div>
            <p className="mt-1 text-red-600">
              Complete these to publish your store and start accepting orders.
            </p>
          </div>
        )}

        {/* Checklist items */}
        <div className="space-y-2">
          {displayItems.map((item) => (
            <SetupItemRow key={item.id} item={item} />
          ))}
        </div>

        {/* Show more/less toggle */}
        {incompleteItems.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="mt-4 text-sm text-primary hover:underline flex items-center gap-1"
          >
            {showAll ? 'Show less' : `Show ${incompleteItems.length - 3} more items`}
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
    </Card>
  );
}

function SetupItemRow({ item }: { item: SetupItem }) {
  const Icon = categoryIcons[item.category];

  return (
    <Link
      href={item.href as Route}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all',
        item.completed
          ? 'bg-green-50/50 border-green-200 hover:bg-green-50'
          : 'bg-white border-gray-200 hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {/* Completion indicator */}
      <div
        className={cn(
          'shrink-0 h-6 w-6 rounded-full flex items-center justify-center',
          item.completed ? 'bg-green-600 text-white' : 'bg-gray-100'
        )}
      >
        {item.completed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {/* Category icon */}
      <div
        className={cn(
          'shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
          item.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-medium text-sm',
            item.completed && 'line-through text-muted-foreground'
          )}
        >
          {item.label}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {item.description}
        </p>
      </div>

      {/* Priority badge */}
      {!item.completed && (
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
          'shrink-0 h-4 w-4',
          item.completed ? 'text-green-600' : 'text-gray-400'
        )}
      />
    </Link>
  );
}

// Compact version for sidebar or smaller spaces
export function SetupChecklistCompact() {
  return <SetupChecklist compact dismissible />;
}
