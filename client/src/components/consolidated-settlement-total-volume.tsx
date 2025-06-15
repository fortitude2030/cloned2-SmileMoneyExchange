import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

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

export function ConsolidatedSettlementTotalVolume() {
  const { data: settlementData, isLoading } = useQuery<MonthlySettlementData>({
    queryKey: ['/api/monthly-settlement-breakdown', 'monthly'],
    queryFn: async () => {
      const response = await fetch(`/api/monthly-settlement-breakdown?period=monthly`);
      if (!response.ok) throw new Error('Failed to fetch settlement data');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
        <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    );
  }

  if (!settlementData) {
    return (
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Settlement data unavailable</p>
      </div>
    );
  }

  const totalVolume = settlementData.approved + settlementData.rejected + settlementData.pending;
  const totalCount = settlementData.approvedCount + settlementData.rejectedCount + settlementData.pendingCount;
  const successRate = settlementData.approvedCount + settlementData.rejectedCount > 0 ? 
    Math.round((settlementData.approvedCount / (settlementData.approvedCount + settlementData.rejectedCount)) * 100) : 0;

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <TrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">TOTAL VOLUME</p>
      </div>
      <h2 className="text-3xl font-bold dark:text-gray-200 mb-1 text-[#14532d]">
        {formatCurrency(totalVolume)}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
        {totalCount} total requests this month
      </p>
      <div className="flex items-center justify-center gap-3 text-xs">
        <div className="text-center">
          <p className="text-green-600 dark:text-green-400">Success Rate</p>
          <p className="font-semibold text-green-800 dark:text-green-200">{successRate}%</p>
        </div>
        <div className="text-center">
          <p className="text-blue-600 dark:text-blue-400">Last Updated</p>
          <p className="font-semibold text-blue-800 dark:text-blue-200">
            {new Date(settlementData.lastUpdated).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </div>
  );
}