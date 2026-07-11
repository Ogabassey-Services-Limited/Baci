'use client';

import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, Fragment, useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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
import type {
  RepairDeviceAdmin,
  RepairServiceTypeAdmin,
} from '@/lib/repairs/catalog-admin-mappers';
import { deleteDevice, listDevices, listServiceTypes } from './catalog-api';
import DeviceFormDialog from './device-form-dialog';
import DeviceQuotesPanel from './device-quotes-panel';

interface DevicesManagerProps {
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function DevicesManager({
  canEdit = true,
  canDelete = true,
}: DevicesManagerProps) {
  const { toast } = useToast();
  const [devices, setDevices] = useState<RepairDeviceAdmin[]>([]);
  const [serviceTypes, setServiceTypes] = useState<RepairServiceTypeAdmin[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<RepairDeviceAdmin | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDevices = (search?: string) => {
    setLoading(true);
    setLoadError(null);
    listDevices(search)
      .then(setDevices)
      .catch(() => {
        setLoadError('Could not load devices.');
        toast({
          title: 'Error loading devices',
          description: 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount; loadDevices is also exposed for search/retry
  useEffect(() => {
    listServiceTypes()
      .then(setServiceTypes)
      .catch(() => {
        toast({
          title: 'Could not load service types',
          description: 'Quotes may be unavailable until this is fixed.',
          variant: 'destructive',
        });
      });
    loadDevices();
  }, []);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadDevices(query.trim() || undefined);
  };

  const openCreateDialog = () => {
    setEditingDevice(null);
    setDialogOpen(true);
  };

  const openEditDialog = (device: RepairDeviceAdmin) => {
    setEditingDevice(device);
    setDialogOpen(true);
  };

  const handleSaved = (device: RepairDeviceAdmin) => {
    setDevices((current) => {
      const exists = current.some((item) => item.id === device.id);
      return exists
        ? current.map((item) => (item.id === device.id ? device : item))
        : [device, ...current];
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDevice(id);
      setDevices((current) => current.filter((item) => item.id !== id));
      setExpandedId((current) => (current === id ? null : current));
      toast({ title: 'Device removed' });
    } catch (error) {
      toast({
        title: 'Could not remove device',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            type="search"
            placeholder="Search devices…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search devices"
          />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
        <Button size="sm" disabled={!canEdit} onClick={openCreateDialog}>
          <Plus className="size-4" />
          Add device
        </Button>
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadDevices(query.trim() || undefined)}
          >
            Retry
          </Button>
        </div>
      ) : devices.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No devices yet…
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <Fragment key={device.id}>
                <TableRow>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleExpanded(device.id)}
                    >
                      {expandedId === device.id ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                      <span className="sr-only">
                        {expandedId === device.id ? 'Collapse' : 'Expand'}{' '}
                        {device.brand} {device.model}
                      </span>
                    </Button>
                  </TableCell>
                  <TableCell>{device.brand}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {device.model}
                      {device.productId ? (
                        <Badge variant="secondary">Linked</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {device.deviceType ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={device.isActive ? 'default' : 'outline'}>
                      {device.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!canEdit}
                        onClick={() => openEditDialog(device)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">
                          Edit {device.brand} {device.model}
                        </span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={!canDelete}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">
                              Delete {device.brand} {device.model}
                            </span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete {device.brand} {device.model}?
                            </AlertDialogTitle>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={deletingId === device.id}
                              onClick={() => handleDelete(device.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === device.id ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <DeviceQuotesPanel
                        deviceId={device.id}
                        canDelete={canDelete}
                        canEdit={canEdit}
                        serviceTypes={serviceTypes}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingDevice}
        onSaved={handleSaved}
      />
    </div>
  );
}
