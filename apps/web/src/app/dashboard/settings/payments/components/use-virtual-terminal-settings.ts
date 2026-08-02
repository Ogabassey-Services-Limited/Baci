import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  createVirtualTerminalAccount,
  createVirtualTerminalBranch,
  fetchVirtualTerminalData,
  VirtualTerminalRequestError,
} from './virtual-terminal-requests';
import type {
  Branch,
  NewBranch,
  NewStaffAccount,
  StaffAccount,
} from './virtual-terminal-types';

const EMPTY_ACCOUNT: NewStaffAccount = { name: '', staffId: '', branchId: '' };
const EMPTY_BRANCH: NewBranch = { name: '', address: '', city: '' };

export function useVirtualTerminalSettings(options: {
  businessName?: string;
  merchantId: string;
}) {
  const { businessName, merchantId } = options;
  const { toast } = useToast();
  const requestSequence = useRef(0);
  const currentMerchantId = useRef(merchantId);
  const [loadedMerchantId, setLoadedMerchantId] = useState<string | null>(null);
  const [creatingMerchantId, setCreatingMerchantId] = useState<string | null>(
    null
  );
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState(EMPTY_ACCOUNT);
  const [newBranch, setNewBranch] = useState(EMPTY_BRANCH);

  useLayoutEffect(() => {
    currentMerchantId.current = merchantId;
  }, [merchantId]);

  const refresh = async () => {
    const sequence = ++requestSequence.current;
    setLoadedMerchantId(null);
    try {
      const data = await fetchVirtualTerminalData(merchantId);
      if (
        requestSequence.current !== sequence ||
        currentMerchantId.current !== merchantId
      ) {
        return;
      }
      if (!data.accounts.error) {
        setAccounts(data.accounts.data);
      }
      if (!data.branches.error) {
        setBranches(data.branches.data);
      }
      const requestError = data.accounts.error || data.branches.error;
      if (requestError) {
        toast({
          variant: 'destructive',
          title:
            requestError.resource === 'accounts'
              ? 'Failed to load accounts'
              : requestError.resource === 'branches'
                ? 'Failed to load branches'
                : 'Connection error',
          description: requestError.message,
        });
      }
      setLoadedMerchantId(merchantId);
    } catch (error) {
      if (
        requestSequence.current !== sequence ||
        currentMerchantId.current !== merchantId
      ) {
        return;
      }
      const requestError =
        error instanceof VirtualTerminalRequestError ? error : null;
      toast({
        variant: 'destructive',
        title:
          requestError?.resource === 'accounts'
            ? 'Failed to load accounts'
            : requestError?.resource === 'branches'
              ? 'Failed to load branches'
              : 'Connection error',
        description:
          requestError?.message ||
          'Unable to connect to the server. Please check your connection.',
      });
      setLoadedMerchantId(merchantId);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: merchant-scoped reload intentionally resets all tenant state
  useEffect(() => {
    requestSequence.current += 1;
    setAccounts([]);
    setBranches([]);
    setCreatingMerchantId(null);
    setDialogOpen(false);
    setBranchDialogOpen(false);
    setNewAccount(EMPTY_ACCOUNT);
    setNewBranch(EMPTY_BRANCH);
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [merchantId]);

  const handleCreateAccount = async () => {
    if (!newAccount.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Account name is required',
      });
      return;
    }
    const mutationMerchantId = merchantId;
    setCreatingMerchantId(mutationMerchantId);
    try {
      await createVirtualTerminalAccount(mutationMerchantId, {
        name: newAccount.name || `${businessName} Account`,
        staffId: newAccount.staffId || undefined,
        branchId: newAccount.branchId || undefined,
        destinations: [],
      });
      if (currentMerchantId.current !== mutationMerchantId) return;
      await refresh();
      if (currentMerchantId.current !== mutationMerchantId) return;
      setDialogOpen(false);
      setNewAccount(EMPTY_ACCOUNT);
      toast({
        title: 'Staff Account Created',
        description: 'New payment account is ready to receive payments.',
      });
    } catch (error) {
      if (currentMerchantId.current !== mutationMerchantId) return;
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create account',
      });
    } finally {
      if (currentMerchantId.current === mutationMerchantId) {
        setCreatingMerchantId(null);
      }
    }
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
    const mutationMerchantId = merchantId;
    setCreatingMerchantId(mutationMerchantId);
    try {
      await createVirtualTerminalBranch(mutationMerchantId, {
        name: newBranch.name,
        address: newBranch.address || undefined,
        city: newBranch.city || undefined,
        isDefault: branches.length === 0,
      });
      if (currentMerchantId.current !== mutationMerchantId) return;
      await refresh();
      if (currentMerchantId.current !== mutationMerchantId) return;
      setBranchDialogOpen(false);
      setNewBranch(EMPTY_BRANCH);
      toast({
        title: 'Branch Created',
        description: `${newBranch.name} has been added.`,
      });
    } catch (error) {
      if (currentMerchantId.current !== mutationMerchantId) return;
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create branch',
      });
    } finally {
      if (currentMerchantId.current === mutationMerchantId) {
        setCreatingMerchantId(null);
      }
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Unable to copy to clipboard.',
      });
    }
  };

  return {
    accounts,
    branches,
    branchDialogOpen,
    copyToClipboard,
    creating: creatingMerchantId === merchantId,
    dialogOpen,
    handleCreateAccount,
    handleCreateBranch,
    loading: loadedMerchantId !== merchantId,
    newAccount,
    newBranch,
    setBranchDialogOpen,
    setDialogOpen,
    setNewAccount,
    setNewBranch,
  };
}
