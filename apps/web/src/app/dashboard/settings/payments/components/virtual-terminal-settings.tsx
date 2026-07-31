'use client';

import { Building2, Loader2, QrCode, User, Wallet } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVirtualTerminalSettings } from './use-virtual-terminal-settings';
import { VirtualTerminalAccountsTab } from './virtual-terminal-accounts-tab';
import { VirtualTerminalBranchesTab } from './virtual-terminal-branches-tab';
import type { StaffMember } from './virtual-terminal-types';

interface VirtualTerminalSettingsProps {
  businessName?: string;
  merchantId: string;
  staffMembers?: StaffMember[];
}

export function VirtualTerminalSettings({
  businessName,
  merchantId,
  staffMembers = [],
}: VirtualTerminalSettingsProps) {
  const settings = useVirtualTerminalSettings({ businessName, merchantId });

  if (settings.loading) {
    return (
      <Card aria-busy="true">
        <CardContent className="p-8 flex items-center justify-center">
          <div role="status" aria-label="Loading payment accounts">
            <Loader2
              className="size-8 animate-spin text-primary"
              aria-hidden="true"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
          <Wallet className="size-5" />
          Payment Accounts
        </h2>
        <CardDescription>
          Create accounts for staff and branches. All payments reconcile to your
          wallet.
        </CardDescription>
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
          <VirtualTerminalAccountsTab
            accounts={settings.accounts}
            branches={settings.branches}
            copyToClipboard={settings.copyToClipboard}
            creating={settings.creating}
            dialogOpen={settings.dialogOpen}
            handleCreateAccount={settings.handleCreateAccount}
            newAccount={settings.newAccount}
            setDialogOpen={settings.setDialogOpen}
            setNewAccount={settings.setNewAccount}
            staffMembers={staffMembers}
          />
          <VirtualTerminalBranchesTab
            branchDialogOpen={settings.branchDialogOpen}
            branches={settings.branches}
            creating={settings.creating}
            handleCreateBranch={settings.handleCreateBranch}
            newBranch={settings.newBranch}
            setBranchDialogOpen={settings.setBranchDialogOpen}
            setNewBranch={settings.setNewBranch}
          />
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
