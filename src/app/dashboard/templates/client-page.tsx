'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export default function TemplatesClientPage() {
    const templates = getAllTemplates();

    // Group templates
    const productionTemplates = templates.filter((t) => t.status === 'production');
    const betaTemplates = templates.filter((t) => t.status === 'beta');
    const draftTemplates = templates.filter((t) => t.status === 'draft');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Template Gallery</h1>
                    <p className="text-muted-foreground">
                        Explore our collection of premium storefront designs
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/developers/submit">
                        <Button variant="outline">
                            Submit Template
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="space-y-16">
                {/* Production Section - Featured */}
                {productionTemplates.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-8 w-1 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            <h2 className="text-2xl font-bold">Production Ready</h2>
                            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-medium border border-green-500/20">
                                Stable
                            </span>
                        </div>
                        <div className="grid gap-8 lg:grid-cols-2">
                            {productionTemplates.map((template) => (
                                <LivePreviewCard key={template.id} template={template} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Beta Section */}
                {betaTemplates.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-8 w-1 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                            <h2 className="text-2xl font-bold">Beta Access</h2>
                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium border border-amber-500/20">
                                Testing
                            </span>
                        </div>
                        <div className="grid gap-8 lg:grid-cols-2">
                            {betaTemplates.map((template) => (
                                <LivePreviewCard key={template.id} template={template} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Draft Section - Grid Layout */}
                {draftTemplates.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-8 w-1 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                            <h2 className="text-2xl font-bold">In Development</h2>
                            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-medium border border-purple-500/20">
                                Experimental
                            </span>
                        </div>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {draftTemplates.map((template) => (
                                <SmallPreviewCard key={template.id} template={template} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div >
    );
}

function LivePreviewCard({ template }: { template: TemplateDefinition }) {
    return (
        <Link
            href={`/template-preview/${template.id}` as Route}
            className="group block relative bg-card rounded-2xl overflow-hidden border border-border hover:border-purple-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]"
        >
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

            {/* Live Preview Iframe (Scaled Down) */}
            <div className="h-[400px] w-[200%] origin-top-left scale-50 bg-white relative pointer-events-none">
                <iframe
                    src={`/template-preview/${template.id}`}
                    className="w-full h-full border-0"
                    tabIndex={-1}
                    title={`${template.name} Preview`}
                    scrolling="no"
                    loading="lazy"
                />
                {/* Overlay to prevent interactions but allow click-through to link */}
                <div className="absolute inset-0 z-10" />
            </div>

            {/* Info Overlay */}
            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent pt-24 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                            {template.name}
                        </h3>
                        <p className="text-muted-foreground text-sm mt-1 max-w-md line-clamp-2">
                            {template.description}
                        </p>
                    </div>
                    <Badge
                        variant="outline"
                        className="bg-background/5 border-border text-foreground"
                    >
                        {template.category}
                    </Badge>
                </div>

                {/* Tags */}
                <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                    {template.tags?.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary px-2 py-1 rounded">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </Link>
    );
}

function SmallPreviewCard({ template }: { template: TemplateDefinition }) {
    return (
        <Link
            href={`/template-preview/${template.id}` as Route}
            className="group block relative bg-card rounded-xl overflow-hidden border border-border hover:border-ring transition-all hover:-translate-y-1"
        >
            <div className="aspect-[4/3] bg-muted relative">
                {/* Mini Browser Bar */}
                <div className="absolute top-0 inset-x-0 h-6 bg-black/5 dark:bg-black/20 backdrop-blur flex items-center px-3 z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
                </div>

                {/* Simplified Preview Content */}
                <div className="h-full w-full flex items-center justify-center text-muted-foreground/20 group-hover:text-muted-foreground/30 transition-colors">
                    <div className="text-6xl font-black opacity-20 select-none">
                        {template.name.charAt(0)}
                    </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-50" />
            </div>

            <div className="p-4">
                <h3 className="font-semibold">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{template.description}</p>
            </div>
        </Link>
    );
}
