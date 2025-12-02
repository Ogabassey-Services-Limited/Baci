'use client';

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Copy,
  Info,
  Loader2,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { StaffMember, StaffRole } from '@/types/staff';

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administrator',
  manager: 'Store Manager',
  sales_rep: 'Sales Representative',
  inventory: 'Inventory Manager',
  accountant: 'Accountant',
  customer_service: 'Customer Service',
  marketing: 'Marketing',
  fulfillment: 'Fulfillment',
};

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: 'Full access to all features except billing',
  manager: 'Manage orders, products, customers, and marketing',
  sales_rep: 'Create orders and manage customers',
  inventory: 'Manage products and stock levels',
  accountant: 'View orders, reports, and analytics (read-only)',
  customer_service: 'Handle orders and customer inquiries',
  marketing: 'Manage marketing, discounts, and content',
  fulfillment: 'Process and ship orders',
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-600 border-amber-500/20"
        >
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'suspended':
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-600 border-red-500/20"
        >
          <XCircle className="h-3 w-3 mr-1" />
          Suspended
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TeamSettingsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [staffToRemove, setStaffToRemove] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'sales_rep' as StaffRole,
  });
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/staff');
      if (!response.ok) throw new Error('Failed to fetch staff');
      const data = await response.json();
      setStaff(data.staff || []);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteForm.email) {
      toast({
        title: 'Error',
        description: 'Please enter an email address.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setInviting(true);
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite staff member');
      }

      toast({
        title: 'Invitation Sent',
        description: `An invitation has been sent to ${inviteForm.email}`,
      });

      setLastInviteUrl(data.inviteUrl);
      setInviteForm({ email: '', name: '', role: 'sales_rep' });
      fetchStaff();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to send invitation.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (staffId: string) => {
    try {
      const response = await fetch(`/api/staff/${staffId}`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to resend invitation');

      const data = await response.json();
      setLastInviteUrl(data.inviteUrl);

      toast({
        title: 'Invitation Resent',
        description: 'The invitation has been resent.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to resend invitation.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveStaff = async (staffId: string, email: string) => {
    setStaffToRemove({ id: staffId, email });
    setRemoveDialogOpen(true);
  };

  const confirmRemoveStaff = async () => {
    if (!staffToRemove) return;

    try {
      const response = await fetch(`/api/staff/${staffToRemove.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove staff member');

      toast({
        title: 'Staff Removed',
        description: 'The team member has been removed.',
      });

      fetchStaff();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove team member.',
        variant: 'destructive',
      });
    } finally {
      setRemoveDialogOpen(false);
      setStaffToRemove(null);
    }
  };

  const handleUpdateRole = async (staffId: string, newRole: StaffRole) => {
    try {
      const response = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error('Failed to update role');

      toast({
        title: 'Role Updated',
        description: `Role has been changed to ${ROLE_LABELS[newRole]}.`,
      });

      fetchStaff();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update role.',
        variant: 'destructive',
      });
    }
  };

  const handleSuspend = async (staffId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

    try {
      const response = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast({
        title:
          newStatus === 'suspended' ? 'Staff Suspended' : 'Staff Reactivated',
        description:
          newStatus === 'suspended'
            ? 'This team member can no longer access the dashboard.'
            : 'This team member can now access the dashboard again.',
      });

      fetchStaff();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update status.',
        variant: 'destructive',
      });
    }
  };

  const copyInviteLink = () => {
    if (lastInviteUrl) {
      navigator.clipboard.writeText(lastInviteUrl);
      toast({
        title: 'Copied',
        description: 'Invite link copied to clipboard.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Invite and manage staff members with role-based permissions.
          </p>
        </div>
      </div>

      {/* Invite Card */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                {staff.length} team member{staff.length !== 1 ? 's' : ''}{' '}
                (excluding you)
              </CardDescription>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Team Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your store as a staff member.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInvite}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="staff@example.com"
                        value={inviteForm.email}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name (optional)</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={inviteForm.name}
                        onChange={(e) =>
                          setInviteForm({ ...inviteForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(value) =>
                          setInviteForm({
                            ...inviteForm,
                            role: value as StaffRole,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex flex-col items-start">
                                <span>{label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {ROLE_DESCRIPTIONS[value as StaffRole]}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviting}>
                      {inviting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Last invite URL */}
          {lastInviteUrl && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Invitation Link</AlertTitle>
              <AlertDescription className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {lastInviteUrl}
                </code>
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Staff Table */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-1">No team members yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Invite staff members to help manage your store.
              </p>
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Your First Team Member
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {member.name || member.email}
                          </p>
                          {member.name && (
                            <p className="text-sm text-muted-foreground">
                              {member.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="secondary"
                                className="cursor-help"
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                {ROLE_LABELS[member.role]}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                {ROLE_DESCRIPTIONS[member.role]}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>{getStatusBadge(member.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.status === 'pending' ? (
                          <span className="text-amber-600">
                            Invited {formatDate(member.invited_at)}
                          </span>
                        ) : (
                          formatDate(member.accepted_at)
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.status === 'pending' && (
                              <DropdownMenuItem
                                onClick={() => handleResendInvite(member.id)}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resend Invitation
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                const newRole = prompt(
                                  `Change role for ${member.email}. Current: ${ROLE_LABELS[member.role]}\n\nAvailable roles:\n` +
                                    Object.entries(ROLE_LABELS)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join('\n'),
                                  member.role
                                );
                                if (newRole && newRole in ROLE_LABELS) {
                                  handleUpdateRole(
                                    member.id,
                                    newRole as StaffRole
                                  );
                                }
                              }}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {member.status === 'active' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleSuspend(member.id, member.status)
                                }
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Suspend Access
                              </DropdownMenuItem>
                            )}
                            {member.status === 'suspended' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleSuspend(member.id, member.status)
                                }
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                handleRemoveStaff(member.id, member.email)
                              }
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            Overview of what each role can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <Card key={role} className="border-dashed">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">{label}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role as StaffRole]}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{staffToRemove?.email}</strong> from your team? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false);
                setStaffToRemove(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveStaff}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
