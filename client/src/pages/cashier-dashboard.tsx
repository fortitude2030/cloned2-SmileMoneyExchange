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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // Cash counting verification fields
  const [enteredAmount, setEnteredAmount] = useState<string>("");
  const [enteredVMF, setEnteredVMF] = useState<string>("");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

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

  // Fetch all pending transactions (including expired ones for cashier visibility)
  const { data: allPendingTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions/pending"],
    retry: false,
  });

  // Separate active and expired transactions
  const pendingTransactions = (allPendingTransactions as any[]).filter((transaction: any) => {
    if (transaction.expiresAt) {
      const expiresAt = new Date(transaction.expiresAt);
      return expiresAt > new Date();
    }
    return true;
  });

  const expiredTransactions = (allPendingTransactions as any[]).filter((transaction: any) => {
    if (transaction.expiresAt) {
      const expiresAt = new Date(transaction.expiresAt);
      return expiresAt <= new Date();
    }
    return false;
  });

  // Fetch today's transaction history
  const { data: todayTransactions = [], isLoading: historyLoading } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
  });

  // Update countdowns for pending transactions
  useEffect(() => {
    if (!Array.isArray(pendingTransactions) || pendingTransactions.length === 0) {
      return;
    }

    // Initialize countdowns only once
    const initialCountdowns: { [key: number]: number } = {};
    pendingTransactions.forEach((transaction: any) => {
      if (transaction.expiresAt) {
        const expiresAt = new Date(transaction.expiresAt);
        const now = new Date();
        const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        initialCountdowns[transaction.id] = secondsLeft;
      }
    });
    
    setCountdowns(initialCountdowns);
  }, [pendingTransactions]);

  // Separate effect for countdown updates
  useEffect(() => {
    const hasCountdowns = Object.keys(countdowns).length > 0;
    if (!hasCountdowns) {
      return;
    }

    const interval = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        let shouldRefetch = false;
        
        Object.keys(updated).forEach(id => {
          const numId = parseInt(id);
          if (updated[numId] > 0) {
            updated[numId] = updated[numId] - 1;
            hasChanges = true;
          } else if (updated[numId] === 0) {
            // Mark for refetch but don't do it immediately to avoid infinite loop
            shouldRefetch = true;
            delete updated[numId];
          }
        });
        
        // Refetch data only once every 5 seconds when transactions expire
        if (shouldRefetch) {
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
          }, 5000);
        }
        
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Remove problematic dependencies

  // Verify and process transaction mutation
  const verifyTransaction = useMutation({
    mutationFn: async ({ transactionId, enteredAmount, enteredVMF, transaction }: { 
      transactionId: number; 
      enteredAmount: string; 
      enteredVMF: string;
      transaction: any;
    }) => {
      // Auto-verify amount and VMF
      const requestedAmount = parseFloat(transaction.amount);
      const inputAmount = parseFloat(enteredAmount);
      const requestedVMF = transaction.vmfNumber || "";
      
      // Check for verification failures
      if (Math.abs(requestedAmount - inputAmount) > 0.01) {
        // Amount mismatch - auto reject
        return await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
          status: "rejected",
          rejectionReason: "Amount Not Same as Merchant's"
        });
      }
      
      if (enteredVMF !== requestedVMF) {
        // VMF mismatch - auto reject
        return await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
          status: "rejected",
          rejectionReason: "VMF Number Not Same as Merchant's"
        });
      }
      
      // If verification passes, approve the transaction
      return await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
        status: "completed"
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transaction processed successfully",
      });
      setEnteredAmount("");
      setEnteredVMF("");
      setSelectedTransaction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
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
        description: "Failed to process transaction",
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

        {/* Simplified Cash Verification */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <i className="fas fa-money-bill-wave text-secondary mr-2"></i>
              Quick Cash Verification
            </h3>
            
            <div className="space-y-4">
              {/* Simplified Single Step Process */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Count & Verify Cash</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">Count physical cash and confirm amount matches VMF number</p>
                  
                  {selectedTransaction && (
                    <div className="mt-3 space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-800 dark:text-blue-200">Transaction Details</span>
                          {countdowns[selectedTransaction.id] > 0 && (
                            <span className="text-blue-600 dark:text-blue-400 text-xs">
                              <i className="fas fa-clock mr-1"></i>
                              {Math.floor(countdowns[selectedTransaction.id] / 60)}:{(countdowns[selectedTransaction.id] % 60).toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-blue-700 dark:text-blue-300">Amount:</span>
                            <p className="font-bold text-blue-900 dark:text-blue-100">{formatCurrency(selectedTransaction.amount)}</p>
                          </div>
                          <div>
                            <span className="text-blue-700 dark:text-blue-300">VMF:</span>
                            <p className="font-bold text-blue-900 dark:text-blue-100">{selectedTransaction.vmfNumber || "N/A"}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="amount" className="text-xs font-medium">Cash Counted (ZMW)</Label>
                          <Input
                            id="amount"
                            type="number"
                            placeholder="Amount counted"
                            value={enteredAmount}
                            onChange={(e) => setEnteredAmount(e.target.value)}
                            className="h-10 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vmf" className="text-xs font-medium">VMF Confirmation</Label>
                          <Input
                            id="vmf"
                            type="text"
                            placeholder="VMF number"
                            value={enteredVMF}
                            onChange={(e) => setEnteredVMF(e.target.value)}
                            className="h-10 text-sm mt-1"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => verifyTransaction.mutate({
                            transactionId: selectedTransaction.id,
                            enteredAmount,
                            enteredVMF,
                            transaction: selectedTransaction
                          })}
                          disabled={verifyTransaction.isPending || !enteredAmount || !enteredVMF}
                          className="flex-1 bg-success hover:bg-success/90 text-white h-10"
                        >
                          {verifyTransaction.isPending ? (
                            <><i className="fas fa-spinner fa-spin mr-2"></i>Processing</>
                          ) : (
                            <><i className="fas fa-check mr-2"></i>Approve</>
                          )}
                        </Button>
                        <Button 
                          onClick={() => {
                            setRejectionReason("Manual verification failed");
                            rejectTransaction.mutate({
                              transactionId: selectedTransaction.id,
                              reason: "Manual verification failed"
                            });
                          }}
                          disabled={rejectTransaction.isPending}
                          variant="destructive"
                          className="h-10 px-4"
                        >
                          <i className="fas fa-times mr-1"></i>Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Upload VMF Documents */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-warning rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm font-bold">3</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Upload VMF Documents</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">Scan and upload triplicate forms</p>
                  <Button 
                    onClick={() => setShowUploadModal(true)}
                    className="mt-2 bg-warning text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <i className="fas fa-camera mr-2"></i>Upload Documents
                  </Button>
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
                            onClick={() => setSelectedTransaction(transaction)}
                            disabled={countdown === 0}
                            className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg font-medium"
                          >
                            <i className="fas fa-edit mr-2"></i>Verify & Process
                          </Button>
                          <Button 
                            onClick={() => {
                              const reason = rejectionReason || "Server Error 01";
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

        {/* Expired Transactions */}
        {expiredTransactions.length > 0 && (
          <Card className="shadow-sm border border-red-200 dark:border-red-700 mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <i className="fas fa-clock text-red-500 mr-2"></i>
                Expired Requests ({expiredTransactions.length})
              </h3>
              
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {expiredTransactions.map((transaction: any) => (
                  <div key={transaction.id} className="border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-red-800 dark:text-red-200 text-sm">Expired Request</h4>
                        <p className="text-red-600 dark:text-red-400 text-xs">
                          {transaction.description || 'Cash Digitization'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-red-800 dark:text-red-200">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <Badge className="bg-red-500 text-white text-xs">
                          Expired
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-red-700 dark:text-red-300">VMF:</span>
                        <p className="text-red-800 dark:text-red-200 font-medium">
                          {transaction.vmfNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-red-700 dark:text-red-300">Expired:</span>
                        <p className="text-red-800 dark:text-red-200 font-medium">
                          {transaction.expiresAt ? new Date(transaction.expiresAt).toLocaleTimeString() : "Unknown"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 p-2 bg-red-100 dark:bg-red-800/30 rounded border border-red-200 dark:border-red-600">
                      <div className="flex items-center text-red-700 dark:text-red-300">
                        <i className="fas fa-info-circle mr-2 text-xs"></i>
                        <span className="text-xs">This request timed out and requires merchant to resend</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                    // Filter for today's transactions (including expired ones)
                    const today = new Date();
                    const transactionDate = new Date(transaction.createdAt);
                    return transactionDate.toDateString() === today.toDateString();
                  })
                  .slice(0, 15) // Show more transactions including expired ones
                  .map((transaction: any) => {
                    const isCompleted = transaction.status === 'completed';
                    const isRejected = transaction.status === 'rejected';
                    const isExpired = transaction.status === 'expired' || 
                      (transaction.expiresAt && new Date(transaction.expiresAt) < new Date());
                    
                    return (
                      <div key={transaction.id} className={`border rounded-lg p-3 ${
                        isCompleted ? 'border-success bg-success bg-opacity-5' :
                        isRejected ? 'border-destructive bg-destructive bg-opacity-5' :
                        isExpired ? 'border-gray-400 bg-gray-100 dark:bg-gray-800' :
                        'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <i className={`fas ${
                              isCompleted ? 'fa-check-circle text-success' :
                              isRejected ? 'fa-times-circle text-destructive' :
                              isExpired ? 'fa-clock text-gray-400' :
                              'fa-clock text-warning'
                            }`}></i>
                            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                              {formatCurrency(transaction.amount)}
                            </span>
                            <Badge className={
                              isCompleted ? "bg-success text-white" :
                              isRejected ? "bg-destructive text-white" :
                              isExpired ? "bg-gray-400 text-white" :
                              "status-pending"
                            }>
                              {isExpired ? "Expired" : transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(transaction.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {transaction.description || 'Cash Digitization'}
                        </p>
                        
                        {transaction.vmfNumber && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            VMF: {transaction.vmfNumber}
                          </p>
                        )}
                        
                        {transaction.rejectionReason && (
                          <div className="bg-destructive bg-opacity-10 border border-destructive text-destructive p-2 rounded text-xs mt-2">
                            <div className="flex items-center">
                              <i className="fas fa-exclamation-triangle mr-2"></i>
                              <span className="font-medium">Reason: {transaction.rejectionReason}</span>
                            </div>
                          </div>
                        )}
                        
                        {isExpired && !transaction.rejectionReason && (
                          <div className="bg-gray-100 border border-gray-300 text-gray-600 p-2 rounded text-xs mt-2">
                            <div className="flex items-center">
                              <i className="fas fa-clock mr-2"></i>
                              <span className="font-medium">Transaction expired - no action taken</span>
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
