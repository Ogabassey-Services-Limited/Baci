import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react';

interface AnalyticsCardProps {
    title: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon?: React.ReactNode;
    loading?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export function AnalyticsCard({
    title,
    value,
    change,
    changeLabel = 'from last period',
    icon,
    loading,
    className,
    children,
}: AnalyticsCardProps) {
    return (
        <Card className={cn('overflow-hidden', className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon && <div className="text-muted-foreground">{icon}</div>}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2 animate-pulse">
                        <div className="h-8 w-24 bg-muted rounded" />
                        <div className="h-4 w-32 bg-muted rounded" />
                    </div>
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        {change !== undefined && (
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                                {change > 0 ? (
                                    <ArrowUpIcon className="mr-1 h-4 w-4 text-green-500" />
                                ) : change < 0 ? (
                                    <ArrowDownIcon className="mr-1 h-4 w-4 text-red-500" />
                                ) : (
                                    <MinusIcon className="mr-1 h-4 w-4" />
                                )}
                                <span
                                    className={cn(
                                        change > 0
                                            ? 'text-green-500'
                                            : change < 0
                                                ? 'text-red-500'
                                                : ''
                                    )}
                                >
                                    {Math.abs(change).toFixed(1)}%
                                </span>
                                <span className="ml-1">{changeLabel}</span>
                            </div>
                        )}
                        {children}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
