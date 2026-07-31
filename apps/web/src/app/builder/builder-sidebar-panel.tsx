import { type Data, Puck } from '@puckeditor/core';
import { Sparkles } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { BuilderSidebar } from '@/components/builder/builder-sidebar';
import { GeminiCommandBar } from '@/components/builder/gemini-command-bar';
import { MediaLibrary } from '@/components/builder/media-library';
import { type SEOData, SEOPanel } from '@/components/builder/seo-panel';
import {
  SetupPanel,
  type SetupSettings,
} from '@/components/builder/setup-panel';
import {
  type StoreSettings,
  StoreSettingsPanel,
} from '@/components/builder/store-settings-panel';
import { ThemeEditor } from '@/components/builder/theme-editor-redesigned';
import { defaultTheme, type ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';

const builderSidebarStyles = `
  .PuckSidebarSection-title,.PuckSidebarSection-breadcrumbs{display:none!important}
  .PuckComponentList{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:.75rem!important}
  .PuckComponentList-item{border:1px solid #e5e7eb;border-radius:.75rem;padding:1rem;min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;transition:all .2s}
  .PuckComponentList-item:hover{border-color:hsl(var(--primary));background-color:hsl(var(--primary)/.05)}
  .PuckComponentList-item svg{width:2.5rem!important;height:2.5rem!important;stroke-width:1.5!important;color:#9ca3af}
  .PuckComponentList-item span{font-size:.75rem;font-weight:400;color:#6b7280;margin-top:.625rem;text-align:center}
  .Puck-actionBar,.Puck-badge,[class*="Puck-badge"],[class*="ComponentLabel"],[class*="OverlayLabel"]{display:none!important}
  [class*="ActionBar"],[class*="_ActionBar_"],[class*="_ActionBar-label_"]{opacity:0!important;pointer-events:none!important;height:0!important;width:0!important;overflow:hidden!important;margin:0!important;padding:0!important;min-height:0!important;border:none!important}
  .Puck-overlay{pointer-events:none}.Puck-overlay--isSelected{border:2px solid hsl(var(--primary))!important;box-shadow:0 0 0 3px hsl(var(--primary)/.1)!important}.Puck-overlay>div{pointer-events:auto}
`;

interface BuilderSidebarPanelProps {
  canEdit: boolean;
  data: Data;
  isAiLoading: boolean;
  onAiCommand: (command: string) => void;
  onSeoChange: Dispatch<SetStateAction<SEOData>>;
  onSetupChange: Dispatch<SetStateAction<SetupSettings>>;
  onStoreChange: Dispatch<SetStateAction<StoreSettings>>;
  onThemeChange: (theme: ThemeConfiguration) => void;
  seoData: SEOData;
  setupSettings: SetupSettings;
  storeSettings: StoreSettings;
}

export function BuilderSidebarPanel(props: BuilderSidebarPanelProps) {
  const {
    canEdit,
    data,
    isAiLoading,
    onAiCommand,
    onSeoChange,
    onSetupChange,
    onStoreChange,
    onThemeChange,
    seoData,
    setupSettings,
    storeSettings,
  } = props;
  const theme =
    (data as Data & { theme?: ThemeConfiguration }).theme ?? defaultTheme;

  return (
    <BuilderSidebar
      themeEditor={
        <ThemeEditor
          theme={theme}
          onChange={onThemeChange}
          onReset={() => {
            applyTheme(defaultTheme);
            onThemeChange(defaultTheme);
          }}
        />
      }
      aiTools={
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-linear-to-br from-purple-50 to-blue-50 border-purple-200">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-purple-600" />
              Gemini AI Assistant
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Describe what you want to change and Gemini will update your
              website instantly.
            </p>
            <GeminiCommandBar
              onCommand={onAiCommand}
              isLoading={isAiLoading}
              compact={true}
              disabled={!canEdit}
            />
          </div>
        </div>
      }
      outline={<Puck.Outline />}
      seoPanel={
        <SEOPanel seoData={seoData} onChange={onSeoChange} pagePath="/home" />
      }
      storePanel={
        <StoreSettingsPanel settings={storeSettings} onChange={onStoreChange} />
      }
      setupPanel={
        <SetupPanel settings={setupSettings} onChange={onSetupChange} />
      }
      mediaPanel={<MediaLibrary />}
    >
      <style>{builderSidebarStyles}</style>
      <Puck.Components />
    </BuilderSidebar>
  );
}
