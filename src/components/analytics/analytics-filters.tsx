
'use client';

import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AnalyticsFiltersProps {
    date: { from: Date | undefined; to: Date | undefined };
    onDateChange: (date: { from: Date | undefined; to: Date | undefined }) => void;
    onExport?: (format: 'csv' | 'pdf') => void;
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-xl border-none shadow-sm ring-1 ring-black/5 dark:ring-white/10 hover:bg-white/80 dark:hover:bg-black/60"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export Report
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onExport?.('csv')}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Export as CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport?.('pdf')}>
                            <FileText className="mr-2 h-4 w-4" />
                            Export as PDF
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </motion.div>
    );
}
