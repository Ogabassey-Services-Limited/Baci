import { Eye } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TemplateDefinition } from '@/templates/registry';
import { ApplyTemplateButton } from './apply-button';

export function LivePreviewCard({
  template,
}: {
  template: TemplateDefinition;
}) {
  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-purple-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]">
      {/* Browser Chrome */}
      <div className="h-8 bg-muted flex items-center px-4 gap-2 border-b border-border">
        <div className="flex gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        </div>
        <div className="ml-4 h-4 bg-background/50 rounded-full w-40 text-[10px] flex items-center pl-2 text-muted-foreground font-mono">
          baci.store/{template.id}
        </div>
      </div>

      {/* Static Thumbnail Preview - Clickable for preview */}
      <div className="block relative">
        <Link
          href={`/template-preview/${template.id}` as Route}
          className="block h-[320px] overflow-hidden relative bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-inset"
          aria-label={`Preview ${template.name} template`}
        >
          {template.thumbnail ? (
            <Image
              src={template.thumbnail}
              alt={`${template.name} template preview`}
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div
                  className="text-8xl font-black opacity-10 select-none"
                  aria-hidden="true"
                >
                  {(template.name || '?').charAt(0)}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Click to preview
                </p>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Info Section with Buttons */}
      <div className="p-6 bg-background">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold">{template.name}</h3>
            <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
              {template.description}
            </p>
          </div>
          <Badge
            variant="outline"
            className="bg-background/5 border-border text-foreground shrink-0 ml-2"
          >
            {template.category}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <ApplyTemplateButton templateId={template.id} />
          <Button variant="outline" size="default" asChild>
            <Link
              href={`/template-preview/${template.id}` as Route}
              aria-label={`Preview ${template.name} template`}
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              Preview
            </Link>
          </Button>
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SmallPreviewCard({
  template,
}: {
  template: TemplateDefinition;
}) {
  return (
    <div className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-ring transition-all hover:-translate-y-1">
      <Link
        href={`/template-preview/${template.id}` as Route}
        className="block focus:outline-hidden focus:ring-2 focus:ring-primary"
        aria-label={`Preview ${template.name} template`}
      >
        <div className="aspect-4/3 bg-muted relative">
          {/* Mini Browser Bar */}
          <div className="absolute top-0 inset-x-0 h-6 bg-black/5 dark:bg-black/20 backdrop-blur-sm flex items-center px-3 z-10">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
          </div>

          {/* Simplified Preview Content */}
          <div className="h-full w-full flex items-center justify-center text-muted-foreground/20 group-hover:text-muted-foreground/30 transition-colors">
            {template.thumbnail ? (
              <Image
                src={template.thumbnail}
                alt={`${template.name} thumbnail`}
                fill
                className="object-cover object-top opacity-50 group-hover:opacity-100 transition-opacity"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
            ) : (
              <div
                className="text-6xl font-black opacity-20 select-none"
                aria-hidden="true"
              >
                {(template.name || '?').charAt(0)}
              </div>
            )}
          </div>

          <div className="absolute inset-0 bg-linear-to-t from-background/80 to-transparent opacity-50 pointer-events-none" />
        </div>
      </Link>

      <div className="p-4">
        <h3 className="font-semibold">{template.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {template.description}
        </p>
        <div className="flex gap-2 mt-3">
          <ApplyTemplateButton templateId={template.id} size="sm" />
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/template-preview/${template.id}` as Route}
              aria-label={`Preview ${template.name}`}
            >
              <Eye className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
