import { AlertCircle, CheckCircle2, Rocket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { SetupChecklistContent } from './setup-checklist-content';
import type { SetupChecklistContentProps } from './setup-checklist-types';

interface SetupChecklistDesktopCardProps extends SetupChecklistContentProps {
  dismissible: boolean;
  onDismiss: () => void;
  onPublish: () => void;
  publishing: boolean;
}

export function SetupChecklistDesktopCard({
  compact,
  dismissible,
  displayItems,
  incompleteItems,
  onDismiss,
  onPublish,
  publishing,
  readiness,
  requiredIncomplete,
  setShowAll,
  showAll,
}: SetupChecklistDesktopCardProps) {
  return (
    <Card
      className={cn(
        'relative hidden overflow-hidden md:block',
        compact && 'border-0 bg-transparent shadow-none',
        !readiness.isReady &&
          'border-amber-200 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/20'
      )}
    >
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 rounded-full p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Dismiss setup checklist"
        >
          <X className="size-4 text-muted-foreground" />
        </button>
      )}
      <CardHeader className={cn(compact && 'px-0 pt-0')}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {readiness.isPublished ? (
                <>
                  <CheckCircle2 className="size-5 text-green-600" />
                  Store is Live
                </>
              ) : readiness.isReady ? (
                <>
                  <Rocket className="size-5 text-primary" />
                  Ready to Launch
                </>
              ) : (
                <>
                  <AlertCircle className="size-5 text-amber-600" />
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
          {!readiness.isPublished && readiness.isReady && (
            <Button
              onClick={onPublish}
              disabled={publishing}
              className="shrink-0"
            >
              {publishing ? (
                <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Rocket className="mr-2 size-4" />
              )}
              Publish Store
            </Button>
          )}
        </div>
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
      <CardContent className="p-0">
        <SetupChecklistContent
          compact={compact}
          displayItems={displayItems}
          incompleteItems={incompleteItems}
          readiness={readiness}
          requiredIncomplete={requiredIncomplete}
          setShowAll={setShowAll}
          showAll={showAll}
        />
      </CardContent>
    </Card>
  );
}
