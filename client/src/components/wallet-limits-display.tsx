import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface WalletLimitsDisplayProps {
  wallet: {
    dailyLimit: string;
    monthlyLimit: string;
    dailySpent: string;
    monthlySpent: string;
    isActive: boolean;
  };
}

export default function WalletLimitsDisplay({ wallet }: WalletLimitsDisplayProps) {
  const formatCurrency = (amount: string) => {
    return `ZMW ${parseFloat(amount || '0').toFixed(2)}`;
  };

  const calculatePercentage = (spent: string, limit: string) => {
    const spentAmount = parseFloat(spent || '0');
    const limitAmount = parseFloat(limit || '1');
    return Math.min((spentAmount / limitAmount) * 100, 100);
  };

  const dailyPercentage = calculatePercentage(wallet.dailySpent, wallet.dailyLimit);
  const monthlyPercentage = calculatePercentage(wallet.monthlySpent, wallet.monthlyLimit);
  
  const dailyRemaining = parseFloat(wallet.dailyLimit) - parseFloat(wallet.dailySpent || '0');
  const monthlyRemaining = parseFloat(wallet.monthlyLimit) - parseFloat(wallet.monthlySpent || '0');

  return (
    <div className="space-y-4">
      {/* Daily Limit */}
      <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800 dark:text-gray-200">Daily Transfer Limit</h4>
            <span className={`text-sm px-2 py-1 rounded-full ${
              wallet.isActive 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {wallet.isActive ? 'Active' : 'Inactive'}
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
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Limit: {formatCurrency(wallet.dailyLimit)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Limit */}
      <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800 dark:text-gray-200">Monthly Transfer Limit</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Spent this month</span>
              <span className="font-medium">{formatCurrency(wallet.monthlySpent)}</span>
            </div>
            <Progress value={monthlyPercentage} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Remaining</span>
              <span className={`font-medium ${
                monthlyRemaining < 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(Math.max(monthlyRemaining, 0).toString())}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Limit: {formatCurrency(wallet.monthlyLimit)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning for limits */}
      {(dailyPercentage > 80 || monthlyPercentage > 80) && (
        <Card className="shadow-sm border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-exclamation-triangle text-orange-600"></i>
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Approaching Transfer Limit
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-300">
                  You're close to reaching your transfer limits. Plan your transactions accordingly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}