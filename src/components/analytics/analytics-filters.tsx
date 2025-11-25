
'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { DateRangePicker } from '@/components/ui/date-range-picker';

interface AnalyticsFiltersProps {
    date: { from: Date | undefined; to: Date | undefined };
    onDateChange: (date: { from: Date | undefined; to: Date | undefined }) => void;
    onExport?: () => void;
    className?: string;
}

export function AnalyticsFilters({
    date,
    onDateChange,
    onExport,
    className,
}: AnalyticsFiltersProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex items-center justify-between gap-4", className)}
        >
            <DateRangePicker date={date} setDate={onDateChange} />

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                    className="rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-xl border-none shadow-sm ring-1 ring-black/5 dark:ring-white/10 hover:bg-white/80 dark:hover:bg-black/60"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Export Report
                </Button>
            </div>
        </motion.div>
    );
}
