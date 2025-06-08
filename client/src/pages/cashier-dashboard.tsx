import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import DocumentUploadModal from "@/components/document-upload-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CashierDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [activeSession, setActiveSession] = useState({
    merchant: "Tech Store Plus",
    location: "Westlands Branch, Nairobi",
    amount: "25000"
  });

  // Calculate countdown for each pending transaction
  const [countdowns, setCountdowns] = useState<{ [key: number]: number }>({});

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

  // Fetch wallet data for cashier balance
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["/api/wallet"],
    retry: false,
  });

  // Fetch pending transactions (exclude expired ones)
  const { data: pendingTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions/pending"],
    retry: false,
  });

  // Fetch today's transaction history
  const { data: todayTransactions = [], isLoading: historyLoading } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
  });

  // Update countdowns for pending transactions
  useEffect(() => {
    const filteredTransactions = (pendingTransactions as any[]).filter((transaction: any) => {
      // Only show non-expired transactions
      if (transaction.expiresAt) {
        const expiresAt = new Date(transaction.expiresAt);
        return expiresAt > new Date();
      }
      return true;
    });

    // Initialize countdowns
    const initialCountdowns: { [key: number]: number } = {};
    filteredTransactions.forEach((transaction: any) => {
      if (transaction.expiresAt) {
        const expiresAt = new Date(transaction.expiresAt);
        const now = new Date();
        const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        initialCountdowns[transaction.id] = secondsLeft;
      }
    });
    setCountdowns(initialCountdowns);

    // Update countdowns every second
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        
        Object.keys(updated).forEach(id => {
          const numId = parseInt(id);
          if (updated[numId] > 0) {
            updated[numId] = updated[numId] - 1;
            hasChanges = true;
          } else if (updated[numId] === 0) {
            // Transaction expired, refetch data
            queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
          }
        });
        
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingTransactions, queryClient]);

  // Approve transaction mutation
  const approveTransaction = useMutation({
    mutationFn: async (transactionId: number) => {
      await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
        status: "completed"
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transfer approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
    },
    onError: (error) => {
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
        description: "Failed to approve transfer",
        variant: "destructive",
      });
    },
  });

  // Reject transaction mutation
  const rejectTransaction = useMutation({
    mutationFn: async ({ transactionId, reason }: { transactionId: number; reason: string }) => {
      await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
        status: "rejected",
        rejectionReason: reason
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transfer rejected",
      });
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error) => {
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
        description: "Failed to reject transfer",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    return `ZMW ${Math.round(parseFloat(amount.toString())).toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <i className="fas fa-shield-alt text-white text-2xl"></i>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileHeader
        title="Security Cashier"
        subtitle={user?.firstName || "Security Cashier"}
        icon="fas fa-shield-alt"
        color="accent"
      />

      <div className="p-4">
        {/* Cashier E-Value Balance Dashboard */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <i className="fas fa-wallet text-primary mr-2"></i>
              Daily E-Value Balance
            </h3>
            
            {walletLoading ? (
              <div className="animate-pulse">
                <div className="w-32 h-8 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
                <div className="w-24 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Available Balance:</span>
                  <span className="font-bold text-2xl text-primary">
                    {formatCurrency((wallet as any)?.balance || "0")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Daily Allocation:</span>
                  <span className="text-gray-800 dark:text-gray-200">
                    {formatCurrency((wallet as any)?.dailyAllocation || "0")}
                  </span>
                </div>
                {parseFloat((wallet as any)?.balance || "0") === 0 && (
                  <div className="bg-destructive bg-opacity-10 border border-destructive text-destructive p-3 rounded-lg mt-3">
                    <div className="flex items-center">
                      <i className="fas fa-exclamation-triangle mr-2"></i>
                      <span className="text-sm font-medium">No transactions allowed - Balance depleted</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Session Card */}
        <div className="gradient-accent rounded-2xl p-6 text-white mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-orange-100 text-sm">Active Session</p>
              <h2 className="text-xl font-bold">{activeSession.merchant}</h2>
            </div>
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <i className="fas fa-clock text-white text-xl"></i>
            </div>
          </div>
          <div className="flex items-center text-orange-100 text-sm">
            <i className="fas fa-map-marker-alt mr-2"></i>
            <span>{activeSession.location}</span>
          </div>
        </div>

        {/* Cash Counting Workflow */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <i className="fas fa-money-bill-wave text-secondary mr-2"></i>
              Cash Counting Process
            </h3>
            
            <div className="space-y-4">
              {/* Step 1: Count Cash - Enhanced contrast */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-1 border-2 border-white shadow-lg">
                  <span className="text-white text-sm font-bold">1</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Physical Cash Counted</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                    {formatCurrency(activeSession.amount)} verified with merchant
                  </p>
                </div>
              </div>

              {/* Step 2: VMF Form */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm font-bold">2</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Upload VMF Documents</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">Scan and upload triplicate forms</p>
                  <Button 
                    onClick={() => setShowUploadModal(true)}
                    className="mt-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <i className="fas fa-camera mr-2"></i>Upload Documents
                  </Button>
                </div>
              </div>

              {/* Step 3: Transfer */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm font-bold">3</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-400 text-sm">Complete Transfer</h4>
                  <p className="text-gray-400 text-xs mt-1">Await merchant payment request</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Payment Requests */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <i className="fas fa-bell text-warning mr-2"></i>
              Pending Requests
            </h3>
            
            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="w-32 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                        <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      </div>
                      <div className="text-right">
                        <div className="w-20 h-6 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                        <div className="w-16 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (pendingTransactions as any[]).filter((transaction: any) => {
              // Only show non-expired transactions
              if (transaction.expiresAt) {
                const expiresAt = new Date(transaction.expiresAt);
                return expiresAt > new Date();
              }
              return true;
            }).length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-bell text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No pending requests</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Payment requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(pendingTransactions as any[])
                  .filter((transaction: any) => {
                    // Only show non-expired transactions
                    if (transaction.expiresAt) {
                      const expiresAt = new Date(transaction.expiresAt);
                      return expiresAt > new Date();
                    }
                    return true;
                  })
                  .map((transaction: any) => {
                    const countdown = countdowns[transaction.id] || 0;
                    const isExpiring = countdown > 0 && countdown <= 30;
                    
                    return (
                      <div key={transaction.id} className={`border rounded-lg p-4 ${
                        isExpiring ? 'border-destructive bg-destructive bg-opacity-5' : 'border-warning bg-warning bg-opacity-5'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-800 dark:text-gray-200">Payment Request</h4>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {transaction.description || 'Cash Digitization'}
                            </p>
                            {countdown > 0 && (
                              <div className={`flex items-center mt-2 ${isExpiring ? 'text-destructive' : 'text-warning'}`}>
                                <i className="fas fa-clock mr-2"></i>
                                <span className="text-sm font-medium">
                                  Expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-xl text-gray-800 dark:text-gray-200">
                              {formatCurrency(transaction.amount)}
                            </p>
                            <Badge className={isExpiring ? "bg-destructive text-white" : "status-pending"}>
                              {isExpiring ? "Expiring Soon" : "Pending Approval"}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Rejection Reason Selection */}
                        <div className="mb-3">
                          <Select onValueChange={setRejectionReason} value={rejectionReason}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select rejection reason (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Wrong Amount Entered">Wrong Amount Entered</SelectItem>
                              <SelectItem value="VMF Mismatch">VMF Number Mismatch</SelectItem>
                              <SelectItem value="Insufficient Balance">Insufficient Balance</SelectItem>
                              <SelectItem value="Server Error">Server Error</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex space-x-3">
                          <Button 
                            onClick={() => approveTransaction.mutate(transaction.id)}
                            disabled={approveTransaction.isPending || countdown === 0}
                            className="flex-1 bg-success hover:bg-success/90 text-white py-2 rounded-lg font-medium"
                          >
                            <i className="fas fa-check mr-2"></i>Approve Transfer
                          </Button>
                          <Button 
                            onClick={() => {
                              const reason = rejectionReason || "No reason provided";
                              rejectTransaction.mutate({ transactionId: transaction.id, reason });
                            }}
                            disabled={rejectTransaction.isPending}
                            className="flex-1 bg-destructive hover:bg-destructive/90 text-white py-2 rounded-lg font-medium"
                          >
                            <i className="fas fa-times mr-2"></i>Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Transaction History */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <i className="fas fa-history text-info mr-2"></i>
              Today's Transaction History
            </h3>
            
            {historyLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-32 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      <div className="w-20 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="w-48 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {(todayTransactions as any[])
                  .filter((transaction: any) => {
                    // Filter for today's transactions
                    const today = new Date();
                    const transactionDate = new Date(transaction.createdAt);
                    return transactionDate.toDateString() === today.toDateString();
                  })
                  .slice(0, 10) // Show only last 10 transactions
                  .map((transaction: any) => {
                    const isCompleted = transaction.status === 'completed';
                    const isRejected = transaction.status === 'rejected';
                    
                    return (
                      <div key={transaction.id} className={`border rounded-lg p-3 ${
                        isCompleted ? 'border-success bg-success bg-opacity-5' :
                        isRejected ? 'border-destructive bg-destructive bg-opacity-5' :
                        'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <i className={`fas ${
                              isCompleted ? 'fa-check-circle text-success' :
                              isRejected ? 'fa-times-circle text-destructive' :
                              'fa-clock text-warning'
                            }`}></i>
                            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                              {formatCurrency(transaction.amount)}
                            </span>
                            <Badge className={
                              isCompleted ? "bg-success text-white" :
                              isRejected ? "bg-destructive text-white" :
                              "status-pending"
                            }>
                              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(transaction.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {transaction.description || 'Cash Digitization'}
                        </p>
                        
                        {transaction.rejectionReason && (
                          <div className="bg-destructive bg-opacity-10 border border-destructive text-destructive p-2 rounded text-xs mt-2">
                            <div className="flex items-center">
                              <i className="fas fa-exclamation-triangle mr-2"></i>
                              <span className="font-medium">Reason: {transaction.rejectionReason}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                
                {(todayTransactions as any[]).filter((transaction: any) => {
                  const today = new Date();
                  const transactionDate = new Date(transaction.createdAt);
                  return transactionDate.toDateString() === today.toDateString();
                }).length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-history text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No transactions today</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Transaction history will appear here</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileNav
        activeTab="home"
        role="cashier"
        tabs={[
          { id: "home", label: "Home", icon: "fas fa-home" },
          { id: "sessions", label: "Sessions", icon: "fas fa-history" },
          { id: "profile", label: "Profile", icon: "fas fa-user" },
        ]}
      />

      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}
