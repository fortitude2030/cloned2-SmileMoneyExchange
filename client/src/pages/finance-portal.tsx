import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const settlementSchema = z.object({
  amount: z.string().min(1, "Amount is required").transform((val) => Math.floor(parseFloat(val)).toString()),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  priority: z.string().default("medium"),
});

export default function FinancePortal() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch organization data
  const { data: organizations = [] } = useQuery({
    queryKey: ["/api/organizations"],
    retry: false,
  });

  // Fetch merchant wallets
  const { data: merchantWallets = [], isLoading: merchantWalletsLoading } = useQuery({
    queryKey: ["/api/merchant-wallets"],
    retry: false,
  });

  // Fetch wallet
  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    retry: false,
  });

  // Fetch settlement requests with auto-refresh
  const { data: settlementRequests = [], isLoading: settlementsLoading } = useQuery({
    queryKey: ["/api/settlement-requests"],
    retry: false,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchIntervalInBackground: false, // Only refresh when tab is active
  });

  // Fetch settlement breakdown with auto-refresh
  const { data: settlementBreakdown } = useQuery({
    queryKey: ["/api/settlement-breakdown"],
    retry: false,
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    refetchIntervalInBackground: false,
  });

  // Fetch branches
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["/api/branches"],
    retry: false,
  });

  // State for management tab
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);

  // Settlement form
  const settlementForm = useForm({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      amount: "",
      bankName: "",
      accountNumber: "",
      priority: "medium",
    },
  });

  // Branch form schema
  const branchSchema = z.object({
    name: z.string().min(1, "Branch name is required"),
    location: z.string().min(1, "Location is required"),
    address: z.string().optional(),
    contactPhone: z.string().optional(),
    managerName: z.string().optional(),
  });

  // Branch form
  const branchForm = useForm({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      location: "",
      address: "",
      contactPhone: "",
      managerName: "",
    },
  });

  // Create settlement request mutation
  const createSettlementRequest = useMutation({
    mutationFn: async (data: z.infer<typeof settlementSchema>) => {
      return await apiRequest("POST", "/api/settlement-requests", {
        ...data,
        amount: Math.floor(parseFloat(data.amount)).toString(),
        priority: data.priority || "medium",
      });
    },
    onSuccess: (data: any) => {
      const amount = Math.floor(parseFloat(settlementForm.getValues('amount'))).toLocaleString();
      toast({
        title: "Settlement Request Created",
        description: `Settlement request for ZMW ${amount} submitted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-breakdown"] });
      setShowSettlementDialog(false);
      settlementForm.reset();
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      // Handle specific error responses from server
      const errorMessage = error?.response?.data?.message || error.message || "Failed to create settlement request";
      toast({
        title: "Settlement Request Failed",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Settlement creation error:", error);
    },
  });

  // Create branch mutation
  const createBranch = useMutation({
    mutationFn: async (data: z.infer<typeof branchSchema>) => {
      await apiRequest("POST", "/api/branches", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branch created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setShowCreateBranchModal(false);
      branchForm.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to create branch";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Create test settlement requests mutation
  const createTestSettlementRequests = useMutation({
    mutationFn: async () => {
      const testRequests = [
        {
          amount: "50000",
          bankName: "Standard Bank",
          accountNumber: "123456789",
          priority: "high" as const,
        },
        {
          amount: "75000",
          bankName: "Zanaco",
          accountNumber: "987654321",
          priority: "medium" as const,
        },
        {
          amount: "25000",
          bankName: "FNB Bank",
          accountNumber: "456789123",
          priority: "low" as const,
        },
      ];

      for (const request of testRequests) {
        await apiRequest("POST", "/api/settlement-requests", request);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test settlement requests created",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create test data",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 'ZMW 0';
    // Use Math.floor to truncate decimals without rounding
    const truncatedAmount = Math.floor(numericAmount);
    return `ZMW ${truncatedAmount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600 text-white font-medium">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-orange-600 text-white font-medium">Pending Approval</Badge>;
      case 'approved':
        return <Badge className="bg-blue-600 text-white font-medium">Approved</Badge>;
      case 'hold':
        return <Badge className="bg-yellow-600 text-white font-medium">On Hold</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600 text-white font-medium">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white font-medium">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 font-medium border border-red-300">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 font-medium border border-yellow-300">Medium Priority</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 font-medium border border-gray-300">Low Priority</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 font-medium border">{priority}</Badge>;
    }
  };

  const calculateTotalMerchantCollections = () => {
    return (merchantWallets as any[]).reduce((total: number, merchantWallet: any) => 
      total + Math.floor(parseFloat(merchantWallet.dailyCollected || "0")), 0);
  };

  const getCollectionProgress = (collected: string, limit: string = "1000000") => {
    const collectedAmount = parseFloat(collected || "0");
    const limitAmount = parseFloat(limit);
    const percentage = Math.min((collectedAmount / limitAmount) * 100, 100);
    return { percentage, remaining: Math.max(limitAmount - collectedAmount, 0) };
  };

  const validateSettlementAmount = (amount: string) => {
    const requestedAmount = Math.floor(parseFloat(amount || "0"));
    const masterBalance = Math.floor(parseFloat((wallet as any)?.balance || "0"));
    const pendingTotal = (settlementBreakdown as any)?.pendingTotal || 0;
    const trueAvailable = masterBalance - pendingTotal;
    
    return {
      isValid: requestedAmount <= trueAvailable,
      masterBalance,
      pendingTotal,
      trueAvailable,
      requestedAmount
    };
  };

  const calculateTrueAvailable = () => {
    const masterBalance = Math.floor(parseFloat((wallet as any)?.balance || "0"));
    const pendingTotal = (settlementBreakdown as any)?.pendingTotal || 0;
    return masterBalance - pendingTotal;
  };

  const getStatusBreakdown = () => {
    if (!(settlementBreakdown as any)?.breakdown) return [];
    return (settlementBreakdown as any).breakdown.map((item: any) => ({
      ...item,
      priority: item.status === 'pending' ? 'medium' : 'low' // Default priority for display
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <i className="fas fa-building text-white text-2xl"></i>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileHeader
        title="Finance Portal"
        subtitle={(organizations as any[])[0]?.name || "Organization"}
        icon="fas fa-building"
        color="secondary"
      />

      <div className="p-4">
        {/* Tab Navigation */}
        <div className="flex mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "dashboard"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <i className="fas fa-chart-line mr-2"></i>
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("management")}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "management"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <i className="fas fa-cog mr-2"></i>
            Management
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            {/* Daily Activity Overview */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          {/* Today's Activity Card */}
          <Card className="shadow-sm border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-blue-700 dark:text-blue-300 text-sm font-medium mb-1">TODAY'S COLLECTIONS</p>
                <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-200 mb-1">
                  {formatCurrency(calculateTotalMerchantCollections())}
                </h2>
                <p className="text-blue-600 dark:text-blue-400 text-xs">
                  Collected across {(merchantWallets as any[]).filter(m => parseFloat(m.dailyCollected || '0') > 0).length} active merchants
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reserved Balance Breakdown */}
        <Card className="shadow-sm border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950 mb-6">
          <CardContent className="p-4">
            <div className="text-center mb-3">
              <p className="text-green-700 dark:text-green-300 text-sm font-medium">SETTLEMENT CAPACITY</p>
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200">
                {formatCurrency(calculateTrueAvailable())}
              </h2>
              <p className="text-green-600 dark:text-green-400 text-xs">True Available Balance</p>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <p className="text-green-600 dark:text-green-400">Master Balance</p>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  {formatCurrency((wallet as any)?.balance || "0")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-orange-600 dark:text-orange-400">Pending Holds</p>
                <p className="font-semibold text-orange-800 dark:text-orange-200">
                  -{formatCurrency((settlementBreakdown as any)?.pendingTotal || 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-green-600 dark:text-green-400">Available</p>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  {formatCurrency(calculateTrueAvailable())}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settlement Status Pipeline */}
        <Card className="shadow-sm border border-blue-200 dark:border-blue-700 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Settlement Pipeline</h3>
            
            {getStatusBreakdown().length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400 text-sm">No settlement requests found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {getStatusBreakdown().map((statusItem: any) => (
                  <div key={statusItem.status} className={`p-3 rounded-lg border ${
                    statusItem.status === 'pending' ? 'border-orange-300 bg-orange-50 dark:bg-orange-950' :
                    statusItem.status === 'approved' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950' :
                    statusItem.status === 'completed' ? 'border-green-300 bg-green-50 dark:bg-green-950' :
                    statusItem.status === 'rejected' ? 'border-red-300 bg-red-50 dark:bg-red-950' :
                    'border-gray-300 bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <div className="text-center">
                      <p className={`text-sm font-medium ${
                        statusItem.status === 'pending' ? 'text-orange-700 dark:text-orange-300' :
                        statusItem.status === 'approved' ? 'text-blue-700 dark:text-blue-300' :
                        statusItem.status === 'completed' ? 'text-green-700 dark:text-green-300' :
                        statusItem.status === 'rejected' ? 'text-red-700 dark:text-red-300' :
                        'text-gray-700 dark:text-gray-300'
                      }`}>
                        {statusItem.status.charAt(0).toUpperCase() + statusItem.status.slice(1)}
                      </p>
                      <p className={`text-lg font-bold ${
                        statusItem.status === 'pending' ? 'text-orange-800 dark:text-orange-200' :
                        statusItem.status === 'approved' ? 'text-blue-800 dark:text-blue-200' :
                        statusItem.status === 'completed' ? 'text-green-800 dark:text-green-200' :
                        statusItem.status === 'rejected' ? 'text-red-800 dark:text-red-200' :
                        'text-gray-800 dark:text-gray-200'
                      }`}>
                        {formatCurrency(statusItem.total)}
                      </p>
                      <p className={`text-xs ${
                        statusItem.status === 'pending' ? 'text-orange-600 dark:text-orange-400' :
                        statusItem.status === 'approved' ? 'text-blue-600 dark:text-blue-400' :
                        statusItem.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                        statusItem.status === 'rejected' ? 'text-red-600 dark:text-red-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {statusItem.count} request{statusItem.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Merchant Wallets */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Merchant Daily Collections</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tracking amounts reset at midnight, funds flow to master wallet
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {formatCurrency(calculateTotalMerchantCollections())}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Today's total
                </div>
              </div>
            </div>
            
            {merchantWalletsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg mr-3"></div>
                      <div>
                        <div className="w-24 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                        <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="w-20 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                      <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (merchantWallets as any[]).length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-users text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No merchants found</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Merchant wallets will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(merchantWallets as any[]).map((merchantWallet: any) => (
                  <div key={merchantWallet.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center mr-3">
                        <i className="fas fa-store text-primary"></i>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          {merchantWallet.user?.firstName || 'Merchant'} {merchantWallet.user?.lastName || ''}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {merchantWallet.user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                        {formatCurrency(merchantWallet.dailyCollected || "0")}
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <Badge className={merchantWallet.isActive ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                          {merchantWallet.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {parseFloat(merchantWallet.dailyCollected || '0') > 0 && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            Last: {new Date(merchantWallet.lastTransactionDate).toLocaleTimeString('en-GB', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settlement Requests */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Settlement Requests</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => createTestSettlementRequests.mutate()}
                  disabled={createTestSettlementRequests.isPending}
                  variant="outline"
                  className="text-xs px-3 py-1"
                >
                  {createTestSettlementRequests.isPending ? "Creating..." : "Add Test Data"}
                </Button>
                <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium">
                      <i className="fas fa-plus mr-2"></i>New Settlement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Settlement Request</DialogTitle>
                    <DialogDescription>
                      Request a settlement to transfer funds to your bank account
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={settlementForm.handleSubmit((data) => createSettlementRequest.mutate(data))} className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        {...settlementForm.register("amount")}
                        placeholder="Enter amount"
                        type="number"
                      />
                      {settlementForm.formState.errors.amount && (
                        <p className="text-sm text-destructive">{settlementForm.formState.errors.amount.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        {...settlementForm.register("bankName")}
                        placeholder="e.g., Standard Bank"
                      />
                      {settlementForm.formState.errors.bankName && (
                        <p className="text-sm text-destructive">{settlementForm.formState.errors.bankName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        {...settlementForm.register("accountNumber")}
                        placeholder="Enter account number"
                      />
                      {settlementForm.formState.errors.accountNumber && (
                        <p className="text-sm text-destructive">{settlementForm.formState.errors.accountNumber.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select onValueChange={(value) => settlementForm.setValue("priority", value)} defaultValue="medium">
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button type="submit" disabled={createSettlementRequest.isPending} className="w-full">
                      {createSettlementRequest.isPending ? "Creating..." : "Create Request"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </div>
            
            {settlementsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="w-32 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                        <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      </div>
                      <div className="text-right">
                        <div className="w-20 h-5 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                        <div className="w-16 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                    <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (settlementRequests as any[]).length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-university text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No settlement requests</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Create your first settlement request</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(settlementRequests as any[]).map((request: any) => (
                  <div key={request.id} className={`border-2 rounded-lg p-4 shadow-md ${
                    request.status === 'pending' ? 'border-orange-400 bg-orange-50 dark:bg-orange-950 dark:border-orange-600' :
                    request.status === 'approved' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 dark:border-blue-600' :
                    request.status === 'completed' ? 'border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-600' :
                    request.status === 'hold' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-600' :
                    request.status === 'rejected' ? 'border-red-400 bg-red-50 dark:bg-red-950 dark:border-red-600' :
                    'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Bank Settlement Request</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          To: {request.bankName} - ACC: ****{request.accountNumber.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
                          {formatCurrency(request.amount)}
                        </p>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">
                        Submitted: {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                      {getPriorityBadge(request.priority)}
                    </div>
                    
                    {/* Display hold/reject reasons */}
                    {(request.status === 'hold' || request.status === 'rejected') && (request.holdReason || request.rejectReason) && (
                      <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border-l-4 border-yellow-400">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {request.status === 'hold' ? 'Hold Reason:' : 'Rejection Reason:'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {request.status === 'hold' ? 
                            (request.holdReason === 'settlement_cover' ? 'Approved - In Queue' : 
                             request.holdReason?.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())) :
                            request.rejectReason?.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())
                          }
                        </p>
                        {request.reasonComment && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 italic">
                            "{request.reasonComment}"
                          </p>
                        )}
                        {request.reviewedBy && request.reviewedAt && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Reviewed by Admin on {new Date(request.reviewedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}

        {/* Management Tab */}
        {activeTab === "management" && (
          <>
            {/* Organization Management */}
            <Card className="shadow-sm border border-purple-200 dark:border-purple-700 mb-6">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Organization Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditOrgModal(true)}
                  >
                    <i className="fas fa-edit mr-2"></i>
                    Edit
                  </Button>
                </div>
                
                {(organizations as any[])[0] ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {(organizations as any[])[0]?.name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {(organizations as any[])[0]?.type || "N/A"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Description</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {(organizations as any[])[0]?.description || "No description"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No organization found</p>
                )}
              </CardContent>
            </Card>

            {/* Branch Management */}
            <Card className="shadow-sm border border-green-200 dark:border-green-700 mb-6">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Branch Management</h3>
                  <Button
                    onClick={() => setShowCreateBranchModal(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Add Branch
                  </Button>
                </div>

                {branchesLoading ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400">Loading branches...</p>
                  </div>
                ) : (branches as any[]).length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-building text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
                    <p className="text-gray-500 dark:text-gray-400 mb-2">No branches found</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Create your first branch to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(branches as any[]).map((branch: any) => (
                      <div key={branch.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-800 dark:text-gray-200">{branch.name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            branch.isActive 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {branch.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <i className="fas fa-map-marker-alt mr-2"></i>
                          {branch.location}
                        </p>
                        {branch.address && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mb-1">{branch.address}</p>
                        )}
                        {branch.managerName && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <i className="fas fa-user mr-2"></i>
                            Manager: {branch.managerName}
                          </p>
                        )}
                        {branch.contactPhone && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <i className="fas fa-phone mr-2"></i>
                            {branch.contactPhone}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Create Branch Modal */}
      <Dialog open={showCreateBranchModal} onOpenChange={setShowCreateBranchModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              Add a new branch location to your organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="branchName">Branch Name</Label>
              <Input 
                id="branchName"
                placeholder="Enter branch name"
                value={branchForm.watch("name")}
                onChange={(e) => branchForm.setValue("name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="branchLocation">Location</Label>
              <Input 
                id="branchLocation"
                placeholder="City, District"
                value={branchForm.watch("location")}
                onChange={(e) => branchForm.setValue("location", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="branchAddress">Address (Optional)</Label>
              <Input 
                id="branchAddress"
                placeholder="Full address"
                value={branchForm.watch("address")}
                onChange={(e) => branchForm.setValue("address", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="managerName">Manager Name (Optional)</Label>
                <Input 
                  id="managerName"
                  placeholder="Branch manager"
                  value={branchForm.watch("managerName")}
                  onChange={(e) => branchForm.setValue("managerName", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="contactPhone">Contact Phone (Optional)</Label>
                <Input 
                  id="contactPhone"
                  placeholder="+260 XXX XXX XXX"
                  value={branchForm.watch("contactPhone")}
                  onChange={(e) => branchForm.setValue("contactPhone", e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateBranchModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const formData = branchForm.getValues();
                  if (formData.name && formData.location) {
                    createBranch.mutate(formData);
                  }
                }}
                disabled={createBranch.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createBranch.isPending ? "Creating..." : "Create Branch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNav
        activeTab="home"
        role="finance"
        tabs={[
          { id: "home", label: "Home", icon: "fas fa-home" },
          { id: "reports", label: "Reports", icon: "fas fa-chart-bar" },
          { id: "settings", label: "Settings", icon: "fas fa-cog" },
        ]}
      />
    </div>
  );
}