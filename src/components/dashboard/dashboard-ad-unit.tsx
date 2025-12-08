'use client';

import { cn } from '@/lib/utils';

interface DashboardAdUnitProps {
    variant?: 'horizontal' | 'banner';
    className?: string;
}

/**
 * Placeholder ad unit for dashboard pages.
 * In production, replace this with actual Google AdSense/Ad Manager integration.
 */
export function DashboardAdUnit({
    variant = 'horizontal',
    className,
}: DashboardAdUnitProps) {
    const dimensions =
        variant === 'horizontal'
            ? { width: 728, height: 90, mobileWidth: 320, mobileHeight: 50 }
            : { width: 970, height: 90, mobileWidth: 320, mobileHeight: 100 };

    return (
        <div className={cn('w-full flex justify-center my-4', className)}>
            <div className="flex flex-col items-center w-full">
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 self-start ml-1">
                    Sponsored
                </span>
                <div
                    className="relative w-full overflow-hidden bg-muted/30 border border-border/50 rounded-lg flex items-center justify-center text-center"
                    style={{
                        maxWidth: `${dimensions.width}px`,
                        height: `${dimensions.height}px`,
                    }}
                >
                    {/* Placeholder - replace with actual ad script */}
                    <div className="flex flex-col items-center justify-center p-4">
                        <span className="text-xs font-medium text-muted-foreground/50 uppercase tracking-widest">
                            Ad Space
                        </span>
                        <span className="text-[10px] text-muted-foreground/30 mt-1">
                            {dimensions.width}×{dimensions.height}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
