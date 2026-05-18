'use client';

import { Bot, ShieldCheck } from 'lucide-react';
import { AgenticActionCenterCard } from '@/components/dashboard/agentic-action-center-card';
import { AgenticTrustCenterCard } from '@/components/dashboard/agentic-trust-center-card';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AgentCommerceTrustReadinessSummary } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import type { AgenticActionHealthPayload } from '@/schemas/agentic-action-health';
import type { AgenticCenterState } from './data';

interface AgenticDashboardClientPageProps {
  actionCenterState: AgenticCenterState;
  actionHealth: AgenticActionHealthPayload | null;
  isPublished: boolean;
  trustCenterState: AgenticCenterState;
  trustReadiness: AgentCommerceTrustReadinessSummary | null;
}

export default function AgenticDashboardClientPage({
  actionCenterState,
  actionHealth,
  isPublished,
  trustCenterState,
  trustReadiness,
}: AgenticDashboardClientPageProps) {
  return (
    <div className="space-y-6 p-3 pb-24 md:p-6 md:pb-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Agentic commerce</h1>
        <p className="text-muted-foreground">
          Monitor agent checkout reliability and trust readiness from one
          operations surface.
        </p>
      </div>

      {!isPublished ? (
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
        <Tabs defaultValue="actions" className="space-y-4">
          <TabsList aria-label="Agentic commerce center tabs">
            <TabsTrigger value="actions">
              <Bot className="mr-2 h-4 w-4" />
              Action center
            </TabsTrigger>
            <TabsTrigger value="trust">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Trust center
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-4">
            <AgenticActionCenterCard
              payload={actionHealth}
              state={actionCenterState}
            />
          </TabsContent>

          <TabsContent value="trust" className="space-y-4">
            <AgenticTrustCenterCard
              readiness={trustReadiness}
              state={trustCenterState}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
