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

export function ConsolidatedSettlementCard() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  const { data: settlementData, isLoading, error } = useQuery<MonthlySettlementData>({
    queryKey: ['/api/monthly-settlement-breakdown', period],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/monthly-settlement-breakdown?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          // Return default data for unauthorized access
          return {
            approved: 0,
            rejected: 0,
            pending: 0,
            approvedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
            period: period,
            lastUpdated: new Date().toISOString(),
          };
        }
        throw new Error('Failed to fetch settlement data');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every 60 seconds to reduce flashing
    refetchOnWindowFocus: false,
    staleTime: 45000,
    retry: false,
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
      case 'yearly': return 'Year to Date (YTD)';
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
    <Card className="w-full min-h-[350px] shadow-sm border border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Settlement Overview
            </CardTitle>
            <CardDescription className="mt-1">
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
      <CardContent className="pt-2">
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

            

            {/* Period Info */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              {period === 'monthly' && (
                <p>Monthly data automatically renews on the 1st of each month</p>
              )}
              {period === 'weekly' && (
                <p>Weekly data shows settlements from the last 7 days</p>
              )}
              {period === 'yearly' && (
                <p>YTD data shows settlements from January 1st to current date</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}