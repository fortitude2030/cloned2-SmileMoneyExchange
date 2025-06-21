import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, TrendingUp, DollarSign, FileText, BarChart3, Download, Share2, Settings } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface FinancialStatement {
  assets: { [key: string]: { name: string; balance: number } };
  liabilities: { [key: string]: { name: string; balance: number } };
  equity: { [key: string]: { name: string; balance: number } };
  revenue: { [key: string]: { name: string; balance: number } };
  expenses: { [key: string]: { name: string; balance: number } };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

interface RevenueReport {
  transactionFees: number;
  settlementFees: number;
  monthlyServiceFees: number;
  totalRevenue: number;
  transactionCount: number;
  organizationBreakdown: { [orgId: string]: { name: string; revenue: number; transactions: number } };
}

interface JournalEntry {
  id: number;
  entryNumber: string;
  transactionId: string | null;
  entryDate: string;
  description: string;
  totalAmount: string;
  status: string;
  createdBy: string;
  lines: Array<{
    id: number;
    accountCode: string;
    accountName: string;
    debitAmount: string;
    creditAmount: string;
    description: string;
  }>;
}

interface ChartOfAccounts {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountId: number | null;
  isActive: boolean;
  description: string;
}

export default function AccountingDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });

  const [feeConfig, setFeeConfig] = useState({
    transactionFeeType: 'percentage',
    transactionFeeValue: '1.0',
    settlementFeeType: 'tiered',
    settlementFeeValue: '150',
    monthlyServiceFeeType: 'fixed',
    monthlyServiceFeeValue: '1500',
    frequency: 'per_transaction',
    // Tiered charging configuration
    tieredCharging: {
      enabled: true,
      tier1: {
        threshold: 500000,
        percentageFee: 0.99,
        fixedFee: 50,
        description: 'Settlements < K500,000: 0.99% + K50'
      },
      tier2: {
        threshold: 500000,
        percentageFee: 1.0,
        fixedFee: 0,
        description: 'Settlements ≥ K500,000: 1.0% flat'
      }
    }
  });

  const [calculatorAmount, setCalculatorAmount] = useState('');

  // Financial Statements Query
  const { data: financialStatements, isLoading: isLoadingStatements } = useQuery<FinancialStatement>({
    queryKey: ['/api/accounting/financial-statements', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.set('endDate', dateRange.to.toISOString());
      const response = await fetch(`/api/accounting/financial-statements?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch financial statements: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    retry: false
  });

  // Revenue Report Query
  const { data: revenueReport, isLoading: isLoadingRevenue } = useQuery<RevenueReport>({
    queryKey: ['/api/accounting/revenue-report', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.set('endDate', dateRange.to.toISOString());
      const response = await fetch(`/api/accounting/revenue-report?${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch revenue report: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    retry: false
  });

  // Journal Entries Query
  const { data: journalEntries, isLoading: isLoadingJournal } = useQuery<JournalEntry[]>({
    queryKey: ['/api/accounting/journal-entries'],
    queryFn: async () => {
      const response = await fetch('/api/accounting/journal-entries?limit=20', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch journal entries');
      return response.json();
    },
    retry: false
  });

  // Chart of Accounts Query
  const { data: chartOfAccounts, isLoading: isLoadingChart } = useQuery<ChartOfAccounts[]>({
    queryKey: ['/api/accounting/chart-of-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/accounting/chart-of-accounts', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch chart of accounts');
      return response.json();
    },
    retry: false
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatLargeCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${formatCurrency(amount / 1000000)}M`;
    } else if (amount >= 1000) {
      return `${formatCurrency(amount / 1000)}K`;
    }
    return formatCurrency(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Smile Money Financial Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Revenue tracking and financial statements with double-entry bookkeeping
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from) setDateRange({ from: range.from, to: range.to || range.from });
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingRevenue ? "Loading..." : formatLargeCurrency(revenueReport?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {revenueReport?.transactionCount || 0} transactions processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaction Fees</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingRevenue ? "Loading..." : formatCurrency(revenueReport?.transactionFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              1.0% of transaction amounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Settlement Fees</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingRevenue ? "Loading..." : formatCurrency(revenueReport?.settlementFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              ZMW 150 per settlement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStatements ? "Loading..." : formatCurrency(financialStatements?.netIncome || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Financial Information */}
      <Tabs defaultValue="statements" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="statements">Financial Statements</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="fees">Fee Management</TabsTrigger>
          <TabsTrigger value="reports">Reports & Export</TabsTrigger>
        </TabsList>

        {/* Financial Statements Tab */}
        <TabsContent value="statements" className="space-y-4">
          {isLoadingStatements ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Balance Sheet */}
              <Card>
                <CardHeader>
                  <CardTitle>Balance Sheet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Assets */}
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Assets</h4>
                    <div className="space-y-1">
                      {Object.entries(financialStatements?.assets || {}).map(([code, account]) => (
                        <div key={code} className="flex justify-between text-sm">
                          <span>{account.name}</span>
                          <span>{formatCurrency(account.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-sm pt-2 border-t">
                        <span>Total Assets</span>
                        <span>{formatCurrency(financialStatements?.totalAssets || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div>
                    <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">Liabilities</h4>
                    <div className="space-y-1">
                      {Object.entries(financialStatements?.liabilities || {}).map(([code, account]) => (
                        <div key={code} className="flex justify-between text-sm">
                          <span>{account.name}</span>
                          <span>{formatCurrency(account.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-sm pt-2 border-t">
                        <span>Total Liabilities</span>
                        <span>{formatCurrency(financialStatements?.totalLiabilities || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Equity */}
                  <div>
                    <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Equity</h4>
                    <div className="space-y-1">
                      {Object.entries(financialStatements?.equity || {}).map(([code, account]) => (
                        <div key={code} className="flex justify-between text-sm">
                          <span>{account.name}</span>
                          <span>{formatCurrency(account.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-sm pt-2 border-t">
                        <span>Total Equity</span>
                        <span>{formatCurrency(financialStatements?.totalEquity || 0)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Income Statement */}
              <Card>
                <CardHeader>
                  <CardTitle>Income Statement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Revenue */}
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Revenue</h4>
                    <div className="space-y-1">
                      {Object.entries(financialStatements?.revenue || {}).map(([code, account]) => (
                        <div key={code} className="flex justify-between text-sm">
                          <span>{account.name}</span>
                          <span>{formatCurrency(account.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-sm pt-2 border-t">
                        <span>Total Revenue</span>
                        <span>{formatCurrency(financialStatements?.totalRevenue || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div>
                    <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">Expenses</h4>
                    <div className="space-y-1">
                      {Object.entries(financialStatements?.expenses || {}).map(([code, account]) => (
                        <div key={code} className="flex justify-between text-sm">
                          <span>{account.name}</span>
                          <span>{formatCurrency(account.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-sm pt-2 border-t">
                        <span>Total Expenses</span>
                        <span>{formatCurrency(financialStatements?.totalExpenses || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Income */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="flex justify-between font-bold">
                      <span>Net Income</span>
                      <span className={financialStatements?.netIncome && financialStatements.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(financialStatements?.netIncome || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Revenue Breakdown Tab */}
        <TabsContent value="revenue" className="space-y-4">
          {isLoadingRevenue ? (
            <Card>
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Transaction Fees (1.0%)</span>
                      <span className="font-medium">{formatCurrency(revenueReport?.transactionFees || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Settlement Fees (ZMW 150 each)</span>
                      <span className="font-medium">{formatCurrency(revenueReport?.settlementFees || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Service Fees</span>
                      <span className="font-medium">{formatCurrency(revenueReport?.monthlyServiceFees || 0)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-bold">
                      <span>Total Revenue</span>
                      <span className="text-green-600">{formatCurrency(revenueReport?.totalRevenue || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Organization Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(revenueReport?.organizationBreakdown || {}).map(([orgId, data]) => (
                      <div key={orgId} className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">{data.name}</p>
                          <p className="text-xs text-gray-500">{data.transactions} transactions</p>
                        </div>
                        <span className="font-medium">{formatCurrency(data.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Journal Entries Tab */}
        <TabsContent value="journal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Journal Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingJournal ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {journalEntries?.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{entry.entryNumber}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{entry.description}</p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(entry.entryDate), "MMM dd, yyyy")} • {formatCurrency(parseFloat(entry.totalAmount))}
                          </p>
                        </div>
                        <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'}>
                          {entry.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        {entry.lines.map((line) => (
                          <div key={line.id} className="grid grid-cols-3 gap-4 text-sm">
                            <span>{line.accountCode} - {line.accountName}</span>
                            <span className="text-right">
                              {parseFloat(line.debitAmount) > 0 ? formatCurrency(parseFloat(line.debitAmount)) : '-'}
                            </span>
                            <span className="text-right">
                              {parseFloat(line.creditAmount) > 0 ? formatCurrency(parseFloat(line.creditAmount)) : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart of Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChart ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {['asset', 'liability', 'equity', 'revenue', 'expense'].map((accountType) => {
                    const accounts = chartOfAccounts?.filter(acc => acc.accountType === accountType) || [];
                    if (accounts.length === 0) return null;
                    
                    return (
                      <div key={accountType} className="space-y-2">
                        <h4 className="font-semibold text-lg capitalize border-b pb-1">
                          {accountType}s
                        </h4>
                        {accounts.map((account) => (
                          <div key={account.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <div>
                              <span className="font-medium">{account.accountCode}</span>
                              <span className="ml-2">{account.accountName}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {account.accountType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fee Management Tab */}
        <TabsContent value="fees" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Fee Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Transaction Fee */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Transaction Fee</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={feeConfig.transactionFeeType} onValueChange={(value) => setFeeConfig(prev => ({ ...prev, transactionFeeType: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (ZMW)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      value={feeConfig.transactionFeeValue}
                      onChange={(e) => setFeeConfig(prev => ({ ...prev, transactionFeeValue: e.target.value }))}
                      placeholder={feeConfig.transactionFeeType === 'percentage' ? '1.0' : '50'}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Current: {feeConfig.transactionFeeType === 'percentage' ? `${feeConfig.transactionFeeValue}%` : `ZMW ${feeConfig.transactionFeeValue}`} per transaction
                  </p>
                </div>

                {/* Settlement Fee */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Settlement Fee Structure</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={feeConfig.settlementFeeType} onValueChange={(value) => setFeeConfig(prev => ({ ...prev, settlementFeeType: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount (ZMW)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="tiered">Tiered Charging</SelectItem>
                      </SelectContent>
                    </Select>
                    {feeConfig.settlementFeeType !== 'tiered' && (
                      <Input
                        type="number"
                        step="0.01"
                        value={feeConfig.settlementFeeValue}
                        onChange={(e) => setFeeConfig(prev => ({ ...prev, settlementFeeValue: e.target.value }))}
                        placeholder={feeConfig.settlementFeeType === 'fixed' ? '150' : '2.0'}
                      />
                    )}
                  </div>
                  
                  {feeConfig.settlementFeeType === 'tiered' && (
                    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Tiered Charging Configuration</h4>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                          <span>Amount Range</span>
                          <span>Percentage</span>
                          <span>Fixed Fee</span>
                        </div>
                        
                        {/* Tier 1 */}
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            type="number"
                            value={feeConfig.tieredCharging.tier1.threshold}
                            onChange={(e) => setFeeConfig(prev => ({
                              ...prev,
                              tieredCharging: {
                                ...prev.tieredCharging,
                                tier1: { ...prev.tieredCharging.tier1, threshold: parseInt(e.target.value) }
                              }
                            }))}
                            placeholder="500000"
                            className="text-xs"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={feeConfig.tieredCharging.tier1.percentageFee}
                            onChange={(e) => setFeeConfig(prev => ({
                              ...prev,
                              tieredCharging: {
                                ...prev.tieredCharging,
                                tier1: { ...prev.tieredCharging.tier1, percentageFee: parseFloat(e.target.value) }
                              }
                            }))}
                            placeholder="0.99"
                            className="text-xs"
                          />
                          <Input
                            type="number"
                            value={feeConfig.tieredCharging.tier1.fixedFee}
                            onChange={(e) => setFeeConfig(prev => ({
                              ...prev,
                              tieredCharging: {
                                ...prev.tieredCharging,
                                tier1: { ...prev.tieredCharging.tier1, fixedFee: parseInt(e.target.value) }
                              }
                            }))}
                            placeholder="50"
                            className="text-xs"
                          />
                        </div>
                        
                        {/* Tier 2 */}
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center">≥ K{feeConfig.tieredCharging.tier1.threshold.toLocaleString()}</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={feeConfig.tieredCharging.tier2.percentageFee}
                            onChange={(e) => setFeeConfig(prev => ({
                              ...prev,
                              tieredCharging: {
                                ...prev.tieredCharging,
                                tier2: { ...prev.tieredCharging.tier2, percentageFee: parseFloat(e.target.value) }
                              }
                            }))}
                            placeholder="1.0"
                            className="text-xs"
                          />
                          <Input
                            type="number"
                            value={feeConfig.tieredCharging.tier2.fixedFee}
                            onChange={(e) => setFeeConfig(prev => ({
                              ...prev,
                              tieredCharging: {
                                ...prev.tieredCharging,
                                tier2: { ...prev.tieredCharging.tier2, fixedFee: parseInt(e.target.value) }
                              }
                            }))}
                            placeholder="0"
                            className="text-xs"
                          />
                        </div>
                      </div>
                      
                      <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        <div>• Tier 1: Less than K{feeConfig.tieredCharging.tier1.threshold.toLocaleString()} → {feeConfig.tieredCharging.tier1.percentageFee}% + K{feeConfig.tieredCharging.tier1.fixedFee}</div>
                        <div>• Tier 2: K{feeConfig.tieredCharging.tier1.threshold.toLocaleString()} and above → {feeConfig.tieredCharging.tier2.percentageFee}% flat</div>
                      </div>
                    </div>
                  )}
                  
                  {feeConfig.settlementFeeType !== 'tiered' && (
                    <p className="text-xs text-gray-500">
                      Current: {feeConfig.settlementFeeType === 'fixed' ? `ZMW ${feeConfig.settlementFeeValue}` : `${feeConfig.settlementFeeValue}%`} per settlement
                    </p>
                  )}
                </div>

                {/* Monthly Service Fee */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Monthly Service Fee</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={feeConfig.monthlyServiceFeeType} onValueChange={(value) => setFeeConfig(prev => ({ ...prev, monthlyServiceFeeType: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount (ZMW)</SelectItem>
                        <SelectItem value="percentage">Percentage of Volume (%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      value={feeConfig.monthlyServiceFeeValue}
                      onChange={(e) => setFeeConfig(prev => ({ ...prev, monthlyServiceFeeValue: e.target.value }))}
                      placeholder={feeConfig.monthlyServiceFeeType === 'fixed' ? '1500' : '0.5'}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Current: {feeConfig.monthlyServiceFeeType === 'fixed' ? `ZMW ${feeConfig.monthlyServiceFeeValue}` : `${feeConfig.monthlyServiceFeeValue}%`} per organization monthly
                  </p>
                </div>

                <Button className="w-full" onClick={() => {
                  toast({
                    title: "Fee Configuration Updated",
                    description: "New fee structure will apply to future transactions",
                  });
                }}>
                  <Settings className="h-4 w-4 mr-2" />
                  Update Fee Configuration
                </Button>
              </CardContent>
            </Card>

            {/* Fee Calculator */}
            <Card>
              <CardHeader>
                <CardTitle>Fee Calculator with Tiered Charging</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="amount">Settlement Amount (ZMW)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="1000000"
                    step="0.01"
                    value={calculatorAmount}
                    onChange={(e) => setCalculatorAmount(e.target.value)}
                  />
                </div>
                
                {calculatorAmount && (() => {
                  const amount = parseFloat(calculatorAmount);
                  let transactionFee = 0;
                  let settlementFee = 0;
                  
                  // Calculate transaction fee
                  if (feeConfig.transactionFeeType === 'percentage') {
                    transactionFee = amount * (parseFloat(feeConfig.transactionFeeValue) / 100);
                  } else {
                    transactionFee = parseFloat(feeConfig.transactionFeeValue);
                  }
                  
                  // Calculate settlement fee based on type
                  if (feeConfig.settlementFeeType === 'tiered') {
                    if (amount < feeConfig.tieredCharging.tier1.threshold) {
                      // Tier 1: Percentage + Fixed
                      settlementFee = (amount * feeConfig.tieredCharging.tier1.percentageFee / 100) + feeConfig.tieredCharging.tier1.fixedFee;
                    } else {
                      // Tier 2: Percentage only
                      settlementFee = amount * feeConfig.tieredCharging.tier2.percentageFee / 100;
                    }
                  } else if (feeConfig.settlementFeeType === 'percentage') {
                    settlementFee = amount * (parseFloat(feeConfig.settlementFeeValue) / 100);
                  } else {
                    settlementFee = parseFloat(feeConfig.settlementFeeValue);
                  }
                  
                  const totalFees = transactionFee + settlementFee;
                  const tier = amount < feeConfig.tieredCharging.tier1.threshold ? 1 : 2;
                  
                  return (
                    <>
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Transaction Fee:</span>
                          <span>ZMW {transactionFee.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Settlement Fee:</span>
                          <span>ZMW {settlementFee.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2 font-medium">
                          <span>Total Fees:</span>
                          <span>ZMW {totalFees.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {feeConfig.settlementFeeType === 'tiered' && (
                        <div className={`p-3 rounded-lg ${tier === 1 ? 'bg-blue-50 dark:bg-blue-950' : 'bg-green-50 dark:bg-green-950'}`}>
                          <h4 className={`font-medium text-sm ${tier === 1 ? 'text-blue-900 dark:text-blue-100' : 'text-green-900 dark:text-green-100'}`}>
                            Tier {tier} Applied
                          </h4>
                          <p className={`text-xs ${tier === 1 ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'}`}>
                            {tier === 1 
                              ? `Amount < K${feeConfig.tieredCharging.tier1.threshold.toLocaleString()}: ${feeConfig.tieredCharging.tier1.percentageFee}% + K${feeConfig.tieredCharging.tier1.fixedFee}` 
                              : `Amount ≥ K${feeConfig.tieredCharging.tier1.threshold.toLocaleString()}: ${feeConfig.tieredCharging.tier2.percentageFee}% flat`
                            }
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Fee Impact Analysis</h4>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div>• Effective fee rate: {((totalFees / amount) * 100).toFixed(3)}%</div>
                          <div>• Monthly revenue (100 similar transactions): ZMW {(totalFees * 100).toLocaleString('en-ZM', { minimumFractionDigits: 2 })}</div>
                          <div>• Annual revenue projection: ZMW {(totalFees * 1200).toLocaleString('en-ZM', { minimumFractionDigits: 2 })}</div>
                          <div>• Net amount to merchant: ZMW {(amount - totalFees).toLocaleString('en-ZM', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reports & Export Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generate Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => {
                    toast({
                      title: "Generating Financial Statements",
                      description: "PDF will be downloaded shortly",
                    });
                  }}>
                    <FileText className="h-6 w-6" />
                    <span className="text-xs">Financial Statements</span>
                  </Button>
                  
                  <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => {
                    toast({
                      title: "Generating Revenue Report",
                      description: "Excel file will be downloaded shortly",
                    });
                  }}>
                    <BarChart3 className="h-6 w-6" />
                    <span className="text-xs">Revenue Analysis</span>
                  </Button>
                  
                  <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => {
                    toast({
                      title: "Generating Journal Entries",
                      description: "CSV file will be downloaded shortly",
                    });
                  }}>
                    <Download className="h-6 w-6" />
                    <span className="text-xs">Journal Entries</span>
                  </Button>
                  
                  <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => {
                    toast({
                      title: "Generating Audit Trail",
                      description: "Comprehensive audit report being prepared",
                    });
                  }}>
                    <FileText className="h-6 w-6" />
                    <span className="text-xs">Audit Trail</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  <Label>Report Format</Label>
                  <Select defaultValue="pdf">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                      <SelectItem value="csv">CSV File</SelectItem>
                      <SelectItem value="json">JSON Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Sharing & Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Email Recipients</Label>
                  <Input placeholder="finance@smilemoney.co.zm, audit@smilemoney.co.zm" />
                </div>

                <div className="space-y-3">
                  <Label>Schedule</Label>
                  <Select defaultValue="manual">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Only</SelectItem>
                      <SelectItem value="daily">Daily at 9:00 AM</SelectItem>
                      <SelectItem value="weekly">Weekly on Monday</SelectItem>
                      <SelectItem value="monthly">Monthly on 1st</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" onClick={() => {
                    toast({
                      title: "Report Shared Successfully",
                      description: "Financial report sent to specified recipients",
                    });
                  }}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Current Report
                  </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Compliance Note</h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    All financial reports are automatically logged for Bank of Zambia regulatory compliance and internal audit purposes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}