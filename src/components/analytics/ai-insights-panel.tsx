
'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { AnalyticsCategory } from './analytics-category-nav';

interface Insight {
    title: string;
    description: string;
    type: 'positive' | 'negative' | 'neutral' | 'opportunity';
    priority: 'high' | 'medium' | 'low';
    action?: string;
    category?: AnalyticsCategory;
}

interface AIInsightsPanelProps {
    className?: string;
    activeCategory: AnalyticsCategory;
}

export function AIInsightsPanel({ className, activeCategory }: AIInsightsPanelProps) {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        async function fetchInsights() {
            try {
                const response = await fetch('/api/analytics/insights');
                if (!response.ok) throw new Error('Failed to fetch insights');
                const data = await response.json();
                setInsights(data.insights || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        fetchInsights();
    }, []);

    // Filter insights based on active category
    const filteredInsights = activeCategory === 'overview'
        ? insights
        : insights.filter(insight => {
            const text = (insight.title + insight.description).toLowerCase();
            const keywords: Record<string, string[]> = {
                finance: ['revenue', 'sales', 'profit', 'cost', 'money'],
                products: ['product', 'stock', 'inventory', 'selling'],
                customers: ['customer', 'user', 'buyer', 'retention'],
                marketing: ['campaign', 'ad', 'social', 'traffic', 'conversion']
            };
            return keywords[activeCategory]?.some(k => text.includes(k)) ?? true;
        });

    // Auto-rotate insights every 5 seconds
    useEffect(() => {
        if (filteredInsights.length === 0) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % filteredInsights.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [filteredInsights.length]);

    const currentInsight = filteredInsights[currentIndex];

    if (loading) {
        return (
            <div className={cn(
                'min-h-[72px] h-auto rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 dark:border-indigo-800/50 backdrop-blur-sm animate-pulse',
                className
            )} />
        );
    }

    if (!currentInsight) {
        return (
            <div className={cn(
                'min-h-[72px] h-auto rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 dark:border-indigo-800/50 backdrop-blur-sm flex items-center px-4',
                className
            )}>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <p className="text-sm text-muted-foreground">No insights available</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'w-full min-h-[72px] h-auto rounded-xl border bg-card/50 backdrop-blur-sm flex items-center px-4 py-3 gap-3 relative overflow-hidden shadow-sm',
                className
            )}
        >
            {/* Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 relative flex flex-col justify-center">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h3 className="text-sm font-semibold text-foreground">
                        {currentInsight.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {currentInsight.description}
                    </p>
                </motion.div>
            </div>

            {/* Indicator dots */}
            {filteredInsights.length > 1 && (
                <div className="flex gap-1">
                    {filteredInsights.map((_, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                'w-1.5 h-1.5 rounded-full transition-all',
                                idx === currentIndex
                                    ? 'bg-primary w-4'
                                    : 'bg-muted-foreground/30'
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
