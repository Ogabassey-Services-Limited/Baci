'use client';

import { type Data, Puck, usePuck } from '@puckeditor/core';
import { Button } from '@/components/ui/button';
import '@puckeditor/core/puck.css';
import { ArrowLeft, Check, LayoutTemplate, Loader2, Lock } from 'lucide-react';
import { Component, type ReactNode, useEffect, useState } from 'react';
import { builderConfig } from '@/components/builder/config';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { BrandColors } from '@/types';
import { FloatingControls } from './builder/floating-controls';

interface OnboardingTemplateEditorProps {
  initialData: Data;
  brandColors: BrandColors | null;
  onSave: (data: Data) => void;
  onClose: () => void;
  businessName: string;
}

import { getTemplateData, TEMPLATES } from '@/config/templates';

// Internal header component to access Puck context
const CustomPuckHeader = ({
  onClose,
  businessName,
  onPublish,
  isSaving,
  onOpenTemplates,
}: {
  onClose: () => void;
  businessName: string;
  onPublish: (data: Data) => void;
  isSaving: boolean;
  onOpenTemplates: () => void;
}) => {
  // usePuck hook gives access to the current state and dispatch
  const { appState } = usePuck();
  const { data } = appState;

  return (
    <header className="h-16 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-md shrink-0 z-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="h-6 w-px bg-border" />
        <h2 className="font-semibold text-lg">Editing {businessName}</h2>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onOpenTemplates}>
          <LayoutTemplate className="mr-2 h-4 w-4" />
          Templates
        </Button>
        <Button onClick={() => onPublish(data)} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue Onboarding
        </Button>
      </div>
    </header>
  );
};

class EditorErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Editor critical error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-100 bg-background flex items-center justify-center p-8">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm">
              The editor encountered an unexpected error.
            </p>
            <div className="p-4 bg-muted rounded-md text-left text-xs font-mono overflow-auto max-h-32">
              {this.state.error?.message}
            </div>
            <Button onClick={this.props.onClose}>Close Editor</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

class FloatingControlsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('FloatingControls error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export function OnboardingTemplateEditor({
  initialData,
  brandColors: _brandColors, // Reserved for future theme customization
  onSave,
  onClose,
  businessName,
}: OnboardingTemplateEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [currentData, setCurrentData] = useState<Data>(initialData);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] =
    useState('modern-minimal');

  // Get template data mapping from shared config
  const templateDataMap = getTemplateData(businessName);

  // Update currentData when initialData changes (if needed)
  useEffect(() => {
    // Only reset if we haven't selected a template yet or if initialData is meaningful
    if (selectedTemplateId === 'modern-minimal') {
      setCurrentData(initialData);
    }
  }, [initialData, selectedTemplateId]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);

    const templateData = templateDataMap[templateId];
    if (templateData) {
      setCurrentData(templateData);
    }

    setIsTemplatesOpen(false);
  };

  const handlePublish = async (data: Data) => {
    setIsSaving(true);
    try {
      // Simulate save delay or actual save logic if needed
      await new Promise((resolve) => setTimeout(resolve, 500));
      onSave(data);
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 bg-background flex flex-col animate-in fade-in duration-300">
      <div
        className="flex-1 overflow-hidden relative"
        id="puck-editor-container"
      >
        <EditorErrorBoundary onClose={onClose}>
          <Puck
            config={builderConfig}
            data={currentData}
            onPublish={handlePublish}
            headerTitle={businessName}
            headerPath={businessName}
            overrides={{
              header: () => (
                <>
                  <CustomPuckHeader
                    onClose={onClose}
                    businessName={businessName}
                    onPublish={handlePublish}
                    isSaving={isSaving}
                    onOpenTemplates={() => setIsTemplatesOpen(true)}
                  />
                  <FloatingControlsErrorBoundary>
                    <FloatingControls />
                  </FloatingControlsErrorBoundary>
                </>
              ),
            }}
            ui={{
              leftSideBarVisible: false,
              rightSideBarVisible: false,
              // The user said "edits happening on the side panel".
              // Components panel is usually on the left.
              // If we hide it, user can't add new components.
              // Let's keep left sidebar for now, or hide it and provide a way to open it?
              // The user specifically complained about "edits happening on the side panel".
              // This usually refers to the right sidebar (properties).
              // So let's hide rightSideBarVisible.
              // leftSideBarVisible defaults to true.
            }}
          />
        </EditorErrorBoundary>
      </div>

      <Sheet open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <SheetContent
          side="right"
          className="w-[400px] sm:w-[540px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Choose a Template</SheetTitle>
            <SheetDescription>
              Select a starting point for your store. You can customize it
              further in the editor.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            {TEMPLATES.map((template) => (
              <button
                type="button"
                key={template.id}
                className={cn(
                  'relative flex flex-col gap-2 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-all text-left',
                  selectedTemplateId === template.id &&
                    'border-primary bg-muted/20 ring-1 ring-primary'
                )}
                onClick={() => handleTemplateSelect(template.id)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.isPremium ? (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                    >
                      <Lock className="w-3 h-3 mr-1" /> Premium
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
                {selectedTemplateId === template.id && (
                  <div className="absolute top-4 right-4">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
