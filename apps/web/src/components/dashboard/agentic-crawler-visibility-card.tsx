'use client';

import { AlertTriangle, Bot, CheckCircle2, Clock3, Radar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CrawlerLogSummary } from '@/lib/agentic/crawler-observability';

type CrawlerVisibilityState = 'ready' | 'error' | 'unauthorized';

interface AgenticCrawlerVisibilityCardProps {
  state: CrawlerVisibilityState;
  summary: CrawlerLogSummary | null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No agent visits yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getHealthTone(summary: CrawlerLogSummary) {
  if (summary.health.failedCrawls > 0) {
    return {
      badge: 'Needs attention',
      description:
        'Agent and crawler visits are reaching pages with failing responses.',
      icon: AlertTriangle,
      variant: 'destructive' as const,
    };
  }

  if (summary.health.slowCrawls > 0 || summary.health.cacheMissCrawls > 0) {
    return {
      badge: 'Monitor',
      description:
        'Agent visibility is active, with cache misses or slow responses to watch.',
      icon: Clock3,
      variant: 'outline' as const,
    };
  }

  if (summary.totalCrawls === 0) {
    return {
      badge: 'Waiting',
      description:
        'Crawler logging is ready, but no agent visits are logged in this window.',
      icon: Radar,
      variant: 'outline' as const,
    };
  }

  return {
    badge: 'Healthy',
    description: 'Agent and crawler visibility is healthy in this window.',
    icon: CheckCircle2,
    variant: 'secondary' as const,
  };
}

function formatStatus(statusCode: number | null) {
  if (statusCode == null) return 'status unknown';
  if (statusCode >= 500) return `server error ${statusCode}`;
  if (statusCode >= 400) return `client error ${statusCode}`;
  return `status ${statusCode}`;
}

export function AgenticCrawlerVisibilityCard({
  state,
  summary,
}: AgenticCrawlerVisibilityCardProps) {
  if (state === 'unauthorized') return null;

  if (state === 'error' || !summary) {
    return (
      <Card className="border-border/70">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="h-5 w-5 text-primary" />
            Agent crawler visibility
          </CardTitle>
          <CardDescription>
            Crawler visibility is temporarily unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
            <p className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Unable to load crawler activity right now.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tone = getHealthTone(summary);
  const Icon = tone.icon;
  const topBots = summary.byBot.slice(0, 4);
  const topPages = summary.topPages.slice(0, 4);
  const recent = summary.recent.slice(0, 3);

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="h-5 w-5 text-primary" />
              Agent crawler visibility
            </CardTitle>
            <CardDescription>{tone.description}</CardDescription>
          </div>
          <Badge variant={tone.variant}>
            <Icon className="mr-1 h-3.5 w-3.5" />
            {tone.badge}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              AI agent crawls
            </p>
            <p className="text-2xl font-semibold">
              {summary.health.aiAgentCrawls.toLocaleString('en-US')}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Total crawls
            </p>
            <p className="text-2xl font-semibold">
              {summary.totalCrawls.toLocaleString('en-US')}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Last agent visit
            </p>
            <p className="text-sm font-medium">
              {formatDateTime(summary.health.lastAgentCrawlAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Top crawlers
            </p>
            {topBots.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm">
                {topBots.map((bot) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={`${bot.family}:${bot.name}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{bot.name}</span>
                    </span>
                    <Badge variant="outline">
                      {bot.count.toLocaleString('en-US')}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No crawlers logged in the last {summary.windowDays} days.
              </p>
            )}
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Top pages
            </p>
            {topPages.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm">
                {topPages.map((page) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={page.path}
                  >
                    <span className="truncate">{page.path}</span>
                    <Badge variant="outline">
                      {page.count.toLocaleString('en-US')}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No crawled pages logged in this window.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Health signals
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge
              variant={
                summary.health.failedCrawls > 0 ? 'destructive' : 'secondary'
              }
            >
              {summary.health.failedCrawls.toLocaleString('en-US')} failed
            </Badge>
            <Badge
              variant={summary.health.slowCrawls > 0 ? 'outline' : 'secondary'}
            >
              {summary.health.slowCrawls.toLocaleString('en-US')} slow
            </Badge>
            <Badge
              variant={
                summary.health.cacheMissCrawls > 0 ? 'outline' : 'secondary'
              }
            >
              {summary.health.cacheMissCrawls.toLocaleString('en-US')} cache
              misses
            </Badge>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Recent crawler activity
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {recent.map((row) => (
                <li key={`${row.crawled_at}-${row.url_path}-${row.user_agent}`}>
                  <span className="font-medium text-foreground">
                    {row.bot_name ?? 'Unknown crawler'}
                  </span>{' '}
                  visited{' '}
                  <span className="text-foreground">{row.url_path}</span> with{' '}
                  {formatStatus(row.status_code)}.
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
