import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface WalletLimitsDisplayProps {
  wallet: {
    balance: string;
    dailyLimit: string;
    dailyCollected: string;
    dailyTransferred: string;
    isActive: boolean;
    todayCompleted?: string;
    todayTotal?: string;
  };
  userRole: string;
}

export default function WalletLimitsDisplay({ wallet, userRole }: WalletLimitsDisplayProps) {
  const formatCurrency = (amount: string) => {
    return `ZMW ${Math.round(parseFloat(amount || '0')).toLocaleString()}`;
  };

  const calculatePercentage = (used: string, limit: string) => {
    const usedAmount = Math.round(parseFloat(used || '0'));
    const limitAmount = Math.round(parseFloat(limit || '1'));
    return Math.min((usedAmount / limitAmount) * 100, 100);
  };

  // Different logic for merchants vs cashiers
  const isMerchant = userRole === 'merchant';
  const isCashier = userRole === 'cashier';
  
  const dailyLimit = isMerchant ? 1000000 : 2000000; // Merchants: 1M collection limit, Cashiers: 2M transfer limit
  const walletBalance = Math.round(parseFloat(wallet.balance || '0'));
  
  // For merchants: dailyUsed = wallet balance (today's collections)
  // For cashiers: dailyUsed = daily transferred amount
  const dailyUsed = isMerchant 
    ? walletBalance // Use wallet balance as it represents today's collections for merchants
    : Math.round(parseFloat(wallet.dailyTransferred || '0'));
  
  const dailyRemaining = Math.max(dailyLimit - dailyUsed, 0);
  const dailyPercentage = Math.min((dailyUsed / dailyLimit) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Wallet Balance */}
      <Card className="shadow-sm border border-green-400 dark:border-green-500 bg-green-400 dark:bg-green-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-black dark:text-white">Wallet Balance</h4>
            <span className={`text-sm px-2 py-1 rounded-full ${
              wallet.isActive 
                ? 'bg-black/20 text-black dark:bg-white/20 dark:text-white' 
                : 'bg-red-500 text-white dark:bg-red-600 dark:text-white'
            }`}>
              {wallet.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="text-center py-2">
            <div className="text-2xl font-bold text-black dark:text-white">
              {formatCurrency(walletBalance.toString())}
            </div>
            <div className="text-xs text-black/70 dark:text-white/70">
              {isMerchant ? "Total digital money received today" : "Available balance"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Limit */}
      <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800 dark:text-gray-200">
              {isMerchant ? 'Daily Collection Limit' : 'Daily Transfer Limit'}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatCurrency(dailyLimit.toString())}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {isMerchant ? 'Used up Daily Limit' : 'Transferred today'}
              </span>
              <span className="font-medium text-black dark:text-white">
                {isMerchant ? '-' : '-'}{formatCurrency(dailyUsed.toString())}
              </span>
            </div>
            <Progress value={dailyPercentage} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {isMerchant ? 'Remaining Limit Today' : 'Remaining'}
              </span>
              <span className={`font-medium ${
                dailyRemaining < 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(dailyRemaining.toString())}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning for limits */}
      {dailyPercentage > 80 && (
        <Card className="shadow-sm border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-exclamation-triangle text-orange-600"></i>
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Approaching Daily Limit
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-300">
                  You're close to reaching your daily {isMerchant ? 'collection' : 'transfer'} limit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}