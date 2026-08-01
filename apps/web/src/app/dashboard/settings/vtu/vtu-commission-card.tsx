'use client';

import { Settings, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface VtuCommissionCardProps {
  commissionRate: number;
}

const COMMISSION_RATES = [
  { network: 'MTN / Airtel', rate: 3 },
  { network: 'Glo', rate: 4 },
  { network: '9mobile', rate: 5 },
];

export function VtuCommissionCard({ commissionRate }: VtuCommissionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5" />
          Commission & Earnings
        </CardTitle>
        <CardDescription>
          Earn commission on every VTU sale. Kuda provides up to 5% commission
          depending on provider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Your Commission Split</h4>
              <p className="text-sm text-muted-foreground">
                You receive {commissionRate}% of Kuda&apos;s commission
              </p>
            </div>
            <Badge className="text-lg px-4 py-1" variant="secondary">
              {commissionRate}% split
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Network</th>
                  <th className="text-center py-2 font-medium">Kuda Rate</th>
                  <th className="text-center py-2 font-medium">You Earn</th>
                  <th className="text-center py-2 font-medium">Platform</th>
                </tr>
              </thead>
              <tbody>
                {COMMISSION_RATES.map(({ network, rate }) => (
                  <tr className="border-b last:border-0" key={network}>
                    <td className="py-2">{network}</td>
                    <td className="text-center text-green-600 font-medium">
                      {rate}%
                    </td>
                    <td className="text-center text-blue-600">
                      {((rate * commissionRate) / 100).toFixed(1)}%
                    </td>
                    <td className="text-center text-purple-600">
                      {((rate * (100 - commissionRate)) / 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
            <Settings className="size-4" />
            Example Earnings
          </h4>
          <p className="text-sm text-blue-700">
            For every ₦10,000 MTN airtime sold (3% = ₦300 commission):
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1">
            <li>• Kuda commission: ₦300 (3%)</li>
            <li>
              • Your earnings: ₦
              {((300 * commissionRate) / 100).toLocaleString()} (
              {commissionRate}% of ₦300)
            </li>
            <li>
              • Platform: ₦
              {((300 * (100 - commissionRate)) / 100).toLocaleString()} (
              {100 - commissionRate}% of ₦300)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
