import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CreditCard, 
  ArrowUpDown, 
  Shield, 
  Network, 
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign
} from "lucide-react";

interface BankAccount {
  id: number;
  accountNumber: string;
  accountType: string;
  currency: string;
  balance: string;
  availableBalance: string;
  status: string;
  kycLevel: string;
}

interface BankTransaction {
  id: number;
  transactionRef: string;
  amount: string;
  currency: string;
  transactionType: string;
  channel: string;
  status: string;
  description: string;
  createdAt: string;
}

interface ComplianceCheck {
  id: number;
  checkType: string;
  status: string;
  riskScore: number;
  alerts: string[];
  createdAt: string;
}

export default function CoreBankingDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [transactionForm, setTransactionForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    transactionType: "transfer",
    description: "",
    beneficiaryName: "",
    beneficiaryCountry: ""
  });

  // Fetch bank accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/banking/accounts"],
  });

  // Fetch transactions for selected account
  const { data: transactions, isLoading: transactionsLoading } = useQuery<BankTransaction[]>({
    queryKey: ["/api/banking/transactions", selectedAccount],
    enabled: !!selectedAccount,
  });

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (accountData: any) => {
      return await apiRequest("/api/banking/accounts", "POST", accountData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
      toast({
        title: "Success",
        description: "Bank account created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  // Process transaction mutation
  const processTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      return await apiRequest("/api/banking/transactions", "POST", transactionData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banking/transactions"] });
      
      if (data.requiresManualReview) {
        toast({
          title: "Transaction Pending Review",
          description: "Transaction requires manual compliance review",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Transaction processed successfully",
        });
      }
      
      setTransactionForm({
        fromAccountId: "",
        toAccountId: "",
        amount: "",
        transactionType: "transfer",
        description: "",
        beneficiaryName: "",
        beneficiaryCountry: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to process transaction",
        variant: "destructive",
      });
    },
  });

  const handleCreateAccount = () => {
    createAccountMutation.mutate({
      accountType: "mobile_wallet",
      currency: "ZMW",
      kycLevel: "basic"
    });
  };

  const handleProcessTransaction = () => {
    if (!transactionForm.fromAccountId || !transactionForm.toAccountId || !transactionForm.amount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    processTransactionMutation.mutate(transactionForm);
  };

  const formatCurrency = (amount: string, currency: string = "ZMW") => {
    return `${currency} ${parseFloat(amount || "0").toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      completed: "bg-green-500",
      pending: "bg-yellow-500",
      failed: "bg-red-500",
      active: "bg-green-500",
      suspended: "bg-red-500"
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-500"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Core Banking System
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            EMI Banking Operations Dashboard - NFS & RTGS Integration
          </p>
        </div>

        <Tabs defaultValue="accounts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="payments">Payment Rails</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{accounts?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Active bank accounts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      accounts?.reduce((sum: number, acc: BankAccount) => 
                        sum + parseFloat(acc.balance || "0"), 0
                      ).toString() || "0"
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Combined account balances</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Create Account</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleCreateAccount}
                    disabled={createAccountMutation.isPending}
                    className="w-full"
                  >
                    {createAccountMutation.isPending ? "Creating..." : "New Account"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bank Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <div className="text-center py-4">Loading accounts...</div>
                ) : (
                  <div className="space-y-4">
                    {accounts?.map((account: BankAccount) => (
                      <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <CreditCard className="h-8 w-8 text-blue-500" />
                          <div>
                            <div className="font-medium">{account.accountNumber}</div>
                            <div className="text-sm text-gray-500">
                              {account.accountType} • {account.currency} • KYC: {account.kycLevel}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(account.balance, account.currency)}</div>
                          <div className="text-sm">{getStatusBadge(account.status)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Process Transaction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromAccount">From Account</Label>
                    <Select value={transactionForm.fromAccountId} onValueChange={(value) => 
                      setTransactionForm({...transactionForm, fromAccountId: value})
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account: BankAccount) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.accountNumber} ({formatCurrency(account.balance, account.currency)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="toAccount">To Account</Label>
                    <Select value={transactionForm.toAccountId} onValueChange={(value) => 
                      setTransactionForm({...transactionForm, toAccountId: value})
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account: BankAccount) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.accountNumber} ({formatCurrency(account.balance, account.currency)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (ZMW)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={transactionForm.amount}
                      onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="transactionType">Transaction Type</Label>
                    <Select value={transactionForm.transactionType} onValueChange={(value) => 
                      setTransactionForm({...transactionForm, transactionType: value})
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Transaction description"
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                  />
                </div>

                <Button 
                  onClick={handleProcessTransaction}
                  disabled={processTransactionMutation.isPending}
                  className="w-full"
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {processTransactionMutation.isPending ? "Processing..." : "Process Transaction"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label htmlFor="accountSelect">Select Account</Label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account to view transactions" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((account: BankAccount) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.accountNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {transactionsLoading ? (
                  <div className="text-center py-4">Loading transactions...</div>
                ) : transactions?.length > 0 ? (
                  <div className="space-y-2">
                    {transactions.map((transaction: BankTransaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          <ArrowUpDown className="h-4 w-4 text-gray-500" />
                          <div>
                            <div className="font-medium">{transaction.transactionRef}</div>
                            <div className="text-sm text-gray-500">
                              {transaction.transactionType} • {transaction.channel}
                            </div>
                            <div className="text-xs text-gray-400">{transaction.description}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(transaction.amount, transaction.currency)}</div>
                          <div className="text-sm">{getStatusBadge(transaction.status)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {selectedAccount ? "No transactions found" : "Select an account to view transactions"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">NFS Integration</CardTitle>
                  <Network className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">ATM Network:</span>
                      <Badge className="bg-green-500">Connected</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">POS Terminals:</span>
                      <Badge className="bg-green-500">Active</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Mobile Money:</span>
                      <Badge className="bg-green-500">Operational</Badge>
                    </div>
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    View NFS Transactions
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">RTGS Integration</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">BoZ-RTGS:</span>
                      <Badge className="bg-green-500">Connected</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Business Hours:</span>
                      <Badge className="bg-yellow-500">8AM-5PM</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Min Amount:</span>
                      <span className="text-sm">ZMW 10,000</span>
                    </div>
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    Submit RTGS Payment
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payment Rails Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <Network className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <h3 className="font-medium">National Financial Switch</h3>
                    <p className="text-sm text-gray-500 mt-1">ATM/POS Network</p>
                    <Badge className="bg-green-500 mt-2">Operational</Badge>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <h3 className="font-medium">RTGS System</h3>
                    <p className="text-sm text-gray-500 mt-1">High-Value Payments</p>
                    <Badge className="bg-green-500 mt-2">Connected</Badge>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <ArrowUpDown className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                    <h3 className="font-medium">Mobile Money</h3>
                    <p className="text-sm text-gray-500 mt-1">Interoperability</p>
                    <Badge className="bg-yellow-500 mt-2">Testing</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AML Screening</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">Passed</div>
                  <p className="text-xs text-muted-foreground">All transactions screened</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Manual Reviews</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">2</div>
                  <p className="text-xs text-muted-foreground">Pending compliance review</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">BoZ Reports</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">Current</div>
                  <p className="text-xs text-muted-foreground">All reports submitted</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="font-medium">Transaction Monitoring</div>
                        <div className="text-sm text-gray-500">Real-time AML/CFT screening</div>
                      </div>
                    </div>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <div>
                        <div className="font-medium">Sanctions Screening</div>
                        <div className="text-sm text-gray-500">OFAC, UN, EU lists monitoring</div>
                      </div>
                    </div>
                    <Badge className="bg-yellow-500">Monitoring</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="font-medium">Regulatory Reporting</div>
                        <div className="text-sm text-gray-500">Automated BoZ and FIC submissions</div>
                      </div>
                    </div>
                    <Badge className="bg-green-500">Current</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="font-medium">KYC Verification</div>
                        <div className="text-sm text-gray-500">Customer due diligence processes</div>
                      </div>
                    </div>
                    <Badge className="bg-blue-500">Operational</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}