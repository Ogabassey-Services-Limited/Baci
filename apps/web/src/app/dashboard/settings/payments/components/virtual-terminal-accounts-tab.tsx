import { Copy, ExternalLink, Loader2, Plus, User } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { TabsContent } from '@/components/ui/tabs';
import type {
  Branch,
  NewStaffAccount,
  StaffAccount,
  StaffMember,
} from './virtual-terminal-types';

interface VirtualTerminalAccountsTabProps {
  accounts: StaffAccount[];
  branches: Branch[];
  copyToClipboard: (text: string, label: string) => Promise<void>;
  creating: boolean;
  dialogOpen: boolean;
  handleCreateAccount: () => Promise<void>;
  newAccount: NewStaffAccount;
  setDialogOpen: Dispatch<SetStateAction<boolean>>;
  setNewAccount: Dispatch<SetStateAction<NewStaffAccount>>;
  staffMembers: StaffMember[];
}

export function VirtualTerminalAccountsTab({
  accounts,
  branches,
  copyToClipboard,
  creating,
  dialogOpen,
  handleCreateAccount,
  newAccount,
  setDialogOpen,
  setNewAccount,
  staffMembers,
}: VirtualTerminalAccountsTabProps) {
  return (
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
                Each account gets its own bank account number for tracking.
              </DialogDescription>
            </DialogHeader>
            <div className="gap-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  placeholder="e.g. Kola's Account or Front Desk"
                  value={newAccount.name}
                  onChange={(event) =>
                    setNewAccount({ ...newAccount, name: event.target.value })
                  }
                />
              </div>
              {branches.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="branch-assign">Branch (Optional)</Label>
                  <Select
                    value={newAccount.branchId}
                    onValueChange={(branchId) =>
                      setNewAccount({ ...newAccount, branchId })
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
                  <Label htmlFor="staff-assign">Staff Member (Optional)</Label>
                  <Select
                    value={newAccount.staffId}
                    onValueChange={(staffId) =>
                      setNewAccount({ ...newAccount, staffId })
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
                {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
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
                        copyToClipboard(account.payment_link || '', 'Link')
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
  );
}
