const BLOG_LIST_DATE_FORMATTER = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

export function formatBlogListDateLabel(publishedAt: string): string | null {
  const publishedDate = new Date(publishedAt);
  if (Number.isNaN(publishedDate.getTime())) {
    return null;
  }

  return BLOG_LIST_DATE_FORMATTER.format(publishedDate);
}
