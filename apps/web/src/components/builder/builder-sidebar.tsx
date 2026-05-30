'use client';

import {
  Image as ImageIcon,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Palette,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Store,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  children: React.ReactNode; // This will be Puck's default components list
  themeEditor: React.ReactNode;
  aiTools?: React.ReactNode;
  outline?: React.ReactNode;
  seoPanel?: React.ReactNode;
  storePanel?: React.ReactNode;
  setupPanel?: React.ReactNode;
  mediaPanel?: React.ReactNode;
}

type ActiveTab =
  | 'elements'
  | 'pages'
  | 'styles'
  | 'ai'
  | 'store'
  | 'seo'
  | 'media'
  | 'more'
  | 'setup'
  | null;

export function BuilderSidebar({
  children,
  themeEditor,
  aiTools,
  outline,
  seoPanel,
  storePanel,
  setupPanel,
  mediaPanel,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('elements');

  const menuItems = [
    { id: 'setup', icon: Settings, label: 'Setup' },
    { id: 'elements', icon: PlusCircle, label: 'Elements' },
    { id: 'media', icon: ImageIcon, label: 'Media' },
    { id: 'pages', icon: Layers, label: 'Pages' },
    { id: 'styles', icon: Palette, label: 'Styles' },
    { id: 'ai', icon: Sparkles, label: 'AI tools' },
    { id: 'seo', icon: Search, label: 'SEO' },
    { id: 'store', icon: Store, label: 'Store' },
    { id: 'more', icon: MoreHorizontal, label: 'More', disabled: true },
  ];

  return (
    <div className="flex h-full bg-white border-r">
      {/* Narrow Navigation Rail */}
      <div className="w-[72px] flex flex-col items-center py-4 border-r bg-white z-20">
        <div className="mb-6">
          {/* Logo placeholder or Home icon */}
          <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
            B
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full px-2">
          {menuItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() =>
                !item.disabled && setActiveTab(item.id as ActiveTab)
              }
              className={cn(
                'flex flex-col items-center justify-center w-full h-[60px] rounded-lg transition-all duration-200 gap-1',
                activeTab === item.id
                  ? 'text-primary bg-primary/5 font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                item.disabled &&
                  'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
              )}
              disabled={item.disabled}
            >
              <item.icon
                className={cn(
                  'size-5',
                  activeTab === item.id && 'fill-current opacity-20'
                )}
              />
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto">
          <button
            type="button"
            className="flex flex-col items-center justify-center w-full h-[60px] text-muted-foreground hover:text-foreground gap-1"
          >
            <MessageSquare className="size-5" />
            <span className="text-[10px]">Feedback</span>
          </button>
        </div>
      </div>

      {/* Drawer Panel */}
      {activeTab && (
        <div className="w-[320px] flex flex-col bg-white h-full animate-in slide-in-from-left-5 duration-200 z-10 shadow-xl border-r">
          {/* Drawer Header */}
          <div className="h-14 px-4 border-b flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-lg">
              {activeTab === 'setup' && 'Setup & Settings'}
              {activeTab === 'elements' && 'Add elements'}
              {activeTab === 'media' && 'Media Library'}
              {activeTab === 'styles' && 'Website styles'}
              {activeTab === 'ai' && 'AI Tools'}
              {activeTab === 'pages' && 'Pages and navigation'}
              {activeTab === 'seo' && 'SEO & Meta Tags'}
              {activeTab === 'store' && 'Store Settings'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setActiveTab(null)}
            >
              <span className="sr-only">Close</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                aria-hidden="true"
              >
                <path
                  d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.1929 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.1929 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </Button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'setup' && (
              <div className="h-full overflow-hidden">{setupPanel}</div>
            )}

            {activeTab === 'elements' && (
              <div className="h-full overflow-y-auto p-4">{children}</div>
            )}

            {activeTab === 'media' && (
              <div className="h-full overflow-hidden">{mediaPanel}</div>
            )}

            {activeTab === 'styles' && (
              <div className="h-full overflow-hidden">{themeEditor}</div>
            )}

            {activeTab === 'ai' && (
              <div className="h-full overflow-y-auto p-4">{aiTools}</div>
            )}

            {activeTab === 'pages' && (
              <div className="h-full overflow-y-auto p-4">{outline}</div>
            )}

            {activeTab === 'seo' && (
              <div className="h-full overflow-hidden">{seoPanel}</div>
            )}

            {activeTab === 'store' && (
              <div className="h-full overflow-hidden">{storePanel}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
