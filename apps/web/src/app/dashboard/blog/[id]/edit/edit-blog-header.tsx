import { format } from 'date-fns';
import {
  Archive,
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Eye,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { asRoute } from '@/lib/routes';
import { isSafeSlug } from '@/lib/validate-slug';
import type {
  BlogPost,
  MerchantPreviewData,
  PostFormData,
} from './edit-blog-types';

export function EditBlogHeader({
  formData,
  merchant,
  originalPost,
  isSaving,
  scheduledDate,
  setScheduledDate,
  savePost,
  onPreview,
  onSuggestSchedule,
  wordCount,
  readingTime,
}: {
  formData: PostFormData;
  merchant: MerchantPreviewData | null;
  originalPost: BlogPost | null;
  isSaving: boolean;
  scheduledDate?: Date;
  setScheduledDate: (value: Date | undefined) => void;
  savePost: (status?: PostFormData['status']) => Promise<boolean>;
  onPreview: () => Promise<void>;
  onSuggestSchedule: () => void;
  wordCount: number;
  readingTime: number;
}) {
  const [isSchedulePopoverOpen, setIsSchedulePopoverOpen] = useState(false);
  const statusVariant = {
    published: 'default',
    draft: 'secondary',
    archived: 'outline',
    scheduled: 'destructive',
  } as const;
  const handleTime = (value: string) => {
    const [hours, minutes] = value.split(':');
    const nextDate = scheduledDate ? new Date(scheduledDate) : new Date();
    nextDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10));
    setScheduledDate(nextDate);
  };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={asRoute('/dashboard/blog')}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Edit Post</h1>
            <Badge variant={statusVariant[formData.status]}>
              {formData.status.charAt(0).toUpperCase() +
                formData.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {wordCount} words | {readingTime} min read
            {originalPost?.view_count
              ? ` | ${originalPost.view_count} views`
              : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onPreview} disabled={isSaving}>
          {isSaving ? <BagLoader size={16} /> : <Eye className="size-4 mr-2" />}
          Preview
        </Button>
        {formData.status === 'published' &&
          merchant?.slug &&
          isSafeSlug(merchant.slug) && (
            <Button variant="outline" asChild>
              <a
                href={
                  merchant.custom_domain
                    ? `https://${merchant.custom_domain.replace(/\/$/, '')}/blog/${encodeURIComponent(formData.slug)}`
                    : `/${encodeURIComponent(merchant.slug)}/blog/${encodeURIComponent(formData.slug)}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4 mr-2" />
                View Live
              </a>
            </Button>
          )}
        <Button
          variant="outline"
          onClick={() => savePost()}
          disabled={isSaving}
        >
          {isSaving ? (
            <BagLoader size={16} />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Save Changes
        </Button>
        {(formData.status === 'draft' || formData.status === 'scheduled') && (
          <Popover
            open={isSchedulePopoverOpen}
            onOpenChange={setIsSchedulePopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={isSaving}>
                <CalendarIcon className="size-4 mr-2" />
                {formData.status === 'scheduled' && scheduledDate
                  ? `Scheduled: ${format(scheduledDate, 'MMM d, HH:mm')}`
                  : 'Schedule'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Publish Date & Time
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSuggestSchedule}
                    className="h-7 text-[10px] px-2 text-primary"
                  >
                    <Sparkles className="size-3 mr-1" />
                    AI Suggest
                  </Button>
                </div>
                <Calendar
                  selected={scheduledDate || null}
                  onSelect={(date: Date | null) =>
                    setScheduledDate(date || undefined)
                  }
                  minDate={new Date()}
                />
                <div className="flex items-center gap-2 border-t pt-4">
                  <Clock className="size-4 text-muted-foreground ml-2" />
                  <Input
                    type="time"
                    className="h-8 py-1"
                    value={scheduledDate ? format(scheduledDate, 'HH:mm') : ''}
                    onChange={(event) => handleTime(event.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={!scheduledDate || isSaving}
                  onClick={() => {
                    void savePost('scheduled');
                    setIsSchedulePopoverOpen(false);
                  }}
                >
                  Confirm Schedule
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {formData.status === 'draft' && (
          <Button
            onClick={() => void savePost('published')}
            disabled={isSaving}
          >
            {isSaving ? (
              <BagLoader size={16} />
            ) : (
              <Send className="size-4 mr-2" />
            )}
            Publish Now
          </Button>
        )}
        {formData.status === 'published' && (
          <Button
            variant="secondary"
            onClick={() => void savePost('draft')}
            disabled={isSaving}
          >
            Unpublish
          </Button>
        )}
        {formData.status !== 'archived' && (
          <Button
            variant="ghost"
            onClick={() => void savePost('archived')}
            disabled={isSaving}
          >
            <Archive className="size-4 mr-2" />
            Archive
          </Button>
        )}
      </div>
    </div>
  );
}
