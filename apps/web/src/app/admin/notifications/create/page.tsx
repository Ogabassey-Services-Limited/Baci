'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle,
  Clock,
  Info,
  Loader2,
  Send,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type {
  CreateNotificationInput,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  TargetSegment,
  TargetType,
} from '@/types/notifications';

interface CreateNotificationResponse {
  merchants_notified?: number;
  scheduled_for?: string | null;
  status: 'sent' | 'scheduled' | string;
}

const typeOptions: {
  value: NotificationType;
  label: string;
  icon: typeof Info;
  color: string;
}[] = [
  { value: 'info', label: 'Information', icon: Info, color: 'text-blue-500' },
  {
    value: 'success',
    label: 'Success',
    icon: CheckCircle,
    color: 'text-green-500',
  },
  {
    value: 'warning',
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-yellow-500',
  },
  { value: 'error', label: 'Error', icon: AlertCircle, color: 'text-red-500' },
];

const priorityOptions: { value: NotificationPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const segmentOptions: {
  value: TargetSegment;
  label: string;
  description: string;
}[] = [
  {
    value: 'new',
    label: 'New Merchants',
    description: 'Merchants who joined in the last 30 days',
  },
  {
    value: 'active',
    label: 'Active Merchants',
    description: 'Merchants with recent activity',
  },
  {
    value: 'at_risk',
    label: 'At Risk Merchants',
    description: 'Merchants showing signs of churn',
  },
];

export default function CreateNotificationPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateNotificationInput>({
    title: '',
    message: '',
    notification_type: 'info',
    priority: 'normal',
    target_type: 'all',
    channels: ['in_app'],
  });

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [expiresEnabled, setExpiresEnabled] = useState(false);

  const updateFormData = (updates: Partial<CreateNotificationInput>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const toggleChannel = (channel: NotificationChannel) => {
    const currentChannels = formData.channels || [];
    const newChannels = currentChannels.includes(channel)
      ? currentChannels.filter((c) => c !== channel)
      : [...currentChannels, channel];

    updateFormData({
      channels: newChannels.length > 0 ? newChannels : ['in_app'],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.message.trim()) {
      toast({
        title: 'Error',
        description: 'Message is required',
        variant: 'destructive',
      });
      return;
    }

    if (formData.target_type === 'segment' && !formData.target_segment) {
      toast({
        title: 'Error',
        description: 'Please select a target segment',
        variant: 'destructive',
      });
      return;
    }

    if (scheduleEnabled && !formData.scheduled_for) {
      toast({
        title: 'Error',
        description: 'Please select a schedule date and time',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateNotificationInput = {
        ...formData,
        scheduled_for: scheduleEnabled ? formData.scheduled_for : undefined,
        expires_at: expiresEnabled ? formData.expires_at : undefined,
      };

      const result = await apiPost<CreateNotificationResponse>(
        '/api/admin/notifications',
        payload
      );

      toast({
        title:
          result.status === 'sent'
            ? 'Notification Sent'
            : 'Notification Scheduled',
        description:
          result.status === 'sent'
            ? `Sent to ${result.merchants_notified} merchants`
            : result.scheduled_for
              ? `Scheduled for ${new Date(result.scheduled_for).toLocaleString()}`
              : 'Notification has been scheduled',
      });

      router.push('/admin/notifications');
    } catch (error) {
      console.error('Error creating notification:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create notification',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/notifications">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create Notification
          </h1>
          <p className="text-muted-foreground">
            Send a notification to your merchants
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Write the notification message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter notification title"
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/200
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Enter notification message"
                value={formData.message}
                onChange={(e) => updateFormData({ message: e.target.value })}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.message.length}/1000
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.notification_type}
                  onValueChange={(value: NotificationType) =>
                    updateFormData({ notification_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon
                            className={cn('h-4 w-4', option.color)}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: NotificationPriority) =>
                    updateFormData({ priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action URL */}
            <div className="space-y-2">
              <Label htmlFor="action_url">Action URL (optional)</Label>
              <Input
                id="action_url"
                type="url"
                placeholder="https://example.com"
                value={formData.action_url || ''}
                onChange={(e) =>
                  updateFormData({ action_url: e.target.value || undefined })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="action_label">Action Label (optional)</Label>
              <Input
                id="action_label"
                placeholder="Learn more"
                value={formData.action_label || ''}
                onChange={(e) =>
                  updateFormData({ action_label: e.target.value || undefined })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Targeting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Targeting
            </CardTitle>
            <CardDescription>
              Choose who will receive this notification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select
                value={formData.target_type}
                onValueChange={(value: TargetType) =>
                  updateFormData({ target_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Merchants</SelectItem>
                  <SelectItem value="segment">Merchant Segment</SelectItem>
                  <SelectItem value="specific">Specific Merchants</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.target_type === 'segment' && (
              <div className="space-y-2">
                <Label>Select Segment</Label>
                <Select
                  value={formData.target_segment || ''}
                  onValueChange={(value: TargetSegment) =>
                    updateFormData({ target_segment: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <p className="font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.target_type === 'specific' && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Specific merchant targeting coming soon. For now, use segments
                  or target all merchants.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Delivery
            </CardTitle>
            <CardDescription>Configure how and when to send</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Channels */}
            <div className="space-y-3">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-4">
                <Label className="flex items-center gap-2 cursor-pointer font-normal">
                  <Checkbox
                    checked={formData.channels?.includes('in_app')}
                    onCheckedChange={() => toggleChannel('in_app')}
                  />
                  <span className="text-sm">In-app Notification</span>
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer font-normal">
                  <Checkbox
                    checked={formData.channels?.includes('banner')}
                    onCheckedChange={() => toggleChannel('banner')}
                  />
                  <span className="text-sm">Site Banner</span>
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer font-normal">
                  <Checkbox
                    checked={formData.channels?.includes('push')}
                    onCheckedChange={() => toggleChannel('push')}
                  />
                  <span className="text-sm">📱 Push Notification</span>
                </Label>
              </div>
              {formData.channels?.includes('push') && (
                <p className="text-xs text-muted-foreground">
                  Push notifications will be sent to merchants who have the
                  mobile admin app installed.
                </p>
              )}
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="schedule"
                  checked={scheduleEnabled}
                  onCheckedChange={(checked) => setScheduleEnabled(!!checked)}
                />
                <Label htmlFor="schedule" className="cursor-pointer">
                  Schedule for later
                </Label>
              </div>
              {scheduleEnabled && (
                <Input
                  type="datetime-local"
                  value={formData.scheduled_for || ''}
                  onChange={(e) =>
                    updateFormData({ scheduled_for: e.target.value })
                  }
                  min={new Date(
                    Date.now() - new Date().getTimezoneOffset() * 60000
                  )
                    .toISOString()
                    .slice(0, 16)}
                />
              )}
            </div>

            {/* Expiration */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="expires"
                  checked={expiresEnabled}
                  onCheckedChange={(checked) => setExpiresEnabled(!!checked)}
                />
                <Label htmlFor="expires" className="cursor-pointer">
                  Set expiration date
                </Label>
              </div>
              {expiresEnabled && (
                <Input
                  type="datetime-local"
                  value={formData.expires_at || ''}
                  onChange={(e) =>
                    updateFormData({ expires_at: e.target.value })
                  }
                  min={new Date(
                    Date.now() - new Date().getTimezoneOffset() * 60000
                  )
                    .toISOString()
                    .slice(0, 16)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start gap-3">
                {(() => {
                  const typeOption = typeOptions.find(
                    (t) => t.value === formData.notification_type
                  );
                  const Icon = typeOption?.icon || Info;
                  return (
                    <Icon className={cn('h-5 w-5 mt-0.5', typeOption?.color)} />
                  );
                })()}
                <div className="flex-1">
                  <h4 className="font-medium">
                    {formData.title || 'Notification Title'}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formData.message ||
                      'Notification message will appear here...'}
                  </p>
                  {formData.action_label && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto mt-2"
                    >
                      {formData.action_label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/notifications">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {scheduleEnabled ? 'Scheduling...' : 'Sending...'}
              </>
            ) : scheduleEnabled ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Schedule Notification
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Now
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
