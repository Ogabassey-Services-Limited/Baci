import { Puck } from '@puckeditor/core';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { GeminiCommandBar } from '@/components/builder/gemini-command-bar';
import { CartProvider } from '@/hooks/use-cart';

interface BuilderCanvasProps {
  canEdit: boolean;
  isAiDraftPreview: boolean;
  isAiLoading: boolean;
  onAiCommand: (command: string) => void;
  onViewportWidthChange: (width: string | number) => void;
  viewportWidth: string | number;
}

const viewports = [
  { width: 375, label: 'Mobile', Icon: Smartphone },
  { width: 768, label: 'Tablet', Icon: Tablet },
  { width: 1200, label: 'Desktop', Icon: Monitor },
];

export function BuilderCanvas(props: BuilderCanvasProps) {
  const {
    canEdit,
    isAiDraftPreview,
    isAiLoading,
    onAiCommand,
    onViewportWidthChange,
    viewportWidth,
  } = props;
  return (
    <div className="flex-1 relative bg-accent/5 flex flex-col overflow-hidden">
      {isAiDraftPreview && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          AI draft preview. Review the design before applying it to your
          editable store draft.
        </div>
      )}
      <div className="h-12 bg-white border-b flex items-center justify-center gap-2 px-4 shrink-0">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {viewports.map(({ width, label, Icon }) => (
            <button
              key={width}
              type="button"
              onClick={() => onViewportWidthChange(width)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${
                viewportWidth === width
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-white'
              }`}
              title={`${label} (${width}px)`}
            >
              <Icon className="size-4 text-primary" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div
          className="h-full bg-white shadow-sm mx-auto transition-all duration-300"
          style={{ width: viewportWidth, maxWidth: '100%' }}
        >
          <CartProvider>
            <Puck.Preview />
          </CartProvider>
        </div>
      </div>
      <GeminiCommandBar
        onCommand={onAiCommand}
        isLoading={isAiLoading}
        disabled={!canEdit}
      />
    </div>
  );
}
