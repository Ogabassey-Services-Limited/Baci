import {
  type Data,
  type DefaultComponentProps,
  Drawer,
} from '@puckeditor/core';
import {
  Box,
  Code,
  FormInput,
  GalleryHorizontal,
  Image as ImageIcon,
  Instagram,
  LayoutTemplate,
  List,
  Mail,
  Map as MapIcon,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  PanelTop,
  Quote,
  Search,
  Share2,
  ShoppingBag,
  Type,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { builderConfig } from '@/components/builder/config';
import { InlineContextMenu } from '@/components/builder/inline-context-menu';

const componentIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Hero: LayoutTemplate,
  HeroCarousel: GalleryHorizontal,
  Text: Type,
  Image: ImageIcon,
  Button: MousePointerClick,
  ProductGrid: ShoppingBag,
  Testimonial: Quote,
  Features: List,
  Newsletter: Mail,
  Spacer: MoveVertical,
  Footer: PanelBottom,
  Header: PanelTop,
  Video,
  Map: MapIcon,
  InstagramFeed: Instagram,
  ContactForm: FormInput,
  SocialIcons: Share2,
  CodeEmbed: Code,
  Search,
};

interface BuilderPuckOverridesOptions {
  data: Data;
  onDataChange: (data: Data) => void;
  onEdit: () => void;
}

export function createBuilderPuckOverrides({
  data,
  onDataChange,
  onEdit,
}: BuilderPuckOverridesOptions) {
  return {
    componentOverlay: ({
      children,
      componentId,
      componentType,
      isSelected,
    }: {
      children: ReactNode;
      componentId: string;
      componentType: string;
      isSelected: boolean;
    }) => {
      const componentIndex =
        data.content?.findIndex(
          (component) =>
            (component.props as DefaultComponentProps)?.id === componentId
        ) ?? -1;
      const canMoveUp = componentIndex > 0;
      const canMoveDown =
        componentIndex >= 0 && componentIndex < (data.content?.length ?? 0) - 1;
      const menuPosition =
        componentType === 'Header' || componentIndex === 0 ? 'bottom' : 'top';
      const replaceContent = (content: NonNullable<Data['content']>) =>
        onDataChange({ ...data, content });

      return (
        <div className="relative">
          {children}
          {isSelected && (
            <InlineContextMenu
              componentId={componentId}
              componentType={componentType}
              position={menuPosition}
              onEdit={onEdit}
              onDuplicate={() => {
                const component = data.content?.[componentIndex];
                if (!component) return;
                const content = [...(data.content ?? [])];
                content.splice(componentIndex + 1, 0, {
                  ...component,
                  props: {
                    ...component.props,
                    id: `${component.type}-${Date.now()}`,
                  },
                });
                replaceContent(content);
              }}
              onDelete={() => {
                if (!confirm(`Delete this ${componentType} component?`)) return;
                replaceContent(
                  data.content?.filter(
                    (component) =>
                      (component.props as DefaultComponentProps)?.id !==
                      componentId
                  ) ?? []
                );
              }}
              onMoveUp={() => {
                if (!canMoveUp) return;
                const content = [...(data.content ?? [])];
                [content[componentIndex - 1], content[componentIndex]] = [
                  content[componentIndex],
                  content[componentIndex - 1],
                ];
                replaceContent(content);
              }}
              onMoveDown={() => {
                if (!canMoveDown) return;
                const content = [...(data.content ?? [])];
                [content[componentIndex], content[componentIndex + 1]] = [
                  content[componentIndex + 1],
                  content[componentIndex],
                ];
                replaceContent(content);
              }}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
            />
          )}
        </div>
      );
    },
    drawer: ({ children: _children }: { children: ReactNode }) => {
      const componentNames = Array.from(
        new Set(
          Object.values(builderConfig.categories ?? {}).flatMap((category) =>
            Array.isArray(category.components) ? category.components : []
          )
        )
      );
      return (
        <div style={{ height: '100%', overflow: 'auto' }}>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1rem',
            }}
          >
            Drag and drop elements anywhere on your page
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
              width: '100%',
            }}
          >
            {componentNames.map((componentName) => {
              const Icon = componentIcons[componentName] ?? Box;
              return (
                <Drawer.Item key={componentName} name={componentName}>
                  {() => (
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        minHeight: '80px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'grab',
                        background: 'white',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>
                        <Icon className="size-8" />
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: '#6b7280',
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%',
                        }}
                      >
                        {componentName}
                      </span>
                    </div>
                  )}
                </Drawer.Item>
              );
            })}
          </div>
        </div>
      );
    },
  };
}
