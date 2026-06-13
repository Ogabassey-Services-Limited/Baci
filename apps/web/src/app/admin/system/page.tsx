'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';

interface HealthCheck {
  check_name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: Record<string, unknown>;
}

interface IndexRecommendation {
  table_name: string;
  index_name: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface SystemHealth {
  health: HealthCheck[];
  indexRecommendations: IndexRecommendation[];
  missingIndexes: string[];
  checkedAt: string;
}

type LoadHealthResult =
  | { status: 'ok'; data: SystemHealth }
  | { status: 'aborted' }
  | { status: 'error'; error: unknown };

// Module-scope helpers keep try/catch out of the component body so the React
// Compiler can memoize it (it cannot lower try/finally clauses).
async function loadSystemHealth(
  signal: AbortSignal
): Promise<LoadHealthResult> {
  try {
    const response = await fetch('/api/admin/db-health', { signal });
    if (!response.ok) throw new Error('Failed to fetch health data');
    const data = (await response.json()) as SystemHealth;
    return { status: 'ok', data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'aborted' };
    }
    return { status: 'error', error };
  }
}

type RefreshViewsResult =
  | { status: 'ok' }
  | { status: 'error'; error: unknown };

async function postRefreshAnalyticsViews(): Promise<RefreshViewsResult> {
  try {
    const response = await fetchWithCsrf('/api/admin/analytics', {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to refresh views');
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="size-4 text-emerald-500" />;
    case 'warning':
      return <AlertTriangle className="size-4 text-amber-500" />;
    case 'critical':
      return <XCircle className="size-4 text-red-500" />;
    default:
      return <Activity className="size-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'healthy':
      return (
        <Badge
          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          variant="outline"
        >
          Healthy
        </Badge>
      );
    case 'warning':
      return (
        <Badge
          className="bg-amber-500/10 text-amber-600 border-amber-500/20"
          variant="outline"
        >
          Warning
        </Badge>
      );
    case 'critical':
      return (
        <Badge
          className="bg-red-500/10 text-red-600 border-red-500/20"
          variant="outline"
        >
          Critical
        </Badge>
      );
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive">High</Badge>;
    case 'medium':
      return <Badge variant="secondary">Medium</Badge>;
    case 'low':
      return <Badge variant="outline">Low</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingViews, setRefreshingViews] = useState(false);
  const { toast } = useToast();

  const applyHealthResult = (result: LoadHealthResult) => {
    if (result.status === 'aborted') return;
    if (result.status === 'error') {
      console.error('Failed to fetch system health:', result.error);
      toast({
        title: 'Error',
        description: 'Failed to load system health data.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    setHealth(result.data);
    setLoading(false);
  };

  const fetchHealth = () => {
    const controller = new AbortController();
    setLoading(true);
    loadSystemHealth(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      applyHealthResult(result);
    });
  };

  const refreshAnalyticsViews = () => {
    setRefreshingViews(true);
    return postRefreshAnalyticsViews()
      .then((result) => {
        if (result.status === 'ok') {
          toast({
            title: 'Success',
            description: 'Analytics views are being refreshed.',
          });
          return;
        }
        console.error('Failed to refresh views:', result.error);
        toast({
          title: 'Error',
          description: 'Failed to refresh analytics views.',
          variant: 'destructive',
        });
      })
      .then(() => {
        setRefreshingViews(false);
      });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  useEffect(() => {
    const controller = new AbortController();
    // `loading` already initializes to true, so we avoid a synchronous
    // setState here (which would trigger a cascading render in the effect).
    loadSystemHealth(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      applyHealthResult(result);
    });
    return () => controller.abort();
  }, [toast]);

  // Calculate overall health score with safe fallback array
  const checks = health?.health ?? [];
  const passingChecks = checks.filter((h) => h.status === 'healthy').length;
  const totalChecks = checks.length;
  const healthScore =
    totalChecks > 0 ? Math.round((passingChecks / totalChecks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-page-title">System Health</h1>
          <p className="text-muted-foreground">
            Monitor database performance and system status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchHealth} disabled={loading}>
            <RefreshCw
              className={`size-4 mr-2 ${loading ? 'motion-safe:animate-spin' : ''}`}
            />
            Refresh Status
          </Button>
          <Button
            data-testid="header-refresh-analytics-views"
            onClick={refreshAnalyticsViews}
            disabled={refreshingViews}
          >
            <Zap
              className={`size-4 mr-2 ${refreshingViews ? 'animate-pulse' : ''}`}
            />
            Refresh Analytics Views
          </Button>
        </div>
      </div>

      {/* Health Score */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Overall Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-stat">{healthScore}%</span>
                  {healthScore >= 80 ? (
                    <CheckCircle className="size-8 text-emerald-500" />
                  ) : healthScore >= 50 ? (
                    <AlertTriangle className="size-8 text-amber-500" />
                  ) : (
                    <XCircle className="size-8 text-red-500" />
                  )}
                </div>
                <Progress value={healthScore} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {passingChecks} of {totalChecks} checks passing
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <Database className="size-12 text-primary" />
                <div>
                  <p className="text-section-title">Supabase</p>
                  <p className="text-sm text-muted-foreground">
                    PostgreSQL Database
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Checked</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <Clock className="size-12 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">
                    {health?.checkedAt
                      ? new Date(health.checkedAt).toLocaleTimeString()
                      : 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {health?.checkedAt
                      ? new Date(health.checkedAt).toLocaleDateString()
                      : ''}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Health Checks */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Health Checks</CardTitle>
          <CardDescription>
            Status of various database and system checks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton loader
                  key={i}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <Skeleton className="size-6 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : health?.health && health.health.length > 0 ? (
            <div className="space-y-3">
              {health.health.map((check) => (
                <div
                  key={check.check_name}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {getStatusIcon(check.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{check.check_name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {check.message}
                    </p>
                  </div>
                  {getStatusBadge(check.status)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="size-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No health check data available</p>
              <p className="text-sm">
                Health check functions may not be set up in the database.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Index Recommendations */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Index Recommendations</CardTitle>
          <CardDescription>
            Suggested database indexes to improve performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : health?.indexRecommendations &&
            health.indexRecommendations.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Index</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {health.indexRecommendations.map((rec) => (
                    <TableRow key={`${rec.table_name}-${rec.index_name}`}>
                      <TableCell className="font-mono text-sm">
                        {rec.table_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {rec.index_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {rec.reason}
                      </TableCell>
                      <TableCell>{getPriorityBadge(rec.priority)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <HardDrive className="size-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No index recommendations</p>
              <p className="text-sm">
                Your database indexes are optimally configured.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Missing Indexes */}
      {health?.missingIndexes && health.missingIndexes.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Missing Indexes
            </CardTitle>
            <CardDescription>
              These indexes should be created for better performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {health.missingIndexes.map((indexName) => (
                <div
                  key={indexName}
                  className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20"
                >
                  <code className="text-sm font-mono">{indexName}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common maintenance operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={refreshAnalyticsViews}
              disabled={refreshingViews}
            >
              <Zap className="size-6" />
              <span>Refresh Analytics Views</span>
              <span className="text-xs text-muted-foreground">
                Update materialized views
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={fetchHealth}
              disabled={loading}
            >
              <Activity className="size-6" />
              <span>Run Health Check</span>
              <span className="text-xs text-muted-foreground">
                Check database status
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => {
                toast({
                  title: 'Coming Soon',
                  description:
                    'Database backup feature is not yet implemented.',
                });
              }}
            >
              <HardDrive className="size-6" />
              <span>View Backups</span>
              <span className="text-xs text-muted-foreground">
                Managed by Supabase
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
