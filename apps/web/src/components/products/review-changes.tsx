'use client';

import { Lock, Sparkles } from 'lucide-react';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useRef,
  useState,
} from 'react';
import type { Change } from '@/app/dashboard/products/actions';
import { enrichProductsBatch } from '@/app/dashboard/products/generation-actions';
import {
  formatPriceInput,
  parsePriceInput,
} from '@/components/products/product-currency-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProductContext } from '@/contexts/product-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyWithConfig, getCurrencyConfig } from '@/lib/currency';
import { cn } from '@/lib/utils';

const ENRICHMENT_BATCH_SIZE = 5;

type EnrichmentTarget = Change & { originalIndex: number };

function hasScientificNotation(rawValue: string): boolean {
  return /\d\s*e\s*[+-]?\s*\d/i.test(rawValue);
}

function parseEditableCostPrice(
  rawValue: string,
  locale: string
): number | null | undefined {
  if (rawValue.trim() === '') {
    return null;
  }

  if (hasScientificNotation(rawValue)) {
    return undefined;
  }

  const value = parsePriceInput(rawValue, locale);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function parseEditablePrice(
  rawValue: string,
  locale: string
): number | undefined {
  if (rawValue.trim() === '') {
    return undefined;
  }

  if (hasScientificNotation(rawValue)) {
    return undefined;
  }

  const value = parsePriceInput(rawValue, locale);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

type PriceInputValidationState = 'valid' | 'blank' | 'invalid';

function getPriceInputValidationState(
  rawValue: string | undefined,
  locale: string
): PriceInputValidationState {
  if (rawValue === undefined) {
    return 'valid';
  }

  if (rawValue.trim() === '') {
    return 'blank';
  }

  return parseEditablePrice(rawValue, locale) === undefined
    ? 'invalid'
    : 'valid';
}

function getCostPriceInputValidationState(
  rawValue: string | undefined,
  locale: string
): 'valid' | 'invalid' {
  if (rawValue === undefined || rawValue.trim() === '') {
    return 'valid';
  }

  return parseEditableCostPrice(rawValue, locale) === undefined
    ? 'invalid'
    : 'valid';
}

interface EnrichmentRunArgs {
  targets: EnrichmentTarget[];
  stopGenerationRef: RefObject<boolean>;
  toast: ReturnType<typeof useToast>['toast'];
  setLocalChanges: Dispatch<SetStateAction<Change[]>>;
  setGenProgress: Dispatch<SetStateAction<number>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setShowGenModal: Dispatch<SetStateAction<boolean>>;
}

// Module-scope helper so the try/finally stays outside the component body
// (React Compiler cannot lower try/finally inside components/hooks yet).
async function runEnrichmentBatches({
  targets,
  stopGenerationRef,
  toast,
  setLocalChanges,
  setGenProgress,
  setIsGenerating,
  setShowGenModal,
}: EnrichmentRunArgs): Promise<void> {
  const totalBatches = Math.ceil(targets.length / ENRICHMENT_BATCH_SIZE);

  try {
    for (let i = 0; i < totalBatches; i++) {
      if (stopGenerationRef.current) {
        toast({
          title: 'Generation Stopped',
          description: `Stopped after ${i * ENRICHMENT_BATCH_SIZE} products.`,
        });
        break;
      }

      const batch = targets.slice(
        i * ENRICHMENT_BATCH_SIZE,
        (i + 1) * ENRICHMENT_BATCH_SIZE
      );
      const names = batch.map((c) => c.details.name);

      // Call Server Action
      const results = await enrichProductsBatch(names);

      // Update State
      setLocalChanges((prev) => {
        const next = [...prev];
        results.forEach((res) => {
          const target = batch.find((b) => b.details.name === res.productName);
          if (target) {
            next[target.originalIndex] = {
              ...next[target.originalIndex],
              details: {
                ...next[target.originalIndex].details,
                description:
                  res.description ||
                  next[target.originalIndex].details.description, // Only overwrite if new description exists
                sku: next[target.originalIndex].details.sku || res.sku, // Only set SKU if missing
                category:
                  next[target.originalIndex].details.category || res.category, // Set category if missing
                attributes: res.attributes, // Save attributes
              },
            };
          }
        });
        return next;
      });

      // Update Progress
      setGenProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    if (!stopGenerationRef.current) {
      toast({
        title: 'Generation Complete',
        description: `Generated descriptions for ${targets.length} products.`,
      });
    }
  } catch (error) {
    console.error(error);
    toast({
      title: 'Generation Failed',
      description: 'Something went wrong.',
      variant: 'destructive',
    });
  } finally {
    setIsGenerating(false);
    setTimeout(() => setShowGenModal(false), 1000);
    stopGenerationRef.current = false; // Reset for next time
  }
}

export function ReviewChanges({ onComplete }: { onComplete?: () => void }) {
  const { aiResponse, setWorkflowStep, applyChanges } = useProductContext();
  const { merchant } = useMerchant();
  const { toast } = useToast();

  // Local state for editable changes, seeded from the AI response
  const [localChanges, setLocalChanges] = useState<Change[]>(
    () => aiResponse?.changes ?? []
  );
  const [priceInputValues, setPriceInputValues] = useState<
    Record<number, string>
  >({});
  const [costPriceInputValues, setCostPriceInputValues] = useState<
    Record<number, string>
  >({});
  // Default select all
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set((aiResponse?.changes ?? []).map((_, i) => i))
  );

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [showGenModal, setShowGenModal] = useState(false);
  const stopGenerationRef = useRef(false);

  // Re-seed local state when a new aiResponse loads. Adjusted inline during
  // render with a prev-value comparison (react.dev: adjusting some state when
  // a prop changes) instead of a setState inside an effect.
  const [prevAiResponse, setPrevAiResponse] = useState(aiResponse);
  if (aiResponse !== prevAiResponse) {
    setPrevAiResponse(aiResponse);
    if (aiResponse?.changes) {
      setLocalChanges(aiResponse.changes);
      setPriceInputValues({});
      setCostPriceInputValues({});
      setSelectedIndices(new Set(aiResponse.changes.map((_, i) => i)));
    }
  }

  if (!aiResponse) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No AI response to review. Please try uploading a file again.
        </AlertDescription>
        <Button onClick={() => setWorkflowStep('upload')} className="mt-4">
          Go to Upload
        </Button>
      </Alert>
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIndices(new Set(localChanges.map((_, i) => i)));
    } else {
      setSelectedIndices(new Set());
    }
  };

  const toggleSelection = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const handleEdit = (
    index: number,
    field: keyof Change['details'],
    value: string | number
  ) => {
    setLocalChanges((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        details: {
          ...updated[index].details,
          [field]: value,
        },
      };
      return updated;
    });
  };

  const isPro =
    merchant?.plan_tier === 'pro' || merchant?.plan_tier === 'business';
  const currencyConfig = getCurrencyConfig(
    merchant?.country,
    merchant?.payout_currency
  );
  const currencySymbol = currencyConfig.symbol;
  const getPriceValidationState = (index: number) =>
    getPriceInputValidationState(
      priceInputValues[index],
      currencyConfig.locale
    );
  const getCostPriceValidationState = (index: number) =>
    getCostPriceInputValidationState(
      costPriceInputValues[index],
      currencyConfig.locale
    );
  const hasSelectedInvalidPrice = localChanges.some(
    (change, index) =>
      selectedIndices.has(index) &&
      change.type !== 'remove' &&
      getPriceValidationState(index) !== 'valid'
  );
  const hasSelectedInvalidCostPrice = localChanges.some(
    (change, index) =>
      selectedIndices.has(index) &&
      change.type !== 'remove' &&
      getCostPriceValidationState(index) !== 'valid'
  );

  const handlePriceInputChange = (
    index: number,
    change: Change,
    rawValue: string
  ) => {
    setPriceInputValues((prev) => ({ ...prev, [index]: rawValue }));
    const price = parseEditablePrice(rawValue, currencyConfig.locale);
    if (price === undefined) {
      return;
    }

    if (change.type === 'update') {
      setLocalChanges((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          newPrice: price,
        };
        return next;
      });
      return;
    }

    handleEdit(index, 'price', price);
  };

  const handleCostPriceInputChange = (index: number, rawValue: string) => {
    setCostPriceInputValues((prev) => ({ ...prev, [index]: rawValue }));
    const costPrice = parseEditableCostPrice(rawValue, currencyConfig.locale);
    if (costPrice === undefined) {
      return;
    }

    setLocalChanges((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        details: {
          ...next[index].details,
          cost_price: costPrice,
          cost_price_was_edited: true,
        },
      };
      return next;
    });
  };

  const handleGenerateDescriptions = async () => {
    if (!isPro) {
      toast({
        title: 'Pro Feature Locked',
        description:
          'Upgrade to Pro to auto-generate SEO descriptions for thousands of products!',
        variant: 'destructive', // Or a custom 'premium' variant if you have one
      });
      return;
    }

    // Identify targets: New products with empty descriptions OR missing SKUs OR no attributes
    const targets = localChanges
      .map((c, i) => ({ ...c, originalIndex: i }))
      .filter((c) => c.type === 'new'); // Process ALL new products to enrich them (attributes/SKU even if description exists)

    if (targets.length === 0) {
      toast({
        title: 'Nothing to generate',
        description: 'All new products already have descriptions.',
      });
      return;
    }

    setShowGenModal(true);
    setIsGenerating(true);
    setGenProgress(0);

    // Delegate the try/finally batch loop to a module-scope helper so the
    // component body stays free of try/finally (React Compiler cannot lower it).
    await runEnrichmentBatches({
      targets,
      stopGenerationRef,
      toast,
      setLocalChanges,
      setGenProgress,
      setIsGenerating,
      setShowGenModal,
    });
  };

  const handleStopGeneration = () => {
    stopGenerationRef.current = true;
  };

  const handleApply = async () => {
    const changesToApply = localChanges.filter((_, i) =>
      selectedIndices.has(i)
    );
    await applyChanges(changesToApply);
    if (onComplete) onComplete();
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-md border shadow-sm overflow-hidden">
      {/* Header / Stats */}
      <div className="p-4 border-b flex items-center justify-between bg-muted/20">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Review Changes</h2>
          <p className="text-sm text-muted-foreground">{aiResponse.summary}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWorkflowStep('view')}
          >
            Cancel
          </Button>
          <Button
            variant={isPro ? 'default' : 'secondary'}
            size="sm"
            className={cn('gap-2', !isPro && 'opacity-80')}
            onClick={handleGenerateDescriptions}
          >
            {isPro ? (
              <Sparkles className="size-4" />
            ) : (
              <Lock className="size-4" />
            )}
            Auto-Enrich
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={
              selectedIndices.size === 0 ||
              hasSelectedInvalidPrice ||
              hasSelectedInvalidCostPrice
            }
          >
            Import & Publish
          </Button>
        </div>
      </div>

      {/* Editable Grid */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    selectedIndices.size === localChanges.length &&
                    localChanges.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="min-w-[200px]">Product Name</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="w-[180px]">Price</TableHead>
              <TableHead className="w-[180px]">Cost Price</TableHead>
              <TableHead className="min-w-[300px]">Description</TableHead>
              <TableHead className="w-[150px]">SKU / Condition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localChanges.map((change, index) => {
              const isSelected = selectedIndices.has(index);
              const priceValidationState = getPriceValidationState(index);
              return (
                <TableRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: Changes don't have stable IDs
                  key={index}
                  className={cn(
                    !isSelected &&
                      'opacity-50 grayscale bg-muted/50 dark:bg-muted/20'
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(index)}
                    />
                  </TableCell>
                  <TableCell>
                    {change.type === 'new' && (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        New
                      </Badge>
                    )}
                    {change.type === 'update' && (
                      <Badge variant="secondary" className="text-blue-500">
                        Update
                      </Badge>
                    )}
                    {change.type === 'remove' && (
                      <Badge variant="destructive">Remove</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={change.details.name}
                      onChange={(e) =>
                        handleEdit(index, 'name', e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={change.details.category || ''}
                      placeholder="General"
                      onChange={(e) =>
                        handleEdit(index, 'category', e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 relative">
                      <span className="absolute left-2 top-2 text-sm text-muted-foreground pointer-events-none">
                        {currencySymbol}
                      </span>
                      <Input
                        aria-label="Price"
                        aria-invalid={priceValidationState !== 'valid'}
                        inputMode="decimal"
                        type="text"
                        value={
                          priceInputValues[index] ??
                          formatPriceInput(
                            change.newPrice ?? change.details.price,
                            currencyConfig.locale
                          )
                        }
                        onChange={(e) =>
                          handlePriceInputChange(
                            index,
                            change,
                            e.currentTarget.value
                          )
                        }
                        className={cn(
                          'h-8 pl-7',
                          change.type === 'update' &&
                            'border-green-500 text-green-700 dark:text-green-400'
                        )}
                      />
                      {priceValidationState === 'blank' && (
                        <span className="text-xs text-destructive pl-1">
                          Price is required before import.
                        </span>
                      )}
                      {priceValidationState === 'invalid' && (
                        <span className="text-xs text-destructive pl-1">
                          Enter a valid non-negative price before import.
                        </span>
                      )}
                      {change.type === 'update' && (
                        <span className="text-xs text-muted-foreground line-through pl-1">
                          Stats:{' '}
                          {formatCurrencyWithConfig(
                            change.details.price,
                            currencyConfig
                          )}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 relative">
                      <span className="absolute left-2 top-2 text-sm text-muted-foreground pointer-events-none">
                        {currencySymbol}
                      </span>
                      <Input
                        aria-invalid={
                          getCostPriceValidationState(index) === 'invalid'
                        }
                        aria-label="Cost Price"
                        inputMode="decimal"
                        type="text"
                        value={
                          costPriceInputValues[index] ??
                          change.details.cost_price ??
                          ''
                        }
                        placeholder="0.00"
                        onChange={(e) =>
                          handleCostPriceInputChange(
                            index,
                            e.currentTarget.value
                          )
                        }
                        className={cn(
                          'h-8 pl-7',
                          getCostPriceValidationState(index) === 'invalid' &&
                            'border-destructive focus-visible:ring-destructive'
                        )}
                      />
                      {getCostPriceValidationState(index) === 'invalid' && (
                        <span className="text-xs text-destructive">
                          Enter a valid non-negative cost price before import.
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={change.details.description || ''}
                      placeholder="No description..."
                      onChange={(e) =>
                        handleEdit(index, 'description', e.target.value)
                      }
                      className={cn(
                        'h-8',
                        !change.details.description &&
                          'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30'
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Input
                        value={change.details.sku || ''}
                        placeholder="SKU"
                        onChange={(e) =>
                          handleEdit(index, 'sku', e.target.value)
                        }
                        className="h-7 text-xs mb-1"
                      />
                      {change.details.attributes &&
                        Object.keys(change.details.attributes).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(change.details.attributes)
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <Badge
                                  key={k}
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {v}
                                </Badge>
                              ))}
                            {Object.keys(change.details.attributes).length >
                              3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +
                                {Object.keys(change.details.attributes).length -
                                  3}
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t bg-background flex justify-between items-center sm:hidden">
        {/* Redundant on desktop but useful for mobile where header might be scrolled away */}
        {/* Keeping empty/minimal for now as requested to move to top, but can leave summary logic here if needed */}
        <div className="text-xs text-muted-foreground">
          {selectedIndices.size} items ready (Action at top)
        </div>
      </div>

      {/* Generation Modal */}
      <Dialog
        open={showGenModal}
        onOpenChange={(open) => {
          if (!open && isGenerating) {
            // If closing via properties/escape while processing, treat as stop
            handleStopGeneration();
          }
          setShowGenModal(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Researching Products…</DialogTitle>
            <DialogDescription>
              Our AI is researching and writing descriptions for your products.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Analyzing batch…</span>
              <span>{genProgress}%</span>
            </div>
            <Progress value={genProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              Powered by Gemini 1.5 Flash
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleStopGeneration}
            >
              Stop Generation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
