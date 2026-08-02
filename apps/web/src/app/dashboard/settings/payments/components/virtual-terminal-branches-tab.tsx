import { Building2, Loader2, MapPin, Plus } from 'lucide-react';
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
import { TabsContent } from '@/components/ui/tabs';
import type { Branch, NewBranch } from './virtual-terminal-types';

interface VirtualTerminalBranchesTabProps {
  branchDialogOpen: boolean;
  branches: Branch[];
  creating: boolean;
  handleCreateBranch: () => Promise<void>;
  newBranch: NewBranch;
  setBranchDialogOpen: Dispatch<SetStateAction<boolean>>;
  setNewBranch: Dispatch<SetStateAction<NewBranch>>;
}

export function VirtualTerminalBranchesTab({
  branchDialogOpen,
  branches,
  creating,
  handleCreateBranch,
  newBranch,
  setBranchDialogOpen,
  setNewBranch,
}: VirtualTerminalBranchesTabProps) {
  return (
    <TabsContent value="branches" className="gap-y-4">
      <div className="flex justify-end">
        <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
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
                  onChange={(event) =>
                    setNewBranch({ ...newBranch, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-address">Address (Optional)</Label>
                <Input
                  id="branch-address"
                  placeholder="e.g. 123 Main Street"
                  value={newBranch.address}
                  onChange={(event) =>
                    setNewBranch({ ...newBranch, address: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-city">City (Optional)</Label>
                <Input
                  id="branch-city"
                  placeholder="e.g. Lagos"
                  value={newBranch.city}
                  onChange={(event) =>
                    setNewBranch({ ...newBranch, city: event.target.value })
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
                {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
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
                        <Badge variant="secondary" className="text-[10px]">
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
  );
}
