import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  icon?: ElementType;
  action?: ReactNode;
  noPadding?: boolean;
}

export function BentoCard({
  children,
  className,
  title,
  description,
  icon: Icon,
  action,
  noPadding = false,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-sm transition-[box-shadow,border-color] duration-300 hover:shadow-md hover:border-white/20 min-w-[200px]',
        className
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />

      {(title || Icon) && (
        <div className="p-4 pb-1 relative z-10">
          {/* Top row: Icon + Action badge */}
          <div className="flex items-center justify-between mb-2">
            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 shrink-0">
                <Icon className="h-4 w-4" />
              </div>
            )}
            {action}
          </div>
          {/* Title row: Full width, no truncation */}
          {title && (
            <h3 className="text-sm font-semibold tracking-tight text-foreground/90 leading-snug">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      <div className={cn('relative z-10 h-full', !noPadding && 'p-6 pt-2')}>
        {children}
      </div>
    </div>
  );
}
