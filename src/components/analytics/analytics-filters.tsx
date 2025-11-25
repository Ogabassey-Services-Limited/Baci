import { Button } from '@/components/ui/button';
// import { CalendarDateRangePicker } from '@/components/date-range-picker'; // Assuming this exists or I should create/use standard
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Download } from 'lucide-react';

interface AnalyticsFiltersProps {
    timeFrame: string;
    onTimeFrameChange: (value: string) => void;
    onExport?: () => void;
}

export function AnalyticsFilters({
    timeFrame,
    onTimeFrameChange,
    onExport,
}: AnalyticsFiltersProps) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
                <Select value={timeFrame} onValueChange={onTimeFrameChange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select time frame" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="weekly">Last 7 Days</SelectItem>
                        <SelectItem value="monthly">Last 30 Days</SelectItem>
                        <SelectItem value="yearly">Last Year</SelectItem>
                    </SelectContent>
                </Select>
                {/* <CalendarDateRangePicker /> */}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>
        </div>
    );
}
