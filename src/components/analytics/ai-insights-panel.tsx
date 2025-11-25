import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Insight {
    title: string;
    description: string;
    type: 'positive' | 'negative' | 'neutral' | 'opportunity';
    priority: 'high' | 'medium' | 'low';
    action?: string;
}

interface AIInsightsPanelProps {
    className?: string;
}

export function AIInsightsPanel({ className }: AIInsightsPanelProps) {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchInsights() {
            try {
                const response = await fetch('/api/analytics/insights');
                if (!response.ok) throw new Error('Failed to fetch insights');
                const data = await response.json();
                setInsights(data.insights || []);
            } catch (err) {
                console.error(err);
                setError('Failed to load AI insights');
            } finally {
                setLoading(false);
            }
        }

        fetchInsights();
    }, []);

    if (error) return null; // Hide panel on error for now

    return (
        <Card className={cn('border-primary/20 bg-primary/5', className)}>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg font-semibold text-primary">AI Insights</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-20 w-full rounded-lg bg-primary/10" />
                        <Skeleton className="h-20 w-full rounded-lg bg-primary/10" />
                        <Skeleton className="h-20 w-full rounded-lg bg-primary/10" />
                    </div>
                ) : (
                    insights.map((insight, index) => (
                        <div
                            key={index}
                            className="group relative overflow-hidden rounded-lg border bg-background p-4 transition-all hover:shadow-md"
                        >
                            <div className="flex items-start gap-3">
                                <div className={cn(
                                    "mt-1 rounded-full p-1.5",
                                    insight.type === 'positive' && "bg-green-100 text-green-600",
                                    insight.type === 'negative' && "bg-red-100 text-red-600",
                                    insight.type === 'opportunity' && "bg-blue-100 text-blue-600",
                                    insight.type === 'neutral' && "bg-gray-100 text-gray-600",
                                )}>
                                    {insight.type === 'positive' && <TrendingUp className="h-4 w-4" />}
                                    {insight.type === 'negative' && <AlertTriangle className="h-4 w-4" />}
                                    {insight.type === 'opportunity' && <Sparkles className="h-4 w-4" />}
                                    {insight.type === 'neutral' && <Info className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h4 className="font-medium leading-none">{insight.title}</h4>
                                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                                    {insight.action && (
                                        <div className="mt-3 flex items-center text-sm font-medium text-primary">
                                            <span>Suggested Action: {insight.action}</span>
                                            <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
