
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

// Assuming these types are defined elsewhere and can be imported
// import { Order, OrderItem, Product } from '@/lib/types';

// Mock types for now
type OrderItem = { id: string; name: string; quantity: number; product: { fulfillmentFields?: { name: string }[] } };
type FulfillmentData = { [key: string]: string[][] };

const fulfillmentItemSchema = z.object({
  name: z.string(),
  value: z.string().min(1, 'This field is required.'),
});

const fulfillmentGroupSchema = z.object({
  itemId: z.string(),
  fields: z.array(fulfillmentItemSchema),
});

const fulfillmentFormSchema = z.object({
  groups: z.array(fulfillmentGroupSchema),
});

type FulfillmentFormValues = z.infer<typeof fulfillmentFormSchema>;

interface FulfillmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderItems: OrderItem[];
  onConfirm: (data: FulfillmentData) => Promise<void>;
}

export default function FulfillmentDialog({ isOpen, onClose, orderItems, onConfirm }: FulfillmentDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const itemsWithFields = orderItems.filter(item => 
    item.product.fulfillmentFields && item.product.fulfillmentFields.length > 0
  );

  const form = useForm<FulfillmentFormValues>({
    resolver: zodResolver(fulfillmentFormSchema),
    defaultValues: {
      groups: itemsWithFields.map(item => ({
        itemId: item.id,
        fields: Array.from({ length: item.quantity }).flatMap(() => 
          item.product.fulfillmentFields!.map(field => ({ name: field.name, value: '' }))
        ),
      })),
    },
  });

  const { control } = form;

  const onSubmit = async (data: FulfillmentFormValues) => {
    setIsSaving(true);
    const formattedData: FulfillmentData = {};
    // Transform data into the required structure for onConfirm
    // This is a placeholder for the actual transformation logic
    console.log('Formatted data:', data);
    // await onConfirm(formattedData);
    setIsSaving(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Enter Fulfillment Details</DialogTitle>
          <DialogDescription>
            Some items in this order require additional information before fulfillment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="max-h-[60vh] overflow-y-auto px-1">
            {itemsWithFields.map((item, itemIndex) => (
              <div key={item.id} className="space-y-4 mb-6 p-4 border rounded-lg">
                <h3 className="font-semibold text-lg">{item.name}</h3>
                {Array.from({ length: item.quantity }).map((_, quantityIndex) => (
                  <div key={quantityIndex} className="space-y-3 p-3 bg-muted/50 rounded-md">
                     <p className="font-medium text-sm">Unit {quantityIndex + 1}</p>
                    {item.product.fulfillmentFields?.map(field => {
                      // Find the correct field in the form array
                      const fieldName = `groups.${itemIndex}.fields.${quantityIndex * item.product.fulfillmentFields!.length}.value`;
                      return (
                        <div key={field.name} className="grid grid-cols-3 items-center gap-4">
                           <Label htmlFor={fieldName} className="text-right">{field.name}</Label>
                          <Input id={fieldName} {...form.register(fieldName as any)} className="col-span-2" />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Fulfillment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
