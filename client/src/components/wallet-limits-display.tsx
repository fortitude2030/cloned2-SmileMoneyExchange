import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface WalletLimitsDisplayProps {
  wallet: {
    balance: string;
    dailyLimit: string;
    dailySpent: string;
    isActive: boolean;
  };
}

export default function WalletLimitsDisplay({ wallet }: WalletLimitsDisplayProps) {
  const formatCurrency = (amount: string) => {
    return `ZMW ${Math.round(parseFloat(amount || '0')).toLocaleString()}`;
  };

  const calculatePercentage = (spent: string, limit: string) => {
    const spentAmount = parseFloat(spent || '0');
    const limitAmount = parseFloat(limit || '1');
    return Math.min((spentAmount / limitAmount) * 100, 100);
  };

  const dailyPercentage = calculatePercentage(wallet.dailySpent, wallet.dailyLimit);
  const dailyRemaining = parseFloat(wallet.dailyLimit) - parseFloat(wallet.dailySpent || '0');
  const walletBalance = parseFloat(wallet.balance || '0');

  return (
    <div className="space-y-4">
      {/* Wallet Balance */}
      <Card className="shadow-sm border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-green-800 dark:text-green-200">Wallet Balance</h4>
            <span className={`text-sm px-2 py-1 rounded-full ${
              wallet.isActive 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {wallet.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="text-center py-2">
            <div className="text-2xl font-bold text-green-800 dark:text-green-200">
              {formatCurrency(wallet.balance)}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              Available for transactions
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Limit */}
      <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800 dark:text-gray-200">Daily Transfer Limit</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ZMW 1,000,000
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Spent today</span>
              <span className="font-medium">{formatCurrency(wallet.dailySpent)}</span>
            </div>
            <Progress value={dailyPercentage} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Remaining</span>
              <span className={`font-medium ${
                dailyRemaining < 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(Math.max(dailyRemaining, 0).toString())}
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
                  You're close to reaching your daily transfer limit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}