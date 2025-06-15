import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Calendar, TrendingUp, TrendingDown, Clock, Filter } from "lucide-react";
import { useState } from "react";

interface MonthlySettlementData {
  approved: number;
  rejected: number;
  pending: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  lastUpdated: string;
}

interface WalletData {
  balance: string;
}

export function ConsolidatedSettlementCard() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  const { data: settlementData, isLoading } = useQuery<MonthlySettlementData>({
    queryKey: ['/api/monthly-settlement-breakdown', period],
    queryFn: async () => {
      const response = await fetch(`/api/monthly-settlement-breakdown?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch settlement data');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: walletData } = useQuery<WalletData>({
    queryKey: ['/api/wallet'],
    refetchInterval: 30000,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'weekly': return 'Last 7 Days';
      case 'monthly': return 'This Month';
      case 'yearly': return 'Last 12 Months';
      default: return 'This Month';
    }
  };

  const getNextRenewalDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Settlement Overview
              </CardTitle>
              <CardDescription>Loading settlement data...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded mb-4"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Settlement Overview
            </CardTitle>
            <CardDescription>
              {getPeriodLabel(period)} • Auto-renews {period === 'monthly' ? `on ${getNextRenewalDate()}` : 'daily'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={period} onValueChange={(value: 'weekly' | 'monthly' | 'yearly') => setPeriod(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {settlementData && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Approved */}
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Approved</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                      {formatCurrency(settlementData.approved)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500">
                      {settlementData.approvedCount} requests
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>

              {/* Rejected */}
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Rejected</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-300">
                      {formatCurrency(settlementData.rejected)}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500">
                      {settlementData.rejectedCount} requests
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>

              {/* Pending */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Pending</p>
                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">
                      {formatCurrency(settlementData.pending)}
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      {settlementData.pendingCount} requests
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </div>

            {/* Total Volume and Organization Funds - Two Column Layout */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Volume Column */}
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Total Volume</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-300">
                    {formatCurrency(settlementData.approved + settlementData.rejected + settlementData.pending)}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">
                    {settlementData.approvedCount + settlementData.rejectedCount + settlementData.pendingCount} total requests
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                    Success Rate: {settlementData.approvedCount + settlementData.rejectedCount > 0 ? 
                      Math.round((settlementData.approvedCount / (settlementData.approvedCount + settlementData.rejectedCount)) * 100) : 0}%
                  </p>
                </div>
                
                {/* Organization Funds Column */}
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Organization Funds</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-300">
                    {walletData ? formatCurrency(Math.floor(parseFloat(walletData.balance || '0'))) : 'Loading...'}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">
                    Total Wallet Balance
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                    Last updated: {new Date(settlementData.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Period Info */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              {period === 'monthly' && (
                <p>Monthly data automatically renews on the 1st of each month</p>
              )}
              {period === 'weekly' && (
                <p>Weekly data shows settlements from the last 7 days</p>
              )}
              {period === 'yearly' && (
                <p>Yearly data shows settlements from the last 12 months</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}