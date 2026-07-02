'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Key,
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
import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  inviteStaffMember,
  removeStaffMember,
  resendInvitation,
  resetStaffPassword,
  updateStaffMember,
} from './actions';
import { type InviteStaffData, InviteStaffSchema } from './schema';

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
          <CheckCircle className="size-3 mr-1" />
          Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-600 border-amber-500/20"
        >
          <Clock className="size-3 mr-1" />
          Pending
        </Badge>
      );
    case 'suspended':
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-600 border-red-500/20"
        >
          <XCircle className="size-3 mr-1" />
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

interface TeamClientProps {
  initialStaff: StaffMember[];
}

export function TeamClient({ initialStaff }: TeamClientProps) {
  const staff = initialStaff;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [staffToRemove, setStaffToRemove] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [staffToEditRole, setStaffToEditRole] = useState<{
    id: string;
    email: string;
    currentRole: StaffRole;
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole>('sales_rep');

  const form = useForm<z.infer<typeof InviteStaffSchema>>({
    resolver: zodResolver(InviteStaffSchema),
    defaultValues: {
      email: '',
      name: '',
      role: 'sales_rep',
      autoCreateAccount: true,
    },
  });

  const { toast } = useToast();

  // Use Action State for better form handling.
  // Success/error side effects run inside the action itself (event context)
  // instead of mirroring the action result through an effect.
  const [, formAction, isBasePending] = useActionState<
    { success: boolean; message?: string; error?: string } | null,
    FormData
  >(
    async (
      _prevState: { success: boolean; message?: string; error?: string } | null,
      formData: FormData
    ) => {
      const data = {
        email: formData.get('email') as string,
        name: formData.get('name') as string,
        role: formData.get('role') as StaffRole,
        autoCreateAccount: formData.get('autoCreateAccount') === 'on',
      };

      try {
        const result = await inviteStaffMember(data as InviteStaffData);
        toast({
          title:
            result.emailSent === false ? 'Email Not Sent' : 'Invitation Sent',
          description: result.message,
          variant: result.emailSent === false ? 'destructive' : undefined,
        });
        form.reset();
        setInviteDialogOpen(false);
        router.refresh();
        return { success: true, message: result.message };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Invitation failed';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        return { success: false, error: message };
      }
    },
    null
  );

  const isInvitePending = isBasePending;

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const handleResendInvite = async (staffId: string) => {
    startTransition(async () => {
      try {
        const result = await resendInvitation(staffId);

        toast({
          title:
            result.emailSent === false ? 'Email Not Sent' : 'Invitation Resent',
          description: result.message,
          variant: result.emailSent === false ? 'destructive' : undefined,
        });

        router.refresh();
      } catch (error) {
        console.error('Failed to resend invitation:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to resend invitation.',
          variant: 'destructive',
        });
      }
    });
  };

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const handleResetPassword = async (staffId: string, email: string) => {
    startTransition(async () => {
      try {
        await resetStaffPassword(staffId);

        toast({
          title: 'Password Reset Sent',
          description: `A password reset email has been sent to ${email}.`,
        });
      } catch (error) {
        console.error('Failed to reset staff password:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to send password reset.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleRemoveStaff = (staffId: string, email: string) => {
    setStaffToRemove({ id: staffId, email });
    setRemoveDialogOpen(true);
  };

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const confirmRemoveStaff = async () => {
    if (!staffToRemove) return;

    startTransition(async () => {
      try {
        await removeStaffMember(staffToRemove.id);

        toast({
          title: 'Staff Removed',
          description: 'The team member has been removed.',
        });

        router.refresh();
      } catch (error) {
        console.error('Failed to remove team member:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to remove team member.',
          variant: 'destructive',
        });
      }
      // Always close the dialog (the catch above never rethrows, so this
      // runs on both success and failure — equivalent to the old finally).
      setRemoveDialogOpen(false);
      setStaffToRemove(null);
    });
  };

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const handleUpdateRole = async (
    staffId: string,
    newRole: StaffRole,
    onSuccess?: () => void
  ) => {
    startTransition(async () => {
      try {
        await updateStaffMember(staffId, { role: newRole });

        toast({
          title: 'Role Updated',
          description: `Role has been changed to ${ROLE_LABELS[newRole]}.`,
        });

        router.refresh();
        onSuccess?.();
      } catch (error) {
        console.error('Failed to update role:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update role.',
          variant: 'destructive',
        });
      }
    });
  };

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const handleSuspend = async (staffId: string, currentStatus: string) => {
    // Don't allow suspending pending invites - they should be removed instead
    if (currentStatus === 'pending') {
      toast({
        title: 'Cannot Suspend',
        description:
          'Pending invitations cannot be suspended. Remove and re-invite instead.',
        variant: 'destructive',
      });
      return;
    }

    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

    startTransition(async () => {
      try {
        await updateStaffMember(staffId, { status: newStatus });

        toast({
          title:
            newStatus === 'suspended' ? 'Staff Suspended' : 'Staff Reactivated',
          description:
            newStatus === 'suspended'
              ? 'This team member can no longer access the dashboard.'
              : 'This team member can now access the dashboard again.',
        });

        router.refresh();
      } catch (error) {
        console.error('Failed to update status:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update status.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
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
                <Users className="size-5" />
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
                  <UserPlus className="size-4 mr-2" />
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
                <Form {...form}>
                  <form action={formAction} className="grid gap-4 py-4">
                    <FormField<z.infer<typeof InviteStaffSchema>>
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="staff@example.com"
                              {...field}
                              value={field.value as string}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField<z.infer<typeof InviteStaffSchema>>
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="John Doe"
                              {...field}
                              value={field.value as string}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField<z.infer<typeof InviteStaffSchema>>
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value as string}
                            name="role"
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(ROLE_LABELS).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    <div className="flex flex-col items-start">
                                      <span>{label}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {ROLE_DESCRIPTIONS[value as StaffRole]}
                                      </span>
                                    </div>
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField<z.infer<typeof InviteStaffSchema>>
                      control={form.control}
                      name="autoCreateAccount"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                              name="autoCreateAccount"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Generate Staff Account (NUBAN)
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Automatically create a payment account for this
                              staff member.
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInviteDialogOpen(false)}
                        disabled={isInvitePending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isInvitePending}>
                        {isInvitePending ? (
                          <>
                            <Loader2 className="size-4 mr-2 motion-safe:animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Mail className="size-4 mr-2" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Staff Table */}
          {staff.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <Users className="size-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-medium mb-1">No team members yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Invite staff members to help manage your store.
              </p>
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="size-4 mr-2" />
                Invite Your First Team Member
              </Button>
            </div>
          ) : (
            <TooltipProvider>
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
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="secondary"
                                className="cursor-help"
                              >
                                <Shield className="size-3 mr-1" />
                                {ROLE_LABELS[member.role]}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                {ROLE_DESCRIPTIONS[member.role]}
                              </p>
                            </TooltipContent>
                          </Tooltip>
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
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {member.status === 'pending' && (
                                <DropdownMenuItem
                                  onClick={() => handleResendInvite(member.id)}
                                >
                                  <RefreshCw className="size-4 mr-2" />
                                  Resend Invitation
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  setStaffToEditRole({
                                    id: member.id,
                                    email: member.email,
                                    currentRole: member.role,
                                  });
                                  setSelectedRole(member.role);
                                  setRoleDialogOpen(true);
                                }}
                              >
                                <Shield className="size-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                              {member.status === 'active' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleResetPassword(member.id, member.email)
                                  }
                                >
                                  <Key className="size-4 mr-2" />
                                  Reset Password
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {member.status === 'active' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleSuspend(member.id, member.status)
                                  }
                                >
                                  <XCircle className="size-4 mr-2" />
                                  Suspend Access
                                </DropdownMenuItem>
                              )}
                              {member.status === 'suspended' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleSuspend(member.id, member.status)
                                  }
                                >
                                  <CheckCircle className="size-4 mr-2" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRemoveStaff(member.id, member.email)
                                }
                                className="text-red-600"
                              >
                                <Trash2 className="size-4 mr-2" />
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
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
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
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={confirmRemoveStaff}
            >
              <Trash2 className="size-4 mr-2" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for <strong>{staffToEditRole?.email}</strong>.
              Current role:{' '}
              {staffToEditRole && ROLE_LABELS[staffToEditRole.currentRole]}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="role-select">New Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as StaffRole)}
            >
              <SelectTrigger id="role-select" className="mt-2">
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRoleDialogOpen(false);
                setStaffToEditRole(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isPending || selectedRole === staffToEditRole?.currentRole
              }
              onClick={() => {
                if (staffToEditRole) {
                  handleUpdateRole(staffToEditRole.id, selectedRole, () => {
                    // Close dialog only after successful update
                    setRoleDialogOpen(false);
                    setStaffToEditRole(null);
                  });
                }
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 motion-safe:animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <Shield className="size-4 mr-2" />
                  Update Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
