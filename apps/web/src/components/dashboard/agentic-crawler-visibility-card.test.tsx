import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CrawlerLogSummary } from '@/lib/agentic/crawler-observability';
import { AgenticCrawlerVisibilityCard } from './agentic-crawler-visibility-card';

const baseSummary: CrawlerLogSummary = {
  byBot: [
    {
      count: 4,
      family: 'openai',
      lastCrawledAt: '2026-05-20T05:00:00.000Z',
      name: 'OpenAI',
    },
    {
      count: 2,
      family: 'google',
      lastCrawledAt: '2026-05-20T04:58:00.000Z',
      name: 'Google',
    },
  ],
  byDay: [{ count: 6, date: '2026-05-20' }],
  generatedAt: '2026-05-20T05:01:00.000Z',
  health: {
    aiAgentCrawls: 6,
    cacheMissCrawls: 1,
    failedCrawls: 0,
    lastAgentCrawlAt: '2026-05-20T05:00:00.000Z',
    slowCrawls: 0,
  },
  recent: [
    {
      agent_family: 'openai',
      bot_name: 'OpenAI',
      cache_outcome: 'hit',
      crawled_at: '2026-05-20T05:00:00.000Z',
      host: 'ogabassey.com',
      response_time_ms: 124,
      status_code: 200,
      url_path: '/agent-commerce.json',
      user_agent: 'GPTBot/1.0',
    },
  ],
  topPages: [
    { count: 3, path: '/agent-commerce.json' },
    { count: 2, path: '/feeds/openai.jsonl' },
  ],
  totalCrawls: 6,
  windowDays: 14,
};

describe('AgenticCrawlerVisibilityCard', () => {
  it('renders crawler health, bots, pages, and recent activity', () => {
    render(
      <AgenticCrawlerVisibilityCard state="ready" summary={baseSummary} />
    );

    expect(screen.getByText('Agent crawler visibility')).toBeInTheDocument();
    expect(screen.getByText('Monitor')).toBeInTheDocument();
    expect(screen.getByText('AI agent crawls')).toBeInTheDocument();
    expect(screen.getByText('Total crawls')).toBeInTheDocument();
    expect(screen.getAllByText('OpenAI')).toHaveLength(2);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getAllByText('/agent-commerce.json')).toHaveLength(2);
    expect(screen.getByText('/feeds/openai.jsonl')).toBeInTheDocument();
    expect(screen.getByText('0 failed')).toBeInTheDocument();
    expect(screen.getByText('1 cache misses')).toBeInTheDocument();
    expect(screen.getByText(/visited/, { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText(/status 200/, { exact: false })
    ).toBeInTheDocument();
  });

  it('prioritizes failing crawler responses over monitor signals', () => {
    render(
      <AgenticCrawlerVisibilityCard
        state="ready"
        summary={{
          ...baseSummary,
          health: {
            ...baseSummary.health,
            failedCrawls: 2,
            slowCrawls: 1,
          },
        }}
      />
    );

    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Agent and crawler visits are reaching pages with failing responses.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('2 failed')).toBeInTheDocument();
  });

  it('renders waiting copy when no crawler visits are logged', () => {
    render(
      <AgenticCrawlerVisibilityCard
        state="ready"
        summary={{
          ...baseSummary,
          byBot: [],
          health: {
            aiAgentCrawls: 0,
            cacheMissCrawls: 0,
            failedCrawls: 0,
            lastAgentCrawlAt: null,
            slowCrawls: 0,
          },
          recent: [],
          topPages: [],
          totalCrawls: 0,
        }}
      />
    );

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(
      screen.getByText('No crawlers logged in the last 14 days.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No crawled pages logged in this window.')
    ).toBeInTheDocument();
  });

  it('returns null for unauthorized state', () => {
    render(
      <AgenticCrawlerVisibilityCard state="unauthorized" summary={null} />
    );

    expect(
      screen.queryByText('Agent crawler visibility')
    ).not.toBeInTheDocument();
  });

  it('shows unavailable state when crawler visibility cannot load', () => {
    render(<AgenticCrawlerVisibilityCard state="error" summary={null} />);

    expect(screen.getByText('Agent crawler visibility')).toBeInTheDocument();
    expect(
      screen.getByText('Unable to load crawler activity right now.')
    ).toBeInTheDocument();
  });
});
