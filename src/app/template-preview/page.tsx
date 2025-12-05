import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getAllTemplates,
  type TemplateDefinition,
  type TemplateStatus,
} from '@/templates/registry';

export const metadata: Metadata = {
  title: 'Template Gallery | Baci',
  description: 'Browse and preview all available storefront templates',
  robots: {
    index: false,
    follow: false,
  },
};

// Status badge styling
const statusStyles: Record<TemplateStatus, string> = {
  production: 'bg-green-100 text-green-800 hover:bg-green-100',
  beta: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  draft: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
};

// Category badge styling
const categoryStyles: Record<string, string> = {
  gadgets: 'bg-blue-100 text-blue-800',
  fashion: 'bg-pink-100 text-pink-800',
  general: 'bg-slate-100 text-slate-800',
  food: 'bg-orange-100 text-orange-800',
  services: 'bg-purple-100 text-purple-800',
  beauty: 'bg-rose-100 text-rose-800',
};

function TemplateCard({ template }: { template: TemplateDefinition }) {
  // Count enabled engine features
  const engineFeatures = Object.values(template.engine).filter(Boolean).length;
  const totalFeatures = Object.values(template.engine).length;

  return (
    <Link href={`/template-preview/${template.id}` as Route}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
        {/* Thumbnail placeholder */}
        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
          {template.thumbnail ? (
            <img
              src={template.thumbnail}
              alt={template.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl font-bold opacity-20">
                  {template.name.charAt(0)}
                </div>
                <div className="text-xs mt-1">No preview</div>
              </div>
            </div>
          )}
          {/* Status badge overlay */}
          <div className="absolute top-2 right-2">
            <Badge className={statusStyles[template.status]}>
              {template.status}
            </Badge>
          </div>
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
              {template.name}
            </CardTitle>
            <Badge
              variant="outline"
              className={
                categoryStyles[template.category] || categoryStyles.general
              }
            >
              {template.category}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>v{template.version}</span>
            <span>
              Engine: {engineFeatures}/{totalFeatures} features
            </span>
          </div>
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function TemplateGalleryPage() {
  const templates = getAllTemplates();

  // Group templates by status
  const productionTemplates = templates.filter(
    (t) => t.status === 'production'
  );
  const betaTemplates = templates.filter((t) => t.status === 'beta');
  const draftTemplates = templates.filter((t) => t.status === 'draft');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Template Gallery
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse and preview all available storefront templates. Click any
            template to see it in action.
          </p>
          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {productionTemplates.length} Production
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              {betaTemplates.length} Beta
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              {draftTemplates.length} Draft
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Production Templates */}
        {productionTemplates.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Production Ready
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productionTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        )}

        {/* Beta Templates */}
        {betaTemplates.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Beta
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {betaTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        )}

        {/* Draft Templates */}
        {draftTemplates.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Work in Progress
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {draftTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
