import { ArrowLeft, Globe, Loader2, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BuilderEditorHeaderProps {
  applyingAiDraft: boolean;
  canApplyAiDraft: boolean;
  canEdit: boolean;
  isAiDraftPreview: boolean;
  onApplyAiDraft: () => void;
  onPublish: () => void;
  onSave: () => void;
  publishing: boolean;
  saving: boolean;
}

export function BuilderEditorHeader(props: BuilderEditorHeaderProps) {
  const {
    applyingAiDraft,
    canApplyAiDraft,
    canEdit,
    isAiDraftPreview,
    onApplyAiDraft,
    onPublish,
    onSave,
    publishing,
    saving,
  } = props;
  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur-sm z-10 shrink-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild className="size-9">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to Dashboard</span>
          </Link>
        </Button>
        <span className="font-semibold text-lg ml-2">Website Builder</span>
      </div>
      <div className="flex items-center gap-2">
        {!canEdit && (
          <div
            className={`hidden md:flex rounded-full border px-3 py-1 text-xs font-medium ${
              isAiDraftPreview
                ? 'border-sky-300 bg-sky-50 text-sky-800'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {isAiDraftPreview ? 'AI draft preview' : 'Read-only recovery mode'}
          </div>
        )}
        {isAiDraftPreview && canApplyAiDraft && (
          <Button
            size="sm"
            onClick={onApplyAiDraft}
            disabled={applyingAiDraft}
            className="h-9"
          >
            {applyingAiDraft ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            <span className="ml-2 hidden sm:inline">Apply AI design</span>
          </Button>
        )}
        {!isAiDraftPreview && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={saving || publishing || !canEdit}
              className="h-9"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span className="ml-2 hidden sm:inline">Save Draft</span>
            </Button>
            <Button
              size="sm"
              onClick={onPublish}
              disabled={saving || publishing || !canEdit}
              className="h-9"
            >
              {publishing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Globe className="size-4" />
              )}
              <span className="ml-2 hidden sm:inline">Publish</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
