'use client';

import { ArrowRight, Box, HelpCircle, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Change } from '@/app/dashboard/products/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProductContext } from '@/contexts/product-context';
import { Input } from '../ui/input';

function ChangeCard({
  change,
  isSelected,
  onSelectionChange,
}: {
  change: Change;
  isSelected: boolean;
  onSelectionChange: (id: string) => void;
}) {
  const getIcon = () => {
    if (change.type === 'update')
      return <Tag className="w-5 h-5 text-blue-500" />;
    if (change.type === 'new')
      return <Box className="w-5 h-5 text-green-500" />;
    if (change.type === 'remove')
      return <Trash2 className="w-5 h-5 text-red-500" />;
    return <HelpCircle className="w-5 h-5" />;
  };

  return (
    <Card className="flex items-start gap-4 p-4">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() =>
          onSelectionChange(
            change.details.sku || change.productId || change.details.name
          )
        }
        className="mt-1"
        aria-label={`Select change for ${change.details.name}`}
      />
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="flex-1 space-y-1">
        <p className="font-semibold">{change.details.name}</p>
        {change.type === 'update' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Price change:</span>
            <span className="line-through text-red-500">
              ${change.details.price.toFixed(2)}
            </span>
            <ArrowRight className="w-4 h-4" />
            <span className="font-bold text-green-600">
              ${change.newPrice?.toFixed(2)}
            </span>
          </div>
        )}
        {change.type === 'new' && (
          <div>
            <Badge variant="secondary">New Product</Badge>
            <p className="text-sm text-muted-foreground">
              Price: ${change.details.price.toFixed(2)}
            </p>
            {/* Form for missing fields could go here */}
          </div>
        )}
        {change.type === 'remove' && (
          <div>
            <Badge variant="destructive">Remove</Badge>
            <p className="text-sm text-muted-foreground">{change.reason}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ReviewChanges() {
  const { aiResponse, setWorkflowStep, applyChanges } = useProductContext();
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
    () =>
      new Set(
        aiResponse?.changes.map(
          (c) => c.details.sku || c.productId || c.details.name
        )
      )
  );

  const [missingInfo, setMissingInfo] = useState<
    Record<string, Record<string, string>>
  >({});

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

  const handleSelectionChange = (id: string) => {
    setSelectedChanges((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedChanges(
        new Set(
          aiResponse.changes.map(
            (c) => c.details.sku || c.productId || c.details.name
          )
        )
      );
    } else {
      setSelectedChanges(new Set());
    }
  };

  const handleAccept = () => {
    const changesToApply = aiResponse.changes.filter((c) =>
      selectedChanges.has(c.details.sku || c.productId || c.details.name)
    );

    // Potentially enrich changes with manually entered info
    const finalChanges = changesToApply.map((change) => {
      if (change.type === 'new' && missingInfo[change.details.name]) {
        return {
          ...change,
          details: {
            ...change.details,
            ...missingInfo[change.details.name],
          },
        };
      }
      return change;
    });

    applyChanges(finalChanges);
  };

  const handleReject = () => {
    setWorkflowStep('view');
  };

  const handleMissingInfoChange = (
    productName: string,
    field: string,
    value: string
  ) => {
    setMissingInfo((prev) => ({
      ...prev,
      [productName]: {
        ...prev[productName],
        [field]: value,
      },
    }));
  };

  const newProductsWithMissingInfo = aiResponse.changes.filter(
    (c) =>
      c.type === 'new' &&
      aiResponse.missingParameterRequest &&
      c.details.name === aiResponse.missingParameterRequest.productName
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-2xl font-bold">Review Suggested Changes</h2>
        <p className="text-muted-foreground">{aiResponse.summary}</p>
      </div>

      {aiResponse.clarificationRequest && (
        <Alert className="m-4">
          <HelpCircle className="h-4 w-4" />
          <AlertTitle>AI needs clarification</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{aiResponse.clarificationRequest.question}</p>
            <div className="flex gap-2">
              {aiResponse.clarificationRequest.options.map((opt) => (
                <Button key={opt} variant="outline" size="sm">
                  {opt}
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {newProductsWithMissingInfo.length > 0 &&
        aiResponse.missingParameterRequest && (
          <Card className="m-4">
            <CardHeader>
              <CardTitle>Additional Information Required</CardTitle>
              <CardDescription>
                The AI needs more details for "
                {aiResponse.missingParameterRequest.productName}" before it can
                be added.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiResponse.missingParameterRequest.missingFields.map((field) => (
                <div key={field} className="grid gap-2">
                  <Label
                    htmlFor={`${aiResponse.missingParameterRequest?.productName}-${field}`}
                  >
                    {field}
                  </Label>
                  {field.toLowerCase() === 'condition' ? (
                    <Select
                      onValueChange={(value) =>
                        handleMissingInfoChange(
                          aiResponse.missingParameterRequest?.productName || '',
                          field,
                          value
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${field}...`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Brand New">Brand New</SelectItem>
                        <SelectItem value="Used">Used</SelectItem>
                        <SelectItem value="Refurbished">Refurbished</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`${aiResponse.missingParameterRequest?.productName}-${field}`}
                      placeholder={`Enter ${field}...`}
                      onChange={(e) =>
                        handleMissingInfoChange(
                          aiResponse.missingParameterRequest?.productName || '',
                          field,
                          e.target.value
                        )
                      }
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={
              selectedChanges.size === aiResponse.changes.length &&
              aiResponse.changes.length > 0
            }
            onCheckedChange={handleSelectAll}
          />
          <Label htmlFor="select-all">
            Select All ({selectedChanges.size} / {aiResponse.changes.length})
          </Label>
        </div>

        {aiResponse.changes.map((change, index) => (
          <ChangeCard
            // biome-ignore lint/suspicious/noArrayIndexKey: AI changes have no stable ID
            key={index}
            change={change}
            isSelected={selectedChanges.has(
              change.details.sku || change.productId || change.details.name
            )}
            onSelectionChange={handleSelectionChange}
          />
        ))}
      </div>

      <div className="p-4 border-t bg-background flex justify-end gap-4">
        <Button variant="outline" onClick={handleReject}>
          Reject All
        </Button>
        <Button onClick={handleAccept} disabled={selectedChanges.size === 0}>
          Accept Selected ({selectedChanges.size})
        </Button>
      </div>
    </div>
  );
}
