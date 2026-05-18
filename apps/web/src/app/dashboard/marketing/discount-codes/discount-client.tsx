'use client';

import {
  DollarSign,
  Edit,
  Percent,
  PlusCircle,
  Tag,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import z from 'zod';
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
import { CopyButton } from '@/components/ui/copy-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { TypingPlaceholderInput } from '@/components/ui/typing-placeholder-input';
import { useToast } from '@/hooks/use-toast';
import {
  type DiscountCode,
  deleteDiscountCode,
  upsertDiscountCode,
} from './actions';

const discountSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters'),
  type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().min(0, 'Value must be positive'),
  applies_to: z.enum(['all', 'specific_products', 'min_order_value']),
  min_order_value: z.coerce.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  usage_limit: z.coerce.number().optional(),
});

interface DiscountClientProps {
  initialDiscountCodes: DiscountCode[];
  currencySymbol: string;
}

export function DiscountClient({
  initialDiscountCodes,
  currencySymbol,
}: DiscountClientProps) {
  const { toast } = useToast();
  const router = useRouter();

  // currencySymbol is passed from server now

  // Use props for initial data, but keep it in state if we want optimistic UI (or just rely on router.refresh)
  // Since we are using router.refresh() in actions (revalidatePath), we can rely on props being updated.
  // However, for immediate feedback without waiting for roundtrip, we could use optimistic state.
  // For simplicity and consistency with other pages, we'll use the props directly rendered.
  // But wait, the original page had filtering/search logic? No, just a straight mapping.
  // So we can use initialDiscountCodes directly.

  const discountCodes = initialDiscountCodes;
  const [isPending, startTransition] = useTransition();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<{
    id: string;
    code: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: 0,
    minimum_purchase_amount: 0,
    maximum_discount_amount: null as number | null,
    usage_limit: null as number | null,
    usage_limit_per_customer: 1,
    starts_at: '',
    expires_at: '',
    is_active: true,
    applies_to: 'all' as 'all' | 'specific_products' | 'specific_categories',
  });

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    const result = discountSchema.safeParse({
      code: formData.code,
      type: formData.discount_type,
      value: formData.discount_value,
      applies_to: formData.applies_to,
      min_order_value: formData.minimum_purchase_amount,
      start_date: formData.starts_at || undefined,
      end_date: formData.expires_at || undefined,
      usage_limit: formData.usage_limit || undefined,
    });

    if (!result.success) {
      const errorMsg = result.error.issues[0].message;
      toast({
        title: 'Validation Error',
        description: errorMsg,
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        await upsertDiscountCode({
          id: editingCode?.id,
          code: formData.code,
          description: formData.description,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          minimum_purchase_amount: formData.minimum_purchase_amount,
          maximum_discount_amount: formData.maximum_discount_amount,
          usage_limit: formData.usage_limit,
          usage_limit_per_customer: formData.usage_limit_per_customer,
          starts_at: formData.starts_at || undefined,
          expires_at: formData.expires_at || undefined,
          is_active: formData.is_active,
          applies_to: formData.applies_to,
        });

        toast({
          title: editingCode ? 'Updated!' : 'Created!',
          description: `Discount code ${formData.code} has been ${editingCode ? 'updated' : 'created'}.`,
        });

        setIsDialogOpen(false);
        resetForm();
        router.refresh(); // Ensure Client Components are updated with new Server Component data
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      }
    });
  };

  const openDeleteDialog = (id: string, code: string) => {
    setCodeToDelete({ id, code });
    setDeleteDialogOpen(true);
  };

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const confirmDelete = async () => {
    if (!codeToDelete) return;

    startTransition(async () => {
      try {
        await deleteDiscountCode(codeToDelete.id);

        toast({
          title: 'Deleted',
          description: `Discount code ${codeToDelete.code} has been deleted.`,
        });

        router.refresh();
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      } finally {
        setDeleteDialogOpen(false);
        setCodeToDelete(null);
      }
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingCode(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (code: DiscountCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description,
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      minimum_purchase_amount: code.minimum_purchase_amount,
      maximum_discount_amount: code.maximum_discount_amount,
      usage_limit: code.usage_limit,
      usage_limit_per_customer: code.usage_limit_per_customer,
      starts_at: code.starts_at ? code.starts_at.split('T')[0] : '',
      expires_at: code.expires_at ? code.expires_at.split('T')[0] : '',
      is_active: code.is_active,
      applies_to: code.applies_to,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      minimum_purchase_amount: 0,
      maximum_discount_amount: null,
      usage_limit: null,
      usage_limit_per_customer: 1,
      starts_at: '',
      expires_at: '',
      is_active: true,
      applies_to: 'all',
    });
  };

  const formatDiscount = (code: DiscountCode) => {
    if (code.discount_type === 'percentage') {
      return `${code.discount_value}% off`;
    }
    return `${currencySymbol}${code.discount_value} off`;
  };

  const isExpired = (code: DiscountCode) => {
    if (!code.expires_at) return false;
    return new Date(code.expires_at) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Discount Codes 🏷️
          </h1>
          <p className="text-muted-foreground">
            Create and manage promotional discount codes for your store.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Code
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Codes</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{discountCodes.length}</div>
          </CardContent>
        </Card>
        <Card className="glass hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Codes</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {discountCodes.filter((c) => c.is_active && !isExpired(c)).length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {discountCodes.reduce((sum, c) => sum + c.usage_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>All Discount Codes</CardTitle>
          <CardDescription>
            Manage your promotional codes and track their performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discountCodes.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                No discount codes yet
              </h3>
              <p className="text-muted-foreground mt-2">
                Create your first discount code to start offering promotions.
              </p>
              <Button onClick={openCreateDialog} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Code
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold">
                          {code.code}
                        </code>
                        <CopyButton
                          value={code.code}
                          variant="ghost"
                          className="h-6 w-6"
                          label="Copy code"
                        />
                      </div>
                      {code.description && (
                        <p className="text-sm text-muted-foreground">
                          {code.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{formatDiscount(code)}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {code.usage_count}
                        {code.usage_limit && ` / ${code.usage_limit}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isExpired(code) ? (
                        <Badge variant="secondary">Expired</Badge>
                      ) : code.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {code.expires_at
                        ? new Date(code.expires_at).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(code)}
                          aria-label={`Edit ${code.code}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(code.id, code.code)}
                          aria-label={`Delete ${code.code}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? 'Edit' : 'Create'} Discount Code
            </DialogTitle>
            <DialogDescription>
              {editingCode ? 'Update' : 'Create'} a promotional discount code
              for your customers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="code">Code *</Label>
                <TypingPlaceholderInput
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholders={[
                    'SAVE20',
                    'WELCOME10',
                    'FREESHIP',
                    'SUMMER25',
                    'VIP50',
                  ]}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: e.target.value || '',
                    })
                  }
                  placeholder="20% off all products"
                />
              </div>

              <div>
                <Label htmlFor="discount_type">Discount Type *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value: 'percentage' | 'fixed_amount') =>
                    setFormData({ ...formData, discount_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="discount_value">
                  Discount Value *{' '}
                  {formData.discount_type === 'percentage'
                    ? '(%)'
                    : `(${currencySymbol})`}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_value: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="minimum_purchase">
                  Minimum Purchase ({currencySymbol})
                </Label>
                <Input
                  id="minimum_purchase"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minimum_purchase_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minimum_purchase_amount:
                        Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="maximum_discount">
                  Maximum Discount ({currencySymbol})
                </Label>
                <Input
                  id="maximum_discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.maximum_discount_amount || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maximum_discount_amount: e.target.value
                        ? Number.parseFloat(e.target.value)
                        : null,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="usage_limit">Total Usage Limit</Label>
                <Input
                  id="usage_limit"
                  type="number"
                  min="0"
                  value={formData.usage_limit || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      usage_limit: e.target.value
                        ? Number.parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                  placeholder="Unlimited"
                />
              </div>

              <div>
                <Label htmlFor="usage_limit_per_customer">
                  Uses per Customer
                </Label>
                <Input
                  id="usage_limit_per_customer"
                  type="number"
                  min="1"
                  value={formData.usage_limit_per_customer}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      usage_limit_per_customer:
                        Number.parseInt(e.target.value, 10) || 1,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="starts_at">Start Date</Label>
                <Input
                  id="starts_at"
                  type="date"
                  value={formData.starts_at}
                  onChange={(e) =>
                    setFormData({ ...formData, starts_at: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="expires_at">Expiration Date</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) =>
                    setFormData({ ...formData, expires_at: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2 flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <BagLoader size={16} />
                    Saving...
                  </>
                ) : (
                  <>{editingCode ? 'Update' : 'Create'} Code</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Discount Code</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the discount code{' '}
              <strong>{codeToDelete?.code}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setCodeToDelete(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <BagLoader size={16} />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
