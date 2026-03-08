import { Calendar, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BlogPostHeaderProps {
  author_bio?: string | null;
  author_name?: string | null;
  author_title?: string | null;
  category?: string | null;
  locale?: string;
  published_at?: string | null;
  reading_time_minutes?: number | null;
  title: string;
}

export function BlogPostHeader({
  author_bio,
  author_name,
  author_title,
  category,
  locale,
  published_at,
  reading_time_minutes,
  title,
}: BlogPostHeaderProps) {
  const resolvedLocale = locale?.trim() || undefined;

  return (
    <header className="mb-8">
      {category && (
        <Badge variant="secondary" className="mb-4">
          {category}
        </Badge>
      )}
      <h1 className="mb-4 text-3xl font-bold md:text-4xl">{title}</h1>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {author_name && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>{author_name}</span>
            {author_title && <span className="text-xs">({author_title})</span>}
          </div>
        )}
        {published_at && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <time dateTime={published_at}>
              {new Date(published_at).toLocaleDateString(resolvedLocale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
        )}
        {reading_time_minutes && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{reading_time_minutes} min read</span>
          </div>
        )}
      </div>

      {author_name && author_bio && (
        <div className="mt-4 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">{author_bio}</p>
        </div>
      )}
    </header>
  );
}
