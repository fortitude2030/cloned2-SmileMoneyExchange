import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

interface Wallet {
  id: number;
  userId: string;
  balance: string;
  dailySpent: string;
  dailyCollected: string;
  lastResetDate: string | null;
}

export function ConsolidatedSettlementTotalVolume() {
  const { data: wallet, isLoading } = useQuery<Wallet>({
    queryKey: ['/api/wallet'],
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

  if (!wallet) {
    return (
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Wallet data unavailable</p>
      </div>
    );
  }

  const balance = parseFloat(wallet.balance || '0');
  const dailySpent = parseFloat(wallet.dailySpent || '0');

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Wallet className="h-4 w-4 text-green-600 dark:text-green-400" />
        <p className="text-green-700 dark:text-green-300 text-sm font-medium">ORGANIZATION FUNDS</p>
      </div>
      <h2 className="text-3xl font-bold text-green-800 dark:text-green-200 mb-1">
        {formatCurrency(balance)}
      </h2>
      <p className="text-green-600 dark:text-green-400 text-xs mb-2">
        Available for settlements
      </p>
      <div className="flex items-center justify-center gap-3 text-xs">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Today's Usage</p>
          <p className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(dailySpent)}</p>
        </div>
        <div className="text-center">
          <p className="text-blue-600 dark:text-blue-400">Last Updated</p>
          <p className="font-semibold text-blue-800 dark:text-blue-200">
            {new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </div>
  );
}