'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mock types for now - in a real app, these would be imported
type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  product: {
    fulfillmentFields?: { name: string }[];
  };
};
type FulfillmentData = { [key: string]: string[][] };

// --- Zod Schema Definition ---
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

// --- Component Props ---
interface FulfillmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderItems: OrderItem[];
  onConfirm: (data: FulfillmentData) => Promise<void>;
}

// --- Component ---
export default function FulfillmentDialog({
  isOpen,
  onClose,
  orderItems,
  onConfirm,
}: FulfillmentDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const itemsWithFields = orderItems.filter(
    (item) =>
      item.product.fulfillmentFields &&
      item.product.fulfillmentFields.length > 0
  );

  const form = useForm<
    z.input<typeof fulfillmentFormSchema>,
    unknown,
    FulfillmentFormValues
  >({
    resolver: zodResolver(fulfillmentFormSchema),
  });

  // Reset form when the dialog opens or items change
  useEffect(() => {
    if (isOpen) {
      form.reset({
        groups: itemsWithFields.map((item) => ({
          itemId: item.id,
          fields: Array.from({ length: item.quantity }).flatMap(() =>
            item.product.fulfillmentFields?.map((field) => ({
              name: field.name,
              value: '',
            }))
          ),
        })),
      });
    }
  }, [isOpen, form, itemsWithFields]);

  const onSubmit = async (data: FulfillmentFormValues) => {
    setIsSaving(true);
    const formattedData: FulfillmentData = {};

    data.groups.forEach((group) => {
      const item = itemsWithFields.find((i) => i.id === group.itemId);
      if (
        !item?.product.fulfillmentFields ||
        item.product.fulfillmentFields.length === 0
      )
        return;

      const numFields = item.product.fulfillmentFields.length;
      const units: string[][] = [];
      const numUnits = item.quantity;

      for (let i = 0; i < numUnits; i++) {
        const unitFields: string[] = [];
        for (let j = 0; j < numFields; j++) {
          const fieldIndex = i * numFields + j;
          unitFields.push(group.fields[fieldIndex].value);
        }
        units.push(unitFields);
      }
      formattedData[group.itemId] = units;
    });

    await onConfirm(formattedData);
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Enter Fulfillment Details</DialogTitle>
          <DialogDescription>
            Some items in this order require additional information before
            fulfillment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 py-4"
          >
            <div className="max-h-[60vh] overflow-y-auto px-1">
              {itemsWithFields.map((item, itemIndex) => (
                <div
                  key={item.id}
                  className="space-y-4 mb-6 p-4 border rounded-lg"
                >
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  {Array.from({ length: item.quantity }).map(
                    (_, quantityIndex) => (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: List is static
                        key={quantityIndex}
                        className="space-y-4 p-3 bg-muted/50 rounded-md"
                      >
                        <p className="font-medium text-sm">
                          Unit {quantityIndex + 1}
                        </p>
                        {item.product.fulfillmentFields?.map(
                          (field, fieldIndex) => {
                            const formFieldIndex =
                              quantityIndex *
                                (item.product.fulfillmentFields?.length ?? 0) +
                              fieldIndex;
                            const fieldName = `groups.${itemIndex}.fields.${formFieldIndex}.value`;

                            return (
                              <FormField
                                key={`${item.id}-${quantityIndex}-${field.name}`}
                                control={form.control}
                                // biome-ignore lint/suspicious/noExplicitAny: Legacy code using any
                                name={fieldName as any}
                                render={({ field: formField }) => (
                                  <FormItem className="grid grid-cols-3 items-center gap-x-4 gap-y-1">
                                    <Label
                                      htmlFor={fieldName}
                                      className="text-right col-span-1"
                                    >
                                      {field.name}
                                    </Label>
                                    <div className="col-span-2">
                                      <FormControl>
                                        <Input id={fieldName} {...formField} />
                                      </FormControl>
                                      <FormMessage className="mt-1" />
                                    </div>
                                  </FormItem>
                                )}
                              />
                            );
                          }
                        )}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <BagLoader size={16} />}
                Confirm Fulfillment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
