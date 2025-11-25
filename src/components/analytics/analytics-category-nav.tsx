
'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { DollarSign, Package, Users, Megaphone, LayoutGrid } from 'lucide-react';

export type AnalyticsCategory = 'overview' | 'finance' | 'products' | 'customers' | 'marketing';

interface AnalyticsCategoryNavProps {
    activeCategory: AnalyticsCategory;
    onCategoryChange: (category: AnalyticsCategory) => void;
    className?: string;
}

export function AnalyticsCategoryNav({
    activeCategory,
    onCategoryChange,
    className,
}: AnalyticsCategoryNavProps) {
    const categories: { id: AnalyticsCategory; label: string; icon: React.ElementType }[] = [
        { id: 'overview', label: 'Overview 📊', icon: LayoutGrid },
        { id: 'finance', label: 'Finance 💰', icon: DollarSign },
        { id: 'products', label: 'Products 📦', icon: Package },
        { id: 'customers', label: 'Customers 👥', icon: Users },
        { id: 'marketing', label: 'Marketing 📣', icon: Megaphone },
    ];

    return (
        <div className={cn("flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide", className)}>
            {categories.map((category) => {
                const isActive = activeCategory === category.id;
                const Icon = category.icon;

                return (
                    <button
                        key={category.id}
                        onClick={() => onCategoryChange(category.id)}
                        className={cn(
                            "relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap",
                            isActive
                                ? "text-white"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeCategory"
                                className="absolute inset-0 bg-primary rounded-full shadow-md shadow-primary/25"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {category.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
