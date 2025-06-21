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

export default function FinancePortal() {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });

  // Financial Statements Query
  const { data: financialStatements, isLoading: isLoadingStatements } = useQuery<FinancialStatement>({
    queryKey: ['/api/accounting/financial-statements', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString()
      });
      const response = await fetch(`/api/accounting/financial-statements?${params}`);
      if (!response.ok) throw new Error('Failed to fetch financial statements');
      return response.json();
    }
  });

  // Revenue Report Query
  const { data: revenueReport, isLoading: isLoadingRevenue } = useQuery<RevenueReport>({
    queryKey: ['/api/accounting/revenue-report', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString()
      });
      const response = await fetch(`/api/accounting/revenue-report?${params}`);
      if (!response.ok) throw new Error('Failed to fetch revenue report');
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
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Smile Money Finance Portal
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Complete accounting system with double-entry bookkeeping and revenue tracking
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
              {isLoadingRevenue ? "Loading..." : formatLargeCurrency(revenueReport?.transactionFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              1.0% transaction fee revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Settlement Fees</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingRevenue ? "Loading..." : formatLargeCurrency(revenueReport?.settlementFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              ZMW 150 per settlement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStatements ? "Loading..." : formatLargeCurrency(financialStatements?.netIncome || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="statements" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="statements">Financial Statements</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
        </TabsList>

        {/* Financial Statements Tab */}
        <TabsContent value="statements" className="space-y-6">
          {isLoadingStatements ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">Loading financial statements...</div>
              </CardContent>
            </Card>
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
        <TabsContent value="revenue" className="space-y-6">
          {isLoadingRevenue ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">Loading revenue data...</div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Transaction Fees (1.0%)</span>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(revenueReport?.transactionFees || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {((revenueReport?.transactionFees || 0) / (revenueReport?.totalRevenue || 1) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Settlement Fees (ZMW 150)</span>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(revenueReport?.settlementFees || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {((revenueReport?.settlementFees || 0) / (revenueReport?.totalRevenue || 1) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Monthly Service Fees</span>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(revenueReport?.monthlyServiceFees || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {((revenueReport?.monthlyServiceFees || 0) / (revenueReport?.totalRevenue || 1) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between font-bold">
                      <span>Total Revenue</span>
                      <span>{formatCurrency(revenueReport?.totalRevenue || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue by Organization */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Customer Organization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(revenueReport?.organizationBreakdown || {}).map(([orgId, org]) => (
                      <div key={orgId} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-gray-500">{org.transactions} transactions</div>
                        </div>
                        <div className="font-semibold">{formatCurrency(org.revenue)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Journal Entries Tab */}
        <TabsContent value="journal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Journal Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingJournal ? (
                <div className="text-center py-6">Loading journal entries...</div>
              ) : (
                <div className="space-y-4">
                  {journalEntries?.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold">{entry.entryNumber}</div>
                          <div className="text-sm text-gray-600">{entry.description}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(entry.entryDate), "MMM dd, yyyy")} • {entry.createdBy}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(parseFloat(entry.totalAmount))}</div>
                          <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'}>
                            {entry.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h5 className="font-medium text-green-600 mb-1">Debits</h5>
                          {entry.lines.filter(line => parseFloat(line.debitAmount) > 0).map((line) => (
                            <div key={line.id} className="flex justify-between">
                              <span>{line.accountName}</span>
                              <span>{formatCurrency(parseFloat(line.debitAmount))}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <h5 className="font-medium text-red-600 mb-1">Credits</h5>
                          {entry.lines.filter(line => parseFloat(line.creditAmount) > 0).map((line) => (
                            <div key={line.id} className="flex justify-between">
                              <span>{line.accountName}</span>
                              <span>{formatCurrency(parseFloat(line.creditAmount))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart of Accounts Tab */}
        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingChart ? (
                <div className="text-center py-6">Loading chart of accounts...</div>
              ) : (
                <div className="space-y-6">
                  {/* Group accounts by type */}
                  {['asset', 'liability', 'equity', 'revenue', 'expense'].map((accountType) => {
                    const accountsOfType = chartOfAccounts?.filter(account => account.accountType === accountType) || [];
                    if (accountsOfType.length === 0) return null;

                    return (
                      <div key={accountType}>
                        <h4 className="font-semibold text-lg mb-3 capitalize">
                          {accountType === 'asset' ? 'Assets' :
                           accountType === 'liability' ? 'Liabilities' :
                           accountType === 'equity' ? 'Equity' :
                           accountType === 'revenue' ? 'Revenue' : 'Expenses'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {accountsOfType.map((account) => (
                            <div key={account.id} className="border rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{account.accountCode} - {account.accountName}</div>
                                  {account.description && (
                                    <div className="text-sm text-gray-600 mt-1">{account.description}</div>
                                  )}
                                </div>
                                <Badge variant={account.isActive ? 'default' : 'secondary'}>
                                  {account.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
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