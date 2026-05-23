'use client';

import { Bot, Radar, ShieldCheck } from 'lucide-react';
import { AgenticActionCenterCard } from '@/components/dashboard/agentic-action-center-card';
import { AgenticCrawlerVisibilityCard } from '@/components/dashboard/agentic-crawler-visibility-card';
import { AgenticTrustCenterCard } from '@/components/dashboard/agentic-trust-center-card';
import { AgentCommerceControlsCard } from '@/components/dashboard/integrations/agent-commerce-controls-card';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CrawlerLogSummary } from '@/lib/agentic/crawler-observability';
import type { AgentCommerceTrustReadinessSummary } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import type { AgenticActionHealthPayload } from '@/schemas/agentic-action-health';
import type { AgenticCenterState, AgenticControlsState } from './data';

interface AgenticDashboardClientPageProps {
  agentControls: AgenticControlsState | null;
  actionCenterState: AgenticCenterState;
  actionHealth: AgenticActionHealthPayload | null;
  crawlerCenterState: AgenticCenterState;
  crawlerSummary: CrawlerLogSummary | null;
  isPublished: boolean;
  trustCenterState: AgenticCenterState;
  trustReadiness: AgentCommerceTrustReadinessSummary | null;
}

export default function AgenticDashboardClientPage({
  agentControls,
  actionCenterState,
  actionHealth,
  crawlerCenterState,
  crawlerSummary,
  isPublished,
  trustCenterState,
  trustReadiness,
}: AgenticDashboardClientPageProps) {
  const isActionUnauthorized = actionCenterState === 'unauthorized';
  const isCrawlerUnauthorized = crawlerCenterState === 'unauthorized';
  const isTrustUnauthorized = trustCenterState === 'unauthorized';
  const isUnauthorized =
    isActionUnauthorized && isCrawlerUnauthorized && isTrustUnauthorized;
  const showActionCenter = !isActionUnauthorized;
  const showCrawlerCenter = !isCrawlerUnauthorized;
  const showTrustCenter = !isTrustUnauthorized;
  const defaultTab = showActionCenter
    ? 'actions'
    : showTrustCenter
      ? 'trust'
      : 'crawler';

  return (
    <div className="space-y-6 p-3 pb-24 md:p-6 md:pb-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Agentic commerce</h1>
        <p className="text-muted-foreground">
          Monitor agent checkout reliability and trust readiness from one
          operations surface.
        </p>
      </div>

      {isUnauthorized ? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              Agentic centers are unavailable
            </CardTitle>
            <CardDescription>
              We could not verify merchant access for these agentic commerce
              checks. Sign in again or review your dashboard permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !isPublished ? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              Agentic centers are paused
            </CardTitle>
            <CardDescription>
              Publish your storefront before agent checkout and trust readiness
              checks appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList aria-label="Agentic commerce center tabs">
            {showActionCenter && (
              <TabsTrigger value="actions">
                <Bot className="mr-2 h-4 w-4" />
                Action center
              </TabsTrigger>
            )}
            {showTrustCenter && (
              <TabsTrigger value="trust">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Trust center
              </TabsTrigger>
            )}
            {showCrawlerCenter && (
              <TabsTrigger value="crawler">
                <Radar className="mr-2 h-4 w-4" />
                Crawler visibility
              </TabsTrigger>
            )}
          </TabsList>

          {showActionCenter && (
            <TabsContent value="actions" className="space-y-4">
              <AgenticActionCenterCard
                payload={actionHealth}
                state={actionCenterState}
              />
              {agentControls ? (
                <AgentCommerceControlsCard
                  initialCustomSettings={agentControls.customSettings}
                  initialEnabled={agentControls.enabled}
                />
              ) : null}
            </TabsContent>
          )}

          {showTrustCenter && (
            <TabsContent value="trust" className="space-y-4">
              <AgenticTrustCenterCard
                readiness={trustReadiness}
                state={trustCenterState}
              />
            </TabsContent>
          )}

          {showCrawlerCenter && (
            <TabsContent value="crawler" className="space-y-4">
              <AgenticCrawlerVisibilityCard
                state={crawlerCenterState}
                summary={crawlerSummary}
              />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
