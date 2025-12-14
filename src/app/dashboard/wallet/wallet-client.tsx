'use client';

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CalendarClock,
  Clock,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  type PendingSettlement,
  type Transaction,
  updateWalletSettings,
  type WalletData,
  withdrawFunds,
} from './actions';

interface WalletClientProps {
  wallet: WalletData | null;
  pendingSettlements: PendingSettlement[];
  transactions: Transaction[];
  merchantId: string;
}

export default function WalletClient({
  wallet: initialWallet,
  pendingSettlements,
  transactions,
  merchantId,
}: WalletClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [withdrawing, setWithdrawing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // We use the prop directly. Updates come from server revalidation.
  const wallet = initialWallet;

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleWithdraw = async () => {
    if (!wallet?.canWithdraw) return;

    setWithdrawing(true);
    try {
      const result = await withdrawFunds(merchantId);

      if (!result.success) {
        throw new Error(result.error || 'Withdrawal failed');
      }

      toast({
        title: 'Success',
        description: `Successfully withdrew ₦${result.amount?.toLocaleString()}`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Withdrawal failed',
        variant: 'destructive',
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const updateSettings = async (updates: {
    autoPayoutEnabled?: boolean;
    autoPayoutDay?: string;
    minPayoutAmount?: number;
  }) => {
    setSavingSettings(true);
    try {
      const result = await updateWalletSettings(merchantId, updates);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update settings');
      }

      toast({ title: 'Success', description: 'Settings updated' });
      // No manual state update needed, revalidatePath in action handles it
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <ArrowDownToLine className="h-4 w-4 text-green-500" />;
      case 'withdrawal':
      case 'payout':
        return <ArrowUpFromLine className="h-4 w-4 text-blue-500" />;
      default:
        return <Wallet className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getGatewayBadge = (gateway: string) => {
    const colors: Record<string, string> = {
      paystack: 'bg-blue-100 text-blue-800',
      korapay: 'bg-purple-100 text-purple-800',
      credit_direct: 'bg-orange-100 text-orange-800',
      kuda: 'bg-green-100 text-green-800',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[gateway] || 'bg-gray-100 text-gray-800'}`}
      >
        {gateway.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">
            Track your earnings from sales and VTU commissions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Available Balance - Primary Card */}
        <Card className="md:col-span-2 lg:col-span-2 border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Available Balance
            </CardDescription>
            <CardTitle className="text-4xl text-green-600">
              ₦{wallet?.availableBalance.toLocaleString() || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="w-full"
                  disabled={!wallet?.canWithdraw || withdrawing}
                >
                  {withdrawing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowUpFromLine className="h-4 w-4 mr-2" />
                      Withdraw to Bank
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Withdrawal</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will transfer ₦
                    {wallet?.availableBalance.toLocaleString()} to your bank
                    account. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleWithdraw}>
                    Withdraw ₦{wallet?.availableBalance.toLocaleString()}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {!wallet?.canWithdraw && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Minimum ₦1,000 to withdraw
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Settlements */}
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Upcoming
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              ₦{wallet?.upcomingBalance?.toLocaleString() || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wallet?.nextSettlementDate ? (
              <p className="text-xs text-muted-foreground">
                {wallet.upcomingCount} settlement
                {wallet.upcomingCount !== 1 ? 's' : ''} arriving
                {wallet.nextSettlementDate && (
                  <span className="block font-medium text-amber-700">
                    Next: {formatShortDate(wallet.nextSettlementDate)}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No pending settlements
              </p>
            )}
          </CardContent>
        </Card>

        {/* Processing Payouts */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Processing
            </CardDescription>
            <CardTitle className="text-2xl">
              ₦{wallet?.pendingBalance.toLocaleString() || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Withdrawals in progress
            </p>
          </CardContent>
        </Card>

        {/* Total Earned */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Earned
            </CardDescription>
            <CardTitle className="text-2xl">
              ₦{wallet?.totalEarned.toLocaleString() || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Withdrawn: ₦{wallet?.totalWithdrawn.toLocaleString() || '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Settlements Section */}
      {pendingSettlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              Upcoming Settlements
            </CardTitle>
            <CardDescription>
              Payments that will be available soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingSettlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <ArrowDownToLine className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {settlement.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {getGatewayBadge(settlement.gateway)}
                        <span>•</span>
                        <span className="capitalize">
                          {settlement.sourceType.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      +₦{settlement.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(settlement.expectedDate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings and Transactions */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Auto-Payout Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Auto-Payout Settings
            </CardTitle>
            <CardDescription>
              Automatically withdraw earnings weekly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-payout">Enable Auto-Payout</Label>
              <Switch
                id="auto-payout"
                checked={wallet?.autoPayoutEnabled || false}
                onCheckedChange={(checked) =>
                  updateSettings({ autoPayoutEnabled: checked })
                }
                disabled={savingSettings}
              />
            </div>

            {wallet?.autoPayoutEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Payout Day</Label>
                  <Select
                    value={wallet?.autoPayoutDay || 'monday'}
                    onValueChange={(value) =>
                      updateSettings({ autoPayoutDay: value })
                    }
                    disabled={savingSettings}
                  >
                    <SelectTrigger aria-label="Select payout day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Minimum Payout Amount</Label>
                  <Select
                    value={String(wallet?.minPayoutAmount || 1000)}
                    onValueChange={(value) =>
                      updateSettings({ minPayoutAmount: Number(value) })
                    }
                    disabled={savingSettings}
                  >
                    <SelectTrigger aria-label="Select minimum payout amount">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="500">₦500</SelectItem>
                      <SelectItem value="1000">₦1,000</SelectItem>
                      <SelectItem value="2000">₦2,000</SelectItem>
                      <SelectItem value="5000">₦5,000</SelectItem>
                      <SelectItem value="10000">₦10,000</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Payout only triggers when balance exceeds this amount
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
            <CardDescription>Your wallet activity</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">
                  Earnings from sales and VTU will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(tx.type)}
                          <span className="capitalize">{tx.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          tx.type === 'credit'
                            ? 'text-green-600'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {tx.type === 'credit' ? '+' : '-'}₦
                        {tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
