import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import { ConsolidatedSettlementCard } from "@/components/consolidated-settlement-card";
import { ConsolidatedSettlementTotalVolume } from "@/components/consolidated-settlement-total-volume";
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
import type { Wallet } from "@shared/schema";

const settlementSchema = z.object({
  amount: z.string().min(1, "Amount is required").transform((val) => Math.floor(parseFloat(val)).toString()),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
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

  // Fetch merchant wallets with stable refresh
  const { data: merchantWallets = [], isLoading: merchantWalletsLoading } = useQuery({
    queryKey: ["/api/merchant-wallets"],
    retry: false,
    refetchInterval: 30000, // 30-second refresh - merchant data changes infrequently
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 20000,
  });

  // Fetch wallet with stable updates
  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    retry: false,
    refetchInterval: 15000, // 15-second refresh - balance changes less frequently
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 10000,
  });

  // Fetch settlement requests with stable refresh
  const { data: settlementRequests = [], isLoading: settlementsLoading } = useQuery({
    queryKey: ["/api/settlement-requests"],
    retry: false,
    refetchInterval: 20000, // 20-second refresh - settlement data is relatively stable
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 15000,
  });

  // Fetch settlement breakdown with stable refresh
  const { data: settlementBreakdown } = useQuery({
    queryKey: ["/api/settlement-breakdown"],
    retry: false,
    refetchInterval: 20000, // 20-second refresh - breakdown data is stable
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 15000,
  });

  // Fetch branches
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["/api/branches"],
    retry: false,
  });

  // Fetch transactions for finance user (use admin endpoint since finance sees all transactions)
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/admin/transactions"],
    retry: false,
    refetchInterval: 5000, // 5-second refresh for transaction data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 2000,
  });

  // State for management tab
  const [activeTab, setActiveTab] = useState("dashboard");
  const [settlementFilter, setSettlementFilter] = useState("today");
  const [transactionFilter, setTransactionFilter] = useState("today");
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);

  // Settlement form
  const settlementForm = useForm({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      amount: "",
      bankName: "",
      accountNumber: "",
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

  // Organization form schema
  const organizationSchema = z.object({
    name: z.string().min(1, "Organization name is required"),
    type: z.string().min(1, "Organization type is required"),
    description: z.string().optional(),
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

  const editBranchForm = useForm({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      location: "",
      address: "",
      contactPhone: "",
      managerName: "",
    },
  });

  const organizationForm = useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
    },
  });

  // Create settlement request mutation
  const createSettlementRequest = useMutation({
    mutationFn: async (data: z.infer<typeof settlementSchema>) => {
      return await apiRequest("POST", "/api/settlement-requests", {
        ...data,
        amount: Math.floor(parseFloat(data.amount)).toString(),
      });
    },
    onSuccess: async (data: any) => {
      const amount = Math.floor(parseFloat(settlementForm.getValues('amount'))).toLocaleString();
      toast({
        title: "Settlement Request Created",
        description: `Settlement request for ZMW ${amount} submitted successfully`,
      });
      
      // Force immediate refetch of all related data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/settlement-breakdown"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/merchant-wallets"] }),
      ]);
      
      // Force immediate data refetch
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/settlement-requests"] }),
        queryClient.refetchQueries({ queryKey: ["/api/settlement-breakdown"] }),
        queryClient.refetchQueries({ queryKey: ["/api/wallet"] }),
      ]);
      
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

  // Update branch mutation
  const updateBranch = useMutation({
    mutationFn: async (data: z.infer<typeof branchSchema> & { id: number }) => {
      return await apiRequest("PUT", `/api/branches/${data.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branch updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setShowEditBranchModal(false);
      setSelectedBranch(null);
      editBranchForm.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to update branch";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update organization mutation
  const updateOrganization = useMutation({
    mutationFn: async (data: z.infer<typeof organizationSchema> & { id: number }) => {
      return await apiRequest("PUT", `/api/organizations/${data.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setShowEditOrgModal(false);
      organizationForm.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to update organization";
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

  // Helper function to get start of week (Monday)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
  };

  // Helper function to get start of month
  const getStartOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  // Filter transactions based on selected period
  const getFilteredTransactions = () => {
    if (!transactions) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return (transactions as any[]).filter((transaction: any) => {
      const transactionDate = new Date(transaction.createdAt);
      const transactionDateOnly = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
      
      switch (transactionFilter) {
        case 'today':
          return transactionDateOnly.getTime() === today.getTime();
        case 'this_week':
          const startOfWeek = getStartOfWeek(today);
          return transactionDate >= startOfWeek;
        case 'this_month':
          const startOfMonth = getStartOfMonth(today);
          return transactionDate >= startOfMonth;
        default:
          return true;
      }
    });
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
    const todaysCollections = Math.floor(parseFloat((wallet as any)?.todaysCollections || "0"));
    const todaysUsage = (settlementBreakdown as any)?.todaysUsage || 0;
    const settlementCapacity = Math.max(0, todaysCollections - todaysUsage);
    
    return {
      isValid: requestedAmount <= settlementCapacity,
      todaysCollections,
      todaysUsage,
      settlementCapacity,
      requestedAmount
    };
  };

  const calculateSettlementCapacity = () => {
    const todaysCollections = Math.floor(parseFloat((wallet as any)?.todaysCollections || "0"));
    const todaysUsage = Math.max(0, (settlementBreakdown as any)?.todaysUsage || 0);
    
    // Finance Portal: Settlement Capacity = Today's Collections - Today's Usage (pending + hold + approved)
    const settlementCapacity = Math.max(0, todaysCollections - todaysUsage);
    
    // Debug logging for finance portal calculations
    console.log("Finance Settlement Capacity Debug:", {
      todaysCollections,
      todaysUsage,
      settlementCapacity,
      walletData: wallet,
      settlementData: settlementBreakdown
    });
    
    return settlementCapacity;
  };

  const getOrganizationFunds = () => {
    // Organization funds = persistent wallet balance (different from settlement capacity)
    return Math.floor(parseFloat((wallet as any)?.balance || "0"));
  };

  const getStatusBreakdown = () => {
    if (!(settlementBreakdown as any)?.breakdown) return [];
    return (settlementBreakdown as any).breakdown;
  };

  const getFilteredSettlementRequests = () => {
    if (!settlementRequests || !(settlementRequests as any[]).length) return [];
    
    const requests = settlementRequests as any[];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    switch (settlementFilter) {
      case "today":
        return requests.filter(request => {
          const requestDate = new Date(request.createdAt);
          return requestDate >= today;
        });
      case "yesterday":
        return requests.filter(request => {
          const requestDate = new Date(request.createdAt);
          return requestDate >= yesterday && requestDate < today;
        });
      case "last7days":
        return requests.filter(request => {
          const requestDate = new Date(request.createdAt);
          return requestDate >= lastWeek;
        });
      default:
        return requests.filter(request => {
          const requestDate = new Date(request.createdAt);
          return requestDate >= today;
        });
    }
  };

  const handleEditBranch = (branch: any) => {
    setSelectedBranch(branch);
    editBranchForm.reset({
      name: branch.name || "",
      location: branch.location || "",
      address: branch.address || "",
      contactPhone: branch.contactPhone || "",
      managerName: branch.managerName || "",
    });
    setShowEditBranchModal(true);
  };

  const handleEditOrganization = () => {
    const organization = (organizations as any[])[0];
    if (organization) {
      organizationForm.reset({
        name: organization.name || "",
        type: organization.type || "",
        description: organization.description || "",
      });
      setShowEditOrgModal(true);
    }
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
            onClick={() => setActiveTab("settlements")}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "settlements"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <i className="fas fa-university mr-2"></i>
            Settlements
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
            {/* Daily Activity & Settlement Overview */}
        <Card className="shadow-sm border border-blue-200 dark:border-blue-700 mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Today's Collections Column */}
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <div className="text-center">
                  <p className="text-blue-700 dark:text-blue-300 text-sm font-medium mb-1">TODAY'S COLLECTIONS</p>
                  <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-200 mb-1">
                    {formatCurrency(calculateTotalMerchantCollections())}
                  </h2>
                  <p className="text-blue-600 dark:text-blue-400 text-xs">
                    Collected across {(merchantWallets as any[]).filter(m => parseFloat(m.dailyCollected || '0') > 0).length} active merchants
                  </p>
                </div>
              </div>

              {/* Total Volume Column - Using ConsolidatedSettlementCard data */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <ConsolidatedSettlementTotalVolume />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consolidated Monthly Settlement Card */}
        <div className="mb-6">
          <ConsolidatedSettlementCard />
        </div>

        

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

        {/* Transaction List */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Transaction History</h3>
                <select
                  value={transactionFilter}
                  onChange={(e) => setTransactionFilter(e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                </select>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {getFilteredTransactions().length} transactions
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Total: {formatCurrency(getFilteredTransactions().reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0))}
                </div>
              </div>
            </div>
            
            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
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
            ) : getFilteredTransactions().length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-receipt text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  {transactionFilter === 'today' ? 'No transactions today' :
                   transactionFilter === 'this_week' ? 'No transactions this week' :
                   'No transactions this month'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {getFilteredTransactions().slice(0, 20).map((transaction: any) => (
                  <div key={transaction.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                    transaction.status === 'completed' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' :
                    transaction.status === 'pending' ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800' :
                    transaction.status === 'qr_verification' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' :
                    'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}>
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        transaction.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                        transaction.status === 'pending' ? 'bg-orange-100 dark:bg-orange-900' :
                        transaction.status === 'qr_verification' ? 'bg-blue-100 dark:bg-blue-900' :
                        'bg-gray-100 dark:bg-gray-900'
                      }`}>
                        <i className={`fas ${
                          transaction.status === 'completed' ? 'fa-check text-green-600' :
                          transaction.status === 'pending' ? 'fa-clock text-orange-600' :
                          transaction.status === 'qr_verification' ? 'fa-qrcode text-blue-600' :
                          'fa-exchange-alt text-gray-600'
                        }`}></i>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          {transaction.transactionId}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {new Date(transaction.createdAt).toLocaleDateString()} at {new Date(transaction.createdAt).toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                        {formatCurrency(transaction.amount)}
                      </p>
                      <Badge className={`text-xs ${
                        transaction.status === 'completed' ? 'bg-green-600 text-white' :
                        transaction.status === 'pending' ? 'bg-orange-600 text-white' :
                        transaction.status === 'qr_verification' ? 'bg-blue-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {transaction.status === 'qr_verification' ? 'QR Verify' : 
                         transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {getFilteredTransactions().length > 20 && (
                  <div className="text-center py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Showing first 20 of {getFilteredTransactions().length} transactions
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

          </>
        )}

        {/* Settlements Tab */}
        {activeTab === "settlements" && (
          <>
            {/* Settlement Requests */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">Settlement Requests</h3>
                    <select
                      value={settlementFilter}
                      onChange={(e) => setSettlementFilter(e.target.value)}
                      className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="last7days">Last 7 Days</option>
                    </select>
                  </div>
                  <div>
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
                      
                      {/* Available Funds Display */}
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Available Funds for Settlement
                          </span>
                          <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                            {walletLoading ? (
                              <div className="w-20 h-5 bg-blue-200 dark:bg-blue-800 rounded animate-pulse"></div>
                            ) : (
                              formatCurrency((wallet as Wallet)?.balance || '0')
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          This is your organization's fund balance available for settlement requests
                        </p>
                      </div>
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
                ) : getFilteredSettlementRequests().length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-university text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No settlement requests</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Create your first settlement request</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getFilteredSettlementRequests().map((request: any) => (
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
                    onClick={handleEditOrganization}
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
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditBranch(branch)}
                              className="text-xs px-2 py-1"
                            >
                              <i className="fas fa-edit mr-1"></i>
                              Edit
                            </Button>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              branch.isActive 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {branch.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
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

      {/* Edit Branch Modal */}
      <Dialog open={showEditBranchModal} onOpenChange={setShowEditBranchModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch information for your organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="editBranchName">Branch Name</Label>
              <Input 
                id="editBranchName"
                placeholder="Enter branch name"
                value={editBranchForm.watch("name")}
                onChange={(e) => editBranchForm.setValue("name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="editBranchLocation">Location</Label>
              <Input 
                id="editBranchLocation"
                placeholder="City, District"
                value={editBranchForm.watch("location")}
                onChange={(e) => editBranchForm.setValue("location", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="editBranchAddress">Address (Optional)</Label>
              <Input 
                id="editBranchAddress"
                placeholder="Full address"
                value={editBranchForm.watch("address")}
                onChange={(e) => editBranchForm.setValue("address", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editManagerName">Manager Name (Optional)</Label>
                <Input 
                  id="editManagerName"
                  placeholder="Branch manager"
                  value={editBranchForm.watch("managerName")}
                  onChange={(e) => editBranchForm.setValue("managerName", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="editContactPhone">Contact Phone (Optional)</Label>
                <Input 
                  id="editContactPhone"
                  placeholder="+260 XXX XXX XXX"
                  value={editBranchForm.watch("contactPhone")}
                  onChange={(e) => editBranchForm.setValue("contactPhone", e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditBranchModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const formData = editBranchForm.getValues();
                  if (formData.name && formData.location && selectedBranch) {
                    // Clean up form data - convert empty strings to undefined for optional fields
                    const cleanedData = {
                      name: formData.name,
                      location: formData.location,
                      address: formData.address || undefined,
                      contactPhone: formData.contactPhone || undefined,
                      managerName: formData.managerName || undefined,
                      id: selectedBranch.id
                    };
                    updateBranch.mutate(cleanedData);
                  }
                }}
                disabled={updateBranch.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateBranch.isPending ? "Updating..." : "Update Branch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Modal */}
      <Dialog open={showEditOrgModal} onOpenChange={setShowEditOrgModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="editOrgName">Organization Name</Label>
              <Input 
                id="editOrgName"
                placeholder="Enter organization name"
                value={organizationForm.watch("name")}
                onChange={(e) => organizationForm.setValue("name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="editOrgType">Organization Type</Label>
              <Select 
                value={organizationForm.watch("type")}
                onValueChange={(value) => organizationForm.setValue("type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="financial_institution">Financial Institution</SelectItem>
                  <SelectItem value="microfinance">Microfinance</SelectItem>
                  <SelectItem value="cooperative">Cooperative</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editOrgDescription">Description (Optional)</Label>
              <Input 
                id="editOrgDescription"
                placeholder="Organization description"
                value={organizationForm.watch("description")}
                onChange={(e) => organizationForm.setValue("description", e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditOrgModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const formData = organizationForm.getValues();
                  const organization = (organizations as any[])[0];
                  if (formData.name && formData.type && organization) {
                    // Clean up form data - convert empty strings to undefined for optional fields
                    const cleanedData = {
                      name: formData.name,
                      type: formData.type,
                      description: formData.description || undefined,
                      id: organization.id
                    };
                    updateOrganization.mutate(cleanedData);
                  }
                }}
                disabled={updateOrganization.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {updateOrganization.isPending ? "Updating..." : "Update Organization"}
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