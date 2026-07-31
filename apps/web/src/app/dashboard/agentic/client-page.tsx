'use client';

import { Bot, Radar, ShieldCheck, ShoppingCart } from 'lucide-react';
import { AgenticActionCenterCard } from '@/components/dashboard/agentic-action-center-card';
import { AgenticCrawlerVisibilityCard } from '@/components/dashboard/agentic-crawler-visibility-card';
import { AgenticTrustCenterCard } from '@/components/dashboard/agentic-trust-center-card';
import { AgentCommerceControlsCard } from '@/components/dashboard/integrations/agent-commerce-controls-card';
import { UniversalCartReadinessCard } from '@/components/dashboard/universal-cart-readiness-card';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { UniversalCartReadinessResult } from '@/lib/agentic/agent-commerce-health-monitor';
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
  merchantId: string | null;
  trustCenterState: AgenticCenterState;
  trustReadiness: AgentCommerceTrustReadinessSummary | null;
  universalCartReadiness: UniversalCartReadinessResult | null;
}

export default function AgenticDashboardClientPage({
  agentControls,
  actionCenterState,
  actionHealth,
  crawlerCenterState,
  crawlerSummary,
  isPublished,
  merchantId,
  trustCenterState,
  trustReadiness,
  universalCartReadiness,
}: AgenticDashboardClientPageProps) {
  const isActionUnauthorized = actionCenterState === 'unauthorized';
  const isCrawlerUnauthorized = crawlerCenterState === 'unauthorized';
  const isTrustUnauthorized = trustCenterState === 'unauthorized';
  const isUnauthorized =
    isActionUnauthorized && isCrawlerUnauthorized && isTrustUnauthorized;
  const showActionCenter = !isActionUnauthorized;
  const showCrawlerCenter = !isCrawlerUnauthorized;
  const showTrustCenter = !isTrustUnauthorized;
  const showUniversalCart = Boolean(universalCartReadiness);
  const defaultTab = showActionCenter
    ? 'actions'
    : showTrustCenter
      ? 'trust'
      : showUniversalCart
        ? 'universal-cart'
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
              <Bot className="size-5 text-primary" />
              Agentic centers are unavailable
            </CardTitle>
            <CardDescription>
              We could not verify merchant access for these agentic commerce
              checks. Sign in again or review your dashboard permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !isPublished ? (
        <div className="space-y-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-5 text-primary" />
                Agentic centers are paused
              </CardTitle>
              <CardDescription>
                Publish your storefront before agent checkout and trust
                readiness checks appear here.
              </CardDescription>
            </CardHeader>
          </Card>
          {agentControls && merchantId ? (
            <AgentCommerceControlsCard
              initialCustomSettings={agentControls.customSettings}
              initialEnabled={agentControls.enabled}
              merchantId={merchantId}
            />
          ) : null}
        </div>
      ) : (
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList aria-label="Agentic commerce center tabs">
            {showActionCenter && (
              <TabsTrigger value="actions">
                <Bot className="mr-2 size-4" />
                Action center
              </TabsTrigger>
            )}
            {showTrustCenter && (
              <TabsTrigger value="trust">
                <ShieldCheck className="mr-2 size-4" />
                Trust center
              </TabsTrigger>
            )}
            {showUniversalCart && (
              <TabsTrigger value="universal-cart">
                <ShoppingCart className="mr-2 size-4" />
                Universal Cart
              </TabsTrigger>
            )}
            {showCrawlerCenter && (
              <TabsTrigger value="crawler">
                <Radar className="mr-2 size-4" />
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
              {agentControls && merchantId ? (
                <AgentCommerceControlsCard
                  initialCustomSettings={agentControls.customSettings}
                  initialEnabled={agentControls.enabled}
                  merchantId={merchantId}
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

          {showUniversalCart && (
            <TabsContent value="universal-cart" className="space-y-4">
              <UniversalCartReadinessCard readiness={universalCartReadiness} />
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
