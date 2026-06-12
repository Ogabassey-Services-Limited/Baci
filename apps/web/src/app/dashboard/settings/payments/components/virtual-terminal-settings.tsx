'use client';

import {
  Building2,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  User,
  Wallet,
} from 'lucide-react';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface StaffAccount {
  id: string;
  code: string;
  name: string;
  account_number: string | null;
  account_name: string | null;
  bank: string | null;
  payment_link: string | null;
  active: boolean;
  staff_id: string | null;
  branch_id: string | null;
  staff_members?: {
    id: string;
    full_name: string;
  } | null;
  branches?: {
    id: string;
    name: string;
  } | null;
}

interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  is_default: boolean;
  active: boolean;
}

interface StaffMember {
  id: string;
  full_name: string;
}

interface StaffAccountSettingsProps {
  businessName?: string;
  staffMembers?: StaffMember[];
}

type ToastFn = ReturnType<typeof useToast>['toast'];

// Module-scope helpers keep try/finally and throw-in-try out of the component
// body so React Compiler can memoize the component.
async function loadVirtualTerminalData(options: {
  setAccounts: Dispatch<SetStateAction<StaffAccount[]>>;
  setBranches: Dispatch<SetStateAction<Branch[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  toast: ToastFn;
}): Promise<void> {
  const { setAccounts, setBranches, setLoading, toast } = options;
  try {
    const [accountsRes, branchesRes] = await Promise.all([
      fetch('/api/paystack/virtual-terminal'),
      fetch('/api/branches'),
    ]);

    // Handle accounts response with user-facing error
    if (accountsRes.ok) {
      const data = await accountsRes.json();
      setAccounts(data.terminals || []);
    } else {
      console.error('Failed to fetch accounts:', accountsRes.status);
      toast({
        variant: 'destructive',
        title: 'Failed to load accounts',
        description: 'Unable to fetch staff accounts. Please refresh the page.',
      });
    }

    // Handle branches response with user-facing error
    if (branchesRes.ok) {
      const data = await branchesRes.json();
      setBranches(data.branches || []);
    } else {
      console.error('Failed to fetch branches:', branchesRes.status);
      toast({
        variant: 'destructive',
        title: 'Failed to load branches',
        description: 'Unable to fetch branch data. Please refresh the page.',
      });
    }
  } catch (error) {
    console.error('Failed to fetch data:', error);
    toast({
      variant: 'destructive',
      title: 'Connection error',
      description:
        'Unable to connect to the server. Please check your connection.',
    });
  } finally {
    setLoading(false);
  }
}

async function submitNewAccount(options: {
  body: {
    name: string;
    staffId?: string;
    branchId?: string;
    destinations: never[];
  };
  refresh: () => Promise<void>;
  onSuccess: () => void;
  setCreating: Dispatch<SetStateAction<boolean>>;
  toast: ToastFn;
}): Promise<void> {
  const { body, refresh, onSuccess, setCreating, toast } = options;
  setCreating(true);
  try {
    const response = await fetch('/api/paystack/virtual-terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      await refresh();
      onSuccess();
      toast({
        title: 'Staff Account Created',
        description: 'New payment account is ready to receive payments.',
      });
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create account');
    }
  } catch (error: unknown) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description:
        error instanceof Error ? error.message : 'Failed to create account',
    });
  } finally {
    setCreating(false);
  }
}

async function submitNewBranch(options: {
  body: { name: string; address?: string; city?: string; isDefault: boolean };
  refresh: () => Promise<void>;
  onSuccess: () => void;
  setCreating: Dispatch<SetStateAction<boolean>>;
  toast: ToastFn;
}): Promise<void> {
  const { body, refresh, onSuccess, setCreating, toast } = options;
  setCreating(true);
  try {
    const response = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      await refresh();
      onSuccess();
      toast({
        title: 'Branch Created',
        description: `${body.name} has been added.`,
      });
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create branch');
    }
  } catch (error: unknown) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description:
        error instanceof Error ? error.message : 'Failed to create branch',
    });
  } finally {
    setCreating(false);
  }
}

export function VirtualTerminalSettings({
  businessName,
  staffMembers = [],
}: StaffAccountSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    staffId: '',
    branchId: '',
  });
  const [newBranch, setNewBranch] = useState({
    name: '',
    address: '',
    city: '',
  });

  const fetchData = () =>
    loadVirtualTerminalData({ setAccounts, setBranches, setLoading, toast });

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    fetchData();
  }, [toast]);

  const handleCreateAccount = async () => {
    if (!newAccount.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Account name is required',
      });
      return;
    }

    await submitNewAccount({
      body: {
        name: newAccount.name || `${businessName} Account`,
        staffId: newAccount.staffId || undefined,
        branchId: newAccount.branchId || undefined,
        destinations: [],
      },
      refresh: fetchData,
      onSuccess: () => {
        setDialogOpen(false);
        setNewAccount({ name: '', staffId: '', branchId: '' });
      },
      setCreating,
      toast,
    });
  };

  const handleCreateBranch = async () => {
    if (!newBranch.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Branch name is required',
      });
      return;
    }

    await submitNewBranch({
      body: {
        name: newBranch.name,
        address: newBranch.address || undefined,
        city: newBranch.city || undefined,
        isDefault: branches.length === 0,
      },
      refresh: fetchData,
      onSuccess: () => {
        setBranchDialogOpen(false);
        setNewBranch({ name: '', address: '', city: '' });
      },
      setCreating,
      toast,
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Unable to copy to clipboard.',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5" />
              Payment Accounts
            </CardTitle>
            <CardDescription>
              Create accounts for staff and branches. All payments reconcile to
              your wallet.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="accounts" className="gap-y-4">
          <TabsList>
            <TabsTrigger value="accounts" className="flex items-center gap-1.5">
              <User className="size-4" />
              Staff Accounts
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-1.5">
              <Building2 className="size-4" />
              Branches
            </TabsTrigger>
          </TabsList>

          {/* Staff Accounts Tab */}
          <TabsContent value="accounts" className="gap-y-4">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="size-4 mr-1" />
                    New Staff Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Staff Account</DialogTitle>
                    <DialogDescription>
                      Each account gets its own bank account number for
                      tracking.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="gap-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="account-name">Account Name</Label>
                      <Input
                        id="account-name"
                        placeholder="e.g. Kola's Account or Front Desk"
                        value={newAccount.name}
                        onChange={(e) =>
                          setNewAccount({ ...newAccount, name: e.target.value })
                        }
                      />
                    </div>
                    {branches.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="branch-assign">Branch (Optional)</Label>
                        <Select
                          value={newAccount.branchId}
                          onValueChange={(value) =>
                            setNewAccount({ ...newAccount, branchId: value })
                          }
                        >
                          <SelectTrigger id="branch-assign">
                            <SelectValue placeholder="Select branch..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No branch</SelectItem>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {staffMembers.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="staff-assign">
                          Staff Member (Optional)
                        </Label>
                        <Select
                          value={newAccount.staffId}
                          onValueChange={(value) =>
                            setNewAccount({ ...newAccount, staffId: value })
                          }
                        >
                          <SelectTrigger id="staff-assign">
                            <SelectValue placeholder="Select staff..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No assignment</SelectItem>
                            {staffMembers.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id}>
                                {staff.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateAccount} disabled={creating}>
                      {creating && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Create Account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-y-4 border-2 border-dashed rounded-lg">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="size-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">No Staff Accounts Yet</h4>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Create accounts for your staff to track individual sales.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <User className="size-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{account.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {account.staff_members?.full_name || account.code}
                            {account.branches && ` • ${account.branches.name}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={account.active ? 'default' : 'secondary'}>
                        {account.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      {account.account_number && (
                        <div className="p-3 rounded-lg bg-muted/50 border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              Account Number
                            </span>
                            <Copy
                              className="size-3 cursor-pointer text-muted-foreground hover:text-primary"
                              onClick={() =>
                                copyToClipboard(
                                  account.account_number || '',
                                  'Account Number'
                                )
                              }
                            />
                          </div>
                          <p className="text-lg font-bold">
                            {account.account_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {account.bank}
                          </p>
                        </div>
                      )}

                      {account.payment_link && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              Payment Link
                            </span>
                            <a
                              href={account.payment_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-xs"
                            >
                              Open <ExternalLink className="size-3" />
                            </a>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs h-7 px-2"
                            onClick={() =>
                              copyToClipboard(
                                account.payment_link || '',
                                'Link'
                              )
                            }
                          >
                            <Copy className="size-3 mr-1" />
                            Copy Link
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Branches Tab */}
          <TabsContent value="branches" className="gap-y-4">
            <div className="flex justify-end">
              <Dialog
                open={branchDialogOpen}
                onOpenChange={setBranchDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="size-4 mr-1" />
                    New Branch
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Branch</DialogTitle>
                    <DialogDescription>
                      Add a new store location to organize your staff accounts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="gap-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="branch-name">Branch Name</Label>
                      <Input
                        id="branch-name"
                        placeholder="e.g. Lagos Main Store"
                        value={newBranch.name}
                        onChange={(e) =>
                          setNewBranch({ ...newBranch, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-address">Address (Optional)</Label>
                      <Input
                        id="branch-address"
                        placeholder="e.g. 123 Main Street"
                        value={newBranch.address}
                        onChange={(e) =>
                          setNewBranch({
                            ...newBranch,
                            address: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-city">City (Optional)</Label>
                      <Input
                        id="branch-city"
                        placeholder="e.g. Lagos"
                        value={newBranch.city}
                        onChange={(e) =>
                          setNewBranch({ ...newBranch, city: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setBranchDialogOpen(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateBranch} disabled={creating}>
                      {creating && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Create Branch
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {branches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-y-4 border-2 border-dashed rounded-lg">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="size-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">No Branches Yet</h4>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Add branch locations to organize staff accounts by store.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <MapPin className="size-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {branch.name}
                            {branch.is_default && (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                Default
                              </Badge>
                            )}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {branch.city || branch.address || 'No address'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={branch.active ? 'default' : 'secondary'}>
                        {branch.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex gap-3">
          <QrCode
            className="size-5 text-blue-600 dark:text-blue-400 shrink-0"
            aria-hidden="true"
          />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            <strong>Pro Tip:</strong> Download printable QR codes from your
            Paystack Dashboard for each account to display at physical
            locations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
