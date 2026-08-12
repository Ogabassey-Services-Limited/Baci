'use client';

import { Loader2, RefreshCw, ShieldPlus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  type PlatformAdminRole,
  platformAdminRoles,
} from '@/config/platform-admin-rbac';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import type { AdminPlatformAccessMembership } from '@/schemas/admin-platform-access';
import { AccessMembersTable } from './access-members-table';
import { RevokeAccessForm } from './revoke-access-form';

interface AccessListResponse {
  data: AdminPlatformAccessMembership[];
  generatedAt: string;
  limit: number;
  truncated: boolean;
}

async function loadMembers(): Promise<AccessListResponse> {
  const response = await fetch('/api/admin/access');
  if (!response.ok) throw new Error('platform_access_load_failed');
  return (await response.json()) as AccessListResponse;
}

export function AccessManagementClient() {
  const { toast } = useToast();
  const [members, setMembers] = useState<AdminPlatformAccessMembership[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [rosterTruncated, setRosterTruncated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformAdminRole>('viewer');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reactivate, setReactivate] = useState(false);
  const [revokeTarget, setRevokeTarget] =
    useState<AdminPlatformAccessMembership | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await loadMembers();
      setMembers(result.data);
      setGeneratedAt(result.generatedAt);
      setRosterTruncated(result.truncated);
    } catch {
      setMembers([]);
      setRosterTruncated(false);
      setLoadError(
        'Platform access could not be loaded. Refresh to try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: initial read only; refresh is user-triggered after mount.
  useEffect(() => {
    void refresh();
  }, []);

  const submitMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetchWithCsrf('/api/admin/access', {
        body: JSON.stringify({ confirmed, email, reactivate, reason, role }),
        method: 'POST',
      });
      if (!response.ok) throw new Error('platform_access_upsert_failed');
      setEmail('');
      setReason('');
      setConfirmed(false);
      setReactivate(false);
      await refresh();
      toast({ title: 'Platform access updated' });
    } catch {
      toast({
        title: 'Access was not updated',
        description:
          'Check the account, reason, confirmation, and owner safety rules.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-l-4 border-primary pl-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Platform security
          </p>
          <h1 className="mt-1 text-page-title">Access management</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Assign only the platform role required for the work. Every change
            requires a reason, confirmation, and an immutable audit record.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw
            className={`mr-2 size-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldPlus className="size-5 text-primary" aria-hidden="true" />
            Grant or change access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={submitMembership}
          >
            <div className="space-y-2">
              <Label htmlFor="access-email">Account email</Label>
              <Input
                id="access-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operator@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-role">Platform role</Label>
              <select
                id="access-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as PlatformAdminRole)
                }
              >
                {platformAdminRoles.map((option) => (
                  <option key={option} value={option} className="capitalize">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="access-reason">Reason for this change</Label>
              <Textarea
                id="access-reason"
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Describe the operational need. This is retained in the membership record."
              />
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox
                id="access-reactivate"
                checked={reactivate}
                onCheckedChange={(value) => setReactivate(value === true)}
              />
              <Label htmlFor="access-reactivate" className="leading-5">
                Reactivate a previously revoked membership. Leave unchecked for
                a new or currently active account.
              </Label>
            </div>
            <div className="flex items-start gap-2 text-sm font-medium">
              <Checkbox
                id="access-confirmed"
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
              />
              <Label htmlFor="access-confirmed" className="leading-5">
                I confirm this role is necessary and appropriately scoped.
              </Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving || !confirmed}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Save platform access
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {revokeTarget ? (
        <RevokeAccessForm
          member={revokeTarget}
          onCancel={() => setRevokeTarget(null)}
          onComplete={async () => {
            setRevokeTarget(null);
            await refresh();
          }}
        />
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Current access</CardTitle>
          {generatedAt ? <Badge variant="outline">Live</Badge> : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {loadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}
          {!loading && !loadError ? (
            <>
              <AccessMembersTable
                members={members}
                onRevoke={setRevokeTarget}
              />
              {rosterTruncated && (
                <p className="text-sm text-amber-700" role="status">
                  Showing the first 100 platform members. Increase the roster
                  limit or paginate to manage additional members.
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
