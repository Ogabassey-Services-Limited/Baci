'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { RepairServiceTypeAdmin } from '@/lib/repairs/catalog-admin-mappers';
import { deleteServiceType, listServiceTypes } from './catalog-api';
import ServiceTypeFormDialog from './service-type-form-dialog';

export default function ServiceTypesManager() {
  const { toast } = useToast();
  const [serviceTypes, setServiceTypes] = useState<RepairServiceTypeAdmin[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServiceType, setEditingServiceType] =
    useState<RepairServiceTypeAdmin | null>(null);
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

  const openCreateDialog = () => {
    setEditingServiceType(null);
    setDialogOpen(true);
  };

  const openEditDialog = (serviceType: RepairServiceTypeAdmin) => {
    setEditingServiceType(serviceType);
    setDialogOpen(true);
  };

  const handleSaved = (saved: RepairServiceTypeAdmin) => {
    setServiceTypes((current) =>
      editingServiceType
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current]
    );
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
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Add service type
        </Button>
        <ServiceTypeFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initial={editingServiceType}
          onSaved={handleSaved}
        />
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
