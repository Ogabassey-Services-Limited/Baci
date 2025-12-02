'use client';

import {
  CheckCircle2,
  // Wand2,
  FileText,
  Loader2,
  RefreshCw,
  // Search,
  Sparkles,
  Tag,
  Target,
  // AlertTriangle,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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

// import Image from 'next/image';

interface ProductSEO {
  productId: string;
  productName: string;
  seoScore: number;
  hasTitle: boolean;
  hasDescription: boolean;
  hasKeywords: boolean;
  issues: string[];
}

interface SEOSummary {
  totalProducts: number;
  averageSEOScore: number;
  missingTitle: number;
  missingDescription: number;
  missingKeywords: number;
  fullyOptimized: number;
  needsWork: number;
}

interface SEOOptimization {
  productId: string;
  productName: string;
  original: {
    meta_title?: string;
    meta_description?: string;
    keywords?: string[];
  };
  optimized: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
    focus_keyword: string;
    seo_score: number;
    suggestions: string[];
  };
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-red-100 text-red-800';
  if (score >= 80) color = 'bg-green-100 text-green-800';
  else if (score >= 60) color = 'bg-yellow-100 text-yellow-800';
  else if (score >= 40) color = 'bg-orange-100 text-orange-800';

  return <Badge className={color}>{score}%</Badge>;
}

function StatusIcon({ hasValue }: { hasValue: boolean }) {
  return hasValue ? (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" />
  );
}

export default function SEOOptimizerPage() {
  const [products, setProducts] = useState<ProductSEO[]>([]);
  const [summary, setSummary] = useState<SEOSummary | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [optimizations, setOptimizations] = useState<SEOOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);

  const fetchSEOStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/seo-optimizer');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch SEO status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSEOStatus();
  }, [fetchSEOStatus]);

  async function optimizeSelected() {
    if (selectedProducts.length === 0) return;
    setOptimizing(true);
    setShowOptimized(true);

    try {
      const res = await fetch('/api/ai/seo-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedProducts,
          options: { autoApply: false },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOptimizations(data.optimizations || []);
      }
    } catch (error) {
      console.error('Failed to optimize SEO:', error);
    } finally {
      setOptimizing(false);
    }
  }

  async function applyOptimizations() {
    if (optimizations.length === 0) return;
    setOptimizing(true);

    try {
      const res = await fetch('/api/ai/seo-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: optimizations.map((o) => o.productId),
          options: { autoApply: true },
        }),
      });

      if (res.ok) {
        // Refresh data
        await fetchSEOStatus();
        setOptimizations([]);
        setSelectedProducts([]);
        setShowOptimized(false);
      }
    } catch (error) {
      console.error('Failed to apply optimizations:', error);
    } finally {
      setOptimizing(false);
    }
  }

  function toggleProduct(productId: string) {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }

  function selectAll() {
    const needsWork = products.filter((p) => p.seoScore < 100);
    setSelectedProducts(needsWork.map((p) => p.productId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          <Button variant="outline" onClick={fetchSEOStatus}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={optimizeSelected}
            disabled={selectedProducts.length === 0 || optimizing}
          >
            {optimizing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Optimize ({selectedProducts.length})
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Score
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.averageSEOScore}%
              </div>
              <Progress value={summary.averageSEOScore} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Fully Optimized
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.fullyOptimized}
              </div>
              <p className="text-xs text-muted-foreground">
                of {summary.totalProducts} products
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Missing Titles
              </CardTitle>
              <FileText className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summary.missingTitle}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Missing Descriptions
              </CardTitle>
              <FileText className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summary.missingDescription}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Missing Keywords
              </CardTitle>
              <Tag className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summary.missingKeywords}
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
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Generated Optimizations
                </CardTitle>
                <CardDescription>
                  Review and apply the suggested SEO improvements
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowOptimized(false)}
                >
                  Cancel
                </Button>
                <Button onClick={applyOptimizations} disabled={optimizing}>
                  {optimizing && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
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
                    <div className="p-3 bg-gray-50 rounded space-y-2">
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
                    <div className="text-sm font-medium text-green-600">
                      Optimized
                    </div>
                    <div className="p-3 bg-green-50 rounded space-y-2">
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
              {products.map((product) => (
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
                      <span className="text-green-600 text-sm">All good!</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
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
        </CardContent>
      </Card>
    </div>
  );
}
