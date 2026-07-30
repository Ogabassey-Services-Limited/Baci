import { AlertCircle, CheckCircle2, ChevronRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { SetupChecklistContent } from './setup-checklist-content';
import type { SetupChecklistContentProps } from './setup-checklist-types';

interface SetupChecklistMobileDrawerProps extends SetupChecklistContentProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: () => void;
  publishing: boolean;
}

export function SetupChecklistMobileDrawer({
  compact,
  displayItems,
  incompleteItems,
  isOpen,
  onOpenChange,
  onPublish,
  publishing,
  readiness,
  requiredIncomplete,
  setShowAll,
  showAll,
}: SetupChecklistMobileDrawerProps) {
  if (readiness.isReady && readiness.isPublished) return null;

  return (
    <div className="block md:hidden">
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-label={
              readiness.isReady
                ? 'Ready to Launch, tap to publish your store'
                : `Finish Setup, ${readiness.completedRequired} of ${readiness.totalRequired} required steps done`
            }
            className="flex w-full cursor-pointer touch-manipulation select-none items-center justify-between rounded-2xl border border-primary/10 bg-linear-to-br from-primary/10 to-transparent p-4 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-4">
              <ProgressRing
                progress={readiness.overallProgress}
                isReady={readiness.isReady}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-sm">
                  {readiness.isReady ? 'Ready to Launch' : 'Finish Setup'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {readiness.isReady
                    ? 'Tap to publish your store'
                    : `${readiness.completedRequired}/${readiness.totalRequired} required steps done`}
                </span>
              </div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-background/50">
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl pt-6">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>Complete Setup</SheetTitle>
            <SheetDescription>
              Finish these steps to get your store ready for customers.
            </SheetDescription>
          </SheetHeader>
          <div className="h-full overflow-y-auto pb-20 no-scrollbar">
            <DrawerHeader
              onPublish={onPublish}
              publishing={publishing}
              readiness={readiness}
            />
            <SetupChecklistContent
              compact={compact}
              displayItems={displayItems}
              incompleteItems={incompleteItems}
              readiness={readiness}
              requiredIncomplete={requiredIncomplete}
              setShowAll={setShowAll}
              showAll={showAll}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProgressRing({
  progress,
  isReady,
}: {
  progress: number;
  isReady: boolean;
}) {
  return (
    <div className="relative size-12 shrink-0">
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
            isReady ? 'text-green-500' : 'text-primary'
          )}
          strokeDasharray={`${progress}, 100`}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-[10px]">
        {progress}%
      </div>
    </div>
  );
}

function DrawerHeader({
  onPublish,
  publishing,
  readiness,
}: Pick<
  SetupChecklistMobileDrawerProps,
  'onPublish' | 'publishing' | 'readiness'
>) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="flex items-center gap-2 font-semibold text-lg">
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
                Store Setup
              </>
            )}
          </h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {readiness.isPublished
              ? `${readiness.overallProgress}% complete`
              : `${readiness.completedRequired}/${readiness.totalRequired} required steps`}
          </p>
        </div>
        {!readiness.isPublished && readiness.isReady && (
          <Button
            onClick={onPublish}
            disabled={publishing}
            size="sm"
            className="shrink-0"
          >
            {publishing ? (
              <div className="mr-2 size-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Rocket className="mr-2 size-3" />
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
}
