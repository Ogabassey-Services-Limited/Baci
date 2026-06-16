'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  BarChart3,
  Bell,
  Clock,
  Eye,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiDelete } from '@/lib/api-client';
// cn is available if needed for conditional classes
import type {
  AdminNotificationFilters,
  NotificationPriority,
  NotificationType,
  NotificationWithStats,
} from '@/types/notifications';

const typeStyles: Record<NotificationType, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  warning:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const priorityStyles: Record<NotificationPriority, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

interface NotificationStats {
  totalSent: number;
  avgReadRate: number;
  activeBanners: number;
  scheduled: number;
}

interface NotificationsPageResult {
  notifications: NotificationWithStats[];
  totalCount: number;
  stats: NotificationStats;
}

const PAGE_LIMIT = 20;

/**
 * Fetches notifications for the given filters and derives summary stats. Lives
 * at module scope so its throw-on-error control flow does not bail React
 * Compiler out of the page component.
 */
async function fetchAdminNotifications(
  filters: AdminNotificationFilters,
  searchQuery: string,
  page: number
): Promise<NotificationsPageResult> {
  const params = new URLSearchParams();
  params.set('limit', PAGE_LIMIT.toString());
  params.set('offset', (page * PAGE_LIMIT).toString());

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }
  if (filters.priority) {
    params.set('priority', filters.priority);
  }
  if (searchQuery) {
    params.set('search', searchQuery);
  }

  const response = await fetch(`/api/admin/notifications?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  const data = await response.json();
  const notifications = data.data as NotificationWithStats[];

  const sent = notifications.filter((n) => n.sent_at);
  const readRates = sent
    .map((n) => n.stats?.read_rate || 0)
    .filter((r) => r > 0);
  const avgRate =
    readRates.length > 0
      ? readRates.reduce((a, b) => a + b, 0) / readRates.length
      : 0;

  return {
    notifications,
    totalCount: data.pagination.total,
    stats: {
      totalSent: sent.length,
      avgReadRate: Math.round(avgRate),
      activeBanners: notifications.filter(
        (n) => n.sent_at && n.channels?.includes('banner') && !n.expires_at
      ).length,
      scheduled: notifications.filter((n) => !n.sent_at && n.scheduled_for)
        .length,
    },
  };
}

function getStatusBadge(notification: NotificationWithStats) {
  if (notification.sent_at) {
    return (
      <Badge variant="default" className="bg-green-600">
        Sent
      </Badge>
    );
  }
  if (notification.scheduled_for) {
    return (
      <Badge variant="outline" className="border-orange-500 text-orange-600">
        Scheduled
      </Badge>
    );
  }
  return <Badge variant="secondary">Draft</Badge>;
}

function getTargetLabel(notification: NotificationWithStats): string {
  switch (notification.target_type) {
    case 'all':
      return 'All Merchants';
    case 'specific':
      return `${notification.target_merchant_ids?.length || 0} Merchants`;
    case 'segment':
      return `Segment: ${notification.target_segment}`;
    default:
      return 'Unknown';
  }
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<NotificationWithStats[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<AdminNotificationFilters>({
    status: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const limit = PAGE_LIMIT;

  // Bumped to re-run the load effect for manual refreshes (refresh button,
  // post-delete) that do not change the filter/page inputs.
  const [refreshKey, setRefreshKey] = useState(0);

  // Stats
  const [stats, setStats] = useState<NotificationStats>({
    totalSent: 0,
    avgReadRate: 0,
    activeBanners: 0,
    scheduled: 0,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey re-triggers manual reloads (React Compiler handles memoization)
  useEffect(() => {
    let active = true;

    fetchAdminNotifications(filters, searchQuery, page)
      .then((result) => {
        if (!active) {
          return;
        }
        setNotifications(result.notifications);
        setTotalCount(result.totalCount);
        setStats(result.stats);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        console.error('Error fetching notifications:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch notifications',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, filters, searchQuery, toast, refreshKey]);

  const reloadNotifications = () => {
    setIsLoading(true);
    setRefreshKey((key) => key + 1);
  };

  const handleDelete = async (id: string) => {
    await apiDelete(`/api/admin/notifications/${id}`)
      .then(() => {
        toast({
          title: 'Deleted',
          description: 'Notification has been deleted',
        });

        reloadNotifications();
      })
      .catch((error: unknown) => {
        console.error('Error deleting notification:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete notification',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setDeleteId(null);
      });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Send notifications to merchants via in-app alerts and banners
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/notifications/create">
            <Plus className="size-4 mr-2" />
            Create Notification
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Send className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Read Rate</CardTitle>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgReadRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Banners
            </CardTitle>
            <Bell className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeBanners}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Notifications</CardTitle>
            <Button variant="outline" size="sm" onClick={reloadNotifications}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setIsLoading(true);
                  setPage(0);
                  setSearchQuery(e.target.value);
                }}
              />
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => {
                setIsLoading(true);
                setPage(0);
                setFilters({
                  ...filters,
                  status: value as AdminNotificationFilters['status'],
                });
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select
              value={filters.type || 'all'}
              onValueChange={(value) => {
                setIsLoading(true);
                setPage(0);
                setFilters({
                  ...filters,
                  type:
                    value === 'all' ? undefined : (value as NotificationType),
                });
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select
              value={filters.priority || 'all'}
              onValueChange={(value) => {
                setIsLoading(true);
                setPage(0);
                setFilters({
                  ...filters,
                  priority:
                    value === 'all'
                      ? undefined
                      : (value as NotificationPriority),
                });
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="size-12 mx-auto mb-4 opacity-50" />
              <p>No notifications found</p>
              <Button asChild variant="link" className="mt-2">
                <Link href="/admin/notifications/create">
                  Create your first notification
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Read Rate</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {notification.message}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={typeStyles[notification.notification_type]}
                        >
                          {notification.notification_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={priorityStyles[notification.priority]}
                        >
                          {notification.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="size-3" />
                          {getTargetLabel(notification)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(notification)}</TableCell>
                      <TableCell>
                        {notification.sent_at ? (
                          <span className="text-sm">
                            {notification.stats?.read_rate || 0}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {notification.sent_at
                            ? formatDistanceToNow(
                                new Date(notification.sent_at),
                                { addSuffix: true }
                              )
                            : notification.scheduled_for
                              ? format(
                                  new Date(notification.scheduled_for),
                                  'MMM d, yyyy HH:mm'
                                )
                              : formatDistanceToNow(
                                  new Date(notification.created_at),
                                  { addSuffix: true }
                                )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/admin/notifications/${notification.id}`
                                )
                              }
                            >
                              <Eye className="size-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(notification.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1} to{' '}
                  {Math.min((page + 1) * limit, totalCount)} of {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => {
                      setIsLoading(true);
                      setPage((p) => p - 1);
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * limit >= totalCount}
                    onClick={() => {
                      setIsLoading(true);
                      setPage((p) => p + 1);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
