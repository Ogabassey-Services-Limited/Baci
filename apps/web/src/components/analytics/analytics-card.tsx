'use client';

import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { formatMetricChange } from '@/components/analytics/format-metric-change';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  loading?: boolean;
  className?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}

export function AnalyticsCard({
  title,
  value,
  change,
  icon: Icon,
  loading,
  className,
  trend,
  description,
}: AnalyticsCardProps) {
  const getTrendColor = (t?: 'up' | 'down' | 'neutral') => {
    switch (t) {
      case 'up':
        return 'text-emerald-500 bg-emerald-500/10';
      case 'down':
        return 'text-rose-500 bg-rose-500/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getTrendIcon = (t?: 'up' | 'down' | 'neutral') => {
    switch (t) {
      case 'up':
        return <ArrowUp className="h-3 w-3" />;
      case 'down':
        return <ArrowDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={cn('h-full', className)}
    >
      <Card className="h-full overflow-hidden border-none bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="p-2 rounded-xl bg-primary/5 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-8 w-24 bg-muted rounded-lg" />
              <div className="h-4 w-16 bg-muted rounded-lg" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-3xl font-bold tracking-tight text-foreground">
                {value}
              </div>
              {(change !== undefined || description) && (
                <div className="flex items-center gap-2 text-xs">
                  {change !== undefined && (
                    <span
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded-full font-medium',
                        getTrendColor(trend)
                      )}
                    >
                      {getTrendIcon(trend)}
                      {formatMetricChange(change)}
                    </span>
                  )}
                  {description && (
                    <span className="text-muted-foreground truncate">
                      {description}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
