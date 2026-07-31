import { Puck } from '@puckeditor/core';
import { Loader2 } from 'lucide-react';
import { builderConfig } from '@/components/builder/config';
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
import { Button } from '@/components/ui/button';
import { BuilderCanvas } from './builder-canvas';
import { getDegradedBuilderDescription } from './builder-descriptions';
import { BuilderEditorHeader } from './builder-editor-header';
import { createBuilderPuckOverrides } from './builder-puck-overrides';
import { BuilderSidebarPanel } from './builder-sidebar-panel';
import type { useBuilderClientController } from './use-builder-client-controller';

interface BuilderClientViewProps {
  controller: ReturnType<typeof useBuilderClientController>;
}

export function BuilderClientView({ controller }: BuilderClientViewProps) {
  const c = controller;
  if (c.authLoading || c.merchantLoading || c.pageLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!c.user || !c.merchant) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Redirecting to login…</p>
      </div>
    );
  }

  const overrides = createBuilderPuckOverrides({
    data: c.data,
    onDataChange: c.setData,
    onEdit: () => c.setShowFieldsSidebar(true),
  });

  return (
    <div className="h-screen flex flex-col bg-background">
      <AlertDialog
        open={c.showStaleAiDraftDialog}
        onOpenChange={c.setShowStaleAiDraftDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your starter draft changed after this AI design was generated.
              Replace the current starter draft with the AI design?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                c.setShowStaleAiDraftDialog(false);
                void c.applyAiDraft(true);
              }}
            >
              Replace draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Puck
        config={builderConfig}
        data={c.data}
        onPublish={c.handlePublish}
        onChange={c.handleDataChange}
        metadata={{
          merchantId: c.merchant.id,
          merchant: c.merchant,
          products: [],
        }}
        overrides={overrides}
      >
        <div className="flex flex-col h-screen bg-background">
          <BuilderEditorHeader
            applyingAiDraft={c.applyingAiDraft}
            canApplyAiDraft={c.canApplyAiDraft}
            canEdit={c.canEdit}
            isAiDraftPreview={c.isAiDraftPreview}
            onApplyAiDraft={() => void c.applyAiDraft()}
            onPublish={c.handlePublish}
            onSave={() => c.handleSave(c.data)}
            publishing={c.publishing}
            saving={c.saving}
          />
          <div className="flex-1 overflow-hidden flex relative">
            <div
              className={`flex flex-1 overflow-hidden ${
                c.shouldBlockBuilder
                  ? 'pointer-events-none opacity-60 select-none'
                  : ''
              }`}
            >
              <BuilderSidebarPanel
                canEdit={c.canEdit}
                data={c.data}
                isAiLoading={c.isAiLoading}
                onAiCommand={c.handleAiCommand}
                onSeoChange={c.setSeoData}
                onSetupChange={c.setSetupSettings}
                onStoreChange={c.setStoreSettings}
                onThemeChange={c.setTheme}
                seoData={c.seoData}
                setupSettings={c.setupSettings}
                storeSettings={c.storeSettings}
              />
              <BuilderCanvas
                canEdit={c.canEdit}
                isAiDraftPreview={c.isAiDraftPreview}
                isAiLoading={c.isAiLoading}
                onAiCommand={c.handleAiCommand}
                onViewportWidthChange={c.setViewportWidth}
                viewportWidth={c.viewportWidth}
              />
              {c.showFieldsSidebar && (
                <div className="w-[320px] bg-white border-l flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
                  <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Properties
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0"
                      onClick={() => c.setShowFieldsSidebar(false)}
                    >
                      <span className="sr-only">Close</span>
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <Puck.Fields />
                  </div>
                </div>
              )}
            </div>
            {c.shouldBlockBuilder && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-xs">
                <div className="max-w-md rounded-xl border bg-background p-6 text-center shadow-lg">
                  <h2 className="text-lg font-semibold">
                    Builder is in read-only mode
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {getDegradedBuilderDescription(c.degradedReason)}
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Reload Builder
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Puck>
    </div>
  );
}
