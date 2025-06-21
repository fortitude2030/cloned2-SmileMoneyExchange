import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp, DollarSign, FileText, BarChart3 } from "lucide-react";
import { format } from "date-fns";

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
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });

  // Financial Statements Query
  const { data: financialStatements, isLoading: isLoadingStatements } = useQuery<FinancialStatement>({
    queryKey: ['/api/accounting/financial-statements', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.set('endDate', dateRange.to.toISOString());
      const response = await fetch(`/api/accounting/financial-statements?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch financial statements: ${response.status} ${errorText}`);
      }
      return response.json();
    }
  });

  // Revenue Report Query
  const { data: revenueReport, isLoading: isLoadingRevenue } = useQuery<RevenueReport>({
    queryKey: ['/api/accounting/revenue-report', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.set('endDate', dateRange.to.toISOString());
      const response = await fetch(`/api/accounting/revenue-report?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch revenue report: ${response.status} ${errorText}`);
      }
      return response.json();
    }
  });

  // Journal Entries Query
  const { data: journalEntries, isLoading: isLoadingJournal } = useQuery<JournalEntry[]>({
    queryKey: ['/api/accounting/journal-entries'],
    queryFn: async () => {
      const response = await fetch('/api/accounting/journal-entries?limit=20');
      if (!response.ok) throw new Error('Failed to fetch journal entries');
      return response.json();
    }
  });

  // Chart of Accounts Query
  const { data: chartOfAccounts, isLoading: isLoadingChart } = useQuery<ChartOfAccounts[]>({
    queryKey: ['/api/accounting/chart-of-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/accounting/chart-of-accounts');
      if (!response.ok) throw new Error('Failed to fetch chart of accounts');
      return response.json();
    }
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="statements">Financial Statements</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
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
      </Tabs>
    </div>
  );
}