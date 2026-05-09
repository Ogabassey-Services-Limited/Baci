'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  CheckCircle,
  Clock,
  Eye,
  Info,
  Loader2,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { cn } from '@/lib/utils';
import type {
  NotificationType,
  NotificationWithStats,
} from '@/types/notifications';

interface DeliveryRecord {
  id: string;
  merchant_id: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  merchants: {
    id: string;
    business_name: string | null;
  } | null;
}

const typeStyles: Record<NotificationType, { bg: string; icon: typeof Info }> =
  {
    info: { bg: 'bg-blue-100 text-blue-800', icon: Info },
    success: { bg: 'bg-green-100 text-green-800', icon: CheckCircle },
    warning: { bg: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
    error: { bg: 'bg-red-100 text-red-800', icon: AlertCircle },
  };

export default function NotificationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [notification, setNotification] =
    useState<NotificationWithStats | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchNotification() {
      try {
        const response = await fetch(`/api/admin/notifications/${id}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error('Failed to fetch notification');
        }

        const data = await response.json();
        setNotification(data);
        setDeliveries(data.deliveries || []);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error fetching notification:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch notification details',
          variant: 'destructive',
        });
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchNotification();
    return () => abortController.abort();
  }, [id, toast]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setShowDeleteDialog(false);
    try {
      await apiDelete(`/api/admin/notifications/${id}`);

      toast({
        title: 'Deleted',
        description: 'Notification has been deleted',
      });

      router.push('/admin/notifications');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="text-center py-12">
        <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Notification Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The notification you're looking for doesn't exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/admin/notifications">Back to Notifications</Link>
        </Button>
      </div>
    );
  }

  const typeStyle = typeStyles[notification.notification_type];
  const TypeIcon = typeStyle.icon;

  const getStatusBadge = () => {
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/notifications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {notification.title}
              </h1>
              {getStatusBadge()}
            </div>
            <p className="text-muted-foreground">
              Created{' '}
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Delete
        </Button>
      </div>

      {/* Stats Cards */}
      {notification.sent_at && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {notification.stats?.total_sent || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Read</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {notification.stats?.total_read || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dismissed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {notification.stats?.total_dismissed || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {notification.stats?.read_rate || 0}%
              </div>
              <Progress
                value={notification.stats?.read_rate || 0}
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notification Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
              <TypeIcon
                className={cn('h-5 w-5 mt-0.5', typeStyle.bg.split(' ')[1])}
              />
              <div className="flex-1">
                <h4 className="font-medium">{notification.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {notification.message}
                </p>
                {notification.action_label && (
                  <p className="text-sm text-primary mt-2">
                    {notification.action_label}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <Badge variant="outline" className={typeStyle.bg}>
                  {notification.notification_type}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Priority</p>
                <p className="font-medium capitalize">
                  {notification.priority}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Channels</p>
                <div className="flex gap-1 flex-wrap">
                  {notification.channels?.map((channel) => (
                    <Badge
                      key={channel}
                      variant="secondary"
                      className="text-xs"
                    >
                      {channel === 'in_app' ? 'In-App' : 'Banner'}
                    </Badge>
                  ))}
                </div>
              </div>
              {notification.action_url && (
                <div>
                  <p className="text-muted-foreground">Action URL</p>
                  <a
                    href={notification.action_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs break-all"
                  >
                    {notification.action_url}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Target</p>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="font-medium capitalize">
                    {notification.target_type === 'all'
                      ? 'All Merchants'
                      : notification.target_type === 'segment'
                        ? `Segment: ${notification.target_segment}`
                        : `${notification.target_merchant_ids?.length || 0} Merchants`}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                {getStatusBadge()}
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(
                    new Date(notification.created_at),
                    'MMM d, yyyy HH:mm'
                  )}
                </p>
              </div>
              {notification.sent_at && (
                <div>
                  <p className="text-muted-foreground">Sent</p>
                  <p className="font-medium">
                    {format(
                      new Date(notification.sent_at),
                      'MMM d, yyyy HH:mm'
                    )}
                  </p>
                </div>
              )}
              {notification.scheduled_for && !notification.sent_at && (
                <div>
                  <p className="text-muted-foreground">Scheduled For</p>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      {format(
                        new Date(notification.scheduled_for),
                        'MMM d, yyyy HH:mm'
                      )}
                    </span>
                  </div>
                </div>
              )}
              {notification.expires_at && (
                <div>
                  <p className="text-muted-foreground">Expires</p>
                  <p className="font-medium">
                    {format(
                      new Date(notification.expires_at),
                      'MMM d, yyyy HH:mm'
                    )}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Table */}
      {notification.sent_at && deliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Status</CardTitle>
            <CardDescription>
              Per-merchant delivery and read status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Read</TableHead>
                  <TableHead>Dismissed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <span className="font-medium">
                        {delivery.merchants?.business_name ||
                          'Unknown Merchant'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(delivery.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      {delivery.read_at
                        ? formatDistanceToNow(new Date(delivery.read_at), {
                            addSuffix: true,
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {delivery.dismissed_at
                        ? formatDistanceToNow(new Date(delivery.dismissed_at), {
                            addSuffix: true,
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {delivery.dismissed_at ? (
                        <Badge variant="secondary">Dismissed</Badge>
                      ) : delivery.read_at ? (
                        <Badge variant="default" className="bg-green-600">
                          Read
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unread</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
              onClick={handleDelete}
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
