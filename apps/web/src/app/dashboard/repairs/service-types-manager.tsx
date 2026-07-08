'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useToast } from '@/hooks/use-toast';
import type { RepairServiceTypeAdmin } from '@/lib/repairs/catalog-admin-mappers';
import {
  createServiceType,
  deleteServiceType,
  listServiceTypes,
  updateServiceType,
} from './catalog-api';

interface FormState {
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  sortOrder: '',
  isActive: true,
};

function toFormState(serviceType: RepairServiceTypeAdmin): FormState {
  return {
    name: serviceType.name,
    description: serviceType.description ?? '',
    sortOrder: String(serviceType.sortOrder),
    isActive: serviceType.isActive,
  };
}

export default function ServiceTypesManager() {
  const { toast } = useToast();
  const [serviceTypes, setServiceTypes] = useState<RepairServiceTypeAdmin[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadServiceTypes = () => {
    setLoading(true);
    setLoadError(null);
    listServiceTypes()
      .then((rows) => setServiceTypes(rows))
      .catch(() => {
        setLoadError('Could not load service types.');
        toast({
          title: 'Error loading service types',
          description: 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount; loadServiceTypes is re-exposed for the retry button
  useEffect(() => {
    loadServiceTypes();
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (serviceType: RepairServiceTypeAdmin) => {
    setEditingId(serviceType.id);
    setForm(toFormState(serviceType));
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      return;
    }
    const payload = {
      name,
      description: form.description.trim() || null,
      sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : undefined,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateServiceType(editingId, payload);
        setServiceTypes((current) =>
          current.map((item) => (item.id === editingId ? updated : item))
        );
        toast({ title: 'Service type updated' });
      } else {
        const created = await createServiceType(payload);
        setServiceTypes((current) => [created, ...current]);
        toast({ title: 'Service type added' });
      }
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: editingId
          ? 'Could not update service type'
          : 'Could not add service type',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteServiceType(id);
      setServiceTypes((current) => current.filter((item) => item.id !== id));
      toast({ title: 'Service type removed' });
    } catch (error) {
      toast({
        title: 'Could not remove service type',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Service types</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="size-4" />
              Add service type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit service type' : 'Add service type'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-type-name">Name</Label>
                <Input
                  id="service-type-name"
                  required
                  value={form.name}
                  onChange={(event) => setField('name', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-type-description">Description</Label>
                <Textarea
                  id="service-type-description"
                  value={form.description}
                  onChange={(event) =>
                    setField('description', event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-type-sort-order">Sort order</Label>
                <Input
                  id="service-type-sort-order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setField('sortOrder', event.target.value)
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="service-type-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setField('isActive', checked)}
                />
                <Label htmlFor="service-type-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-6">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button size="sm" variant="outline" onClick={loadServiceTypes}>
            Retry
          </Button>
        </div>
      ) : serviceTypes.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No service types yet…
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {serviceTypes.map((serviceType) => (
              <TableRow key={serviceType.id}>
                <TableCell>{serviceType.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {serviceType.slug}
                </TableCell>
                <TableCell>
                  <Badge variant={serviceType.isActive ? 'default' : 'outline'}>
                    {serviceType.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => openEditDialog(serviceType)}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Edit {serviceType.name}</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="outline">
                          <Trash2 className="size-4" />
                          <span className="sr-only">
                            Delete {serviceType.name}
                          </span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {serviceType.name}?
                          </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deletingId === serviceType.id}
                            onClick={() => handleDelete(serviceType.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
