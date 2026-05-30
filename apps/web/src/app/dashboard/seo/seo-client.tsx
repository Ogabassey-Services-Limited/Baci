'use client';

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Sparkles,
  Tag,
  Target,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  generateSEOSuggestions,
  type ProductSEO,
  type SEOOptimization,
  type SEOSummary,
  saveSEOSettings,
} from './actions';

interface SEOClientProps {
  initialProducts: ProductSEO[];
  initialSummary: SEOSummary | null;
  merchantId: string;
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  if (score >= 80)
    color =
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  else if (score >= 60)
    color =
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  else if (score >= 40)
    color =
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';

  return <Badge className={color}>{score}%</Badge>;
}

function StatusIcon({ hasValue }: { hasValue: boolean }) {
  return hasValue ? (
    <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
  ) : (
    <XCircle className="size-4 text-red-500 dark:text-red-400" />
  );
}

export default function SEOClient({
  initialProducts,
  initialSummary,
  merchantId,
}: SEOClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // State
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [optimizations, setOptimizations] = useState<SEOOptimization[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Pagination Logic
  const totalPages = Math.ceil(initialProducts.length / itemsPerPage);
  const paginatedProducts = initialProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      toast({ description: 'Refreshed SEO status' });
    });
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAll = () => {
    // Select all needing work across ALL pages, not just current page
    const needsWork = initialProducts.filter((p) => p.seoScore < 100);
    setSelectedProducts(needsWork.map((p) => p.productId));
  };

  const handleOptimize = async () => {
    if (selectedProducts.length === 0) return;

    setOptimizing(true);
    setShowOptimized(true);

    try {
      const results = await generateSEOSuggestions(
        merchantId,
        selectedProducts
      );
      setOptimizations(results);
    } catch (error) {
      console.error('Optimization error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate SEO suggestions.',
        variant: 'destructive',
      });
      setShowOptimized(false);
    } finally {
      setOptimizing(false);
    }
  };

  const handleApply = async () => {
    if (optimizations.length === 0) return;
    setOptimizing(true); // Re-use optimizing state for "saving"

    try {
      // Map optimizations to the format expected by saveSEOSettings
      const updates = optimizations.map((opt) => ({
        productId: opt.productId,
        meta_title: opt.optimized.meta_title,
        meta_description: opt.optimized.meta_description,
        keywords: opt.optimized.keywords,
      }));

      const result = await saveSEOSettings(merchantId, updates);

      if (result.success) {
        toast({
          title: 'Success',
          description: `Applied SEO optimizations to ${updates.length} products`,
        });
        setOptimizations([]);
        setShowOptimized(false);
        setSelectedProducts([]);
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save changes.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
        variant: 'destructive',
      });
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SEO Optimizer</h1>
          <p className="text-muted-foreground">
            AI-powered SEO optimization for your products
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isPending}
          >
            <RefreshCw
              className={`size-4 mr-2 ${isPending ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            onClick={handleOptimize}
            disabled={
              selectedProducts.length === 0 || optimizing || showOptimized
            }
          >
            {optimizing ? (
              <BagLoader size={16} />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            Optimize ({selectedProducts.length})
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {initialSummary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Score
              </CardTitle>
              <Target className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {initialSummary.averageSEOScore}%
              </div>
              <Progress
                value={Math.min(
                  100,
                  Math.max(0, initialSummary.averageSEOScore)
                )}
                className="mt-2"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Fully Optimized
              </CardTitle>
              <CheckCircle2 className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {initialSummary.fullyOptimized}
              </div>
              <p className="text-xs text-muted-foreground">
                of {initialSummary.totalProducts} products
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Missing Titles
              </CardTitle>
              <FileText className="size-4 text-orange-500 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {initialSummary.missingTitle}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Missing Descriptions
              </CardTitle>
              <FileText className="size-4 text-orange-500 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {initialSummary.missingDescription}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Missing Keywords
              </CardTitle>
              <Tag className="size-4 text-orange-500 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {initialSummary.missingKeywords}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Optimizations Preview */}
      {showOptimized && optimizations.length > 0 && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  AI-Generated Optimizations
                </CardTitle>
                <CardDescription>
                  Review and apply the suggested SEO improvements
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOptimized(false);
                    setOptimizations([]);
                  }}
                  disabled={optimizing}
                >
                  Cancel
                </Button>
                <Button onClick={handleApply} disabled={optimizing}>
                  {optimizing && <BagLoader size={16} />}
                  Apply All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {optimizations.map((opt) => (
              <div
                key={opt.productId}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{opt.productName}</h3>
                  <ScoreBadge score={opt.optimized.seo_score} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Original
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Title:{' '}
                        </span>
                        <span className="text-sm">
                          {opt.original.meta_title || <em>None</em>}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Description:{' '}
                        </span>
                        <span className="text-sm">
                          {opt.original.meta_description || <em>None</em>}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                      Optimized
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Title:{' '}
                        </span>
                        <span className="text-sm font-medium">
                          {opt.optimized.meta_title}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({opt.optimized.meta_title.length} chars)
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Description:{' '}
                        </span>
                        <span className="text-sm">
                          {opt.optimized.meta_description}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({opt.optimized.meta_description.length} chars)
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Focus Keyword:{' '}
                        </span>
                        <Badge variant="outline">
                          {opt.optimized.focus_keyword}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {opt.optimized.keywords.map((kw) => (
                          <Badge
                            key={kw}
                            variant="secondary"
                            className="text-xs"
                          >
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {opt.optimized.suggestions.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Suggestions: </span>
                    <span className="text-muted-foreground">
                      {opt.optimized.suggestions.join(' • ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Products List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product SEO Status</CardTitle>
              <CardDescription>
                Select products to optimize with AI
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All Needing Work
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Product</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-center">Title</TableHead>
                <TableHead className="text-center">Description</TableHead>
                <TableHead className="text-center">Keywords</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow
                  key={product.productId}
                  className={
                    selectedProducts.includes(product.productId)
                      ? 'bg-primary/5'
                      : ''
                  }
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedProducts.includes(product.productId)}
                      onCheckedChange={() => toggleProduct(product.productId)}
                      disabled={product.seoScore === 100}
                      aria-label={`Select ${product.productName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{product.productName}</div>
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={product.seoScore} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIcon hasValue={product.hasTitle} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIcon hasValue={product.hasDescription} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIcon hasValue={product.hasKeywords} />
                  </TableCell>
                  <TableCell>
                    {product.issues.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.issues.slice(0, 2).map((issue) => (
                          <Badge
                            key={issue}
                            variant="outline"
                            className="text-xs"
                          >
                            {issue}
                          </Badge>
                        ))}
                        {product.issues.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{product.issues.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 text-sm">
                        All good!
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {initialProducts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-x-2 py-4">
              <div className="flex-1 text-sm text-muted-foreground text-left">
                Page {currentPage} of {totalPages}
              </div>
              <div className="gap-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
