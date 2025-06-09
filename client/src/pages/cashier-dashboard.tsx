import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTransactionNotifications } from "@/hooks/use-transaction-notifications";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import DocumentUploadModal from "@/components/document-upload-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CashierDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { showSuccessNotification, showFailureNotification } = useTransactionNotifications();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [showVMFModal, setShowVMFModal] = useState(false);
  const [cashCountingStep, setCashCountingStep] = useState(1);
  const [cashAmount, setCashAmount] = useState("");
  const [vmfNumber, setVmfNumber] = useState("");
  const [currentTransaction, setCurrentTransaction] = useState<any>(null);
  const [activeSession, setActiveSession] = useState({
    merchant: "Tech Store Plus",
    location: "Westlands Branch, Nairobi",
    amount: "0"
  });
  const [requestCooldown, setRequestCooldown] = useState(0); // Start with no timer
  const [processedTransactionIds, setProcessedTransactionIds] = useState<Set<string>>(new Set());

  // Timer effect for request cooldown - only runs when cooldown > 0
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (requestCooldown > 0) {
      interval = setInterval(() => {
        setRequestCooldown(prev => {
          if (prev <= 1) {
            return 0; // Stop timer
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [requestCooldown]);



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

  // Fetch pending transactions
  const { data: pendingTransactions = [], isLoading: transactionsLoading } = useQuery<Array<{
    id: number;
    transactionId: string;
    amount: string;
    status: string;
    vmfNumber?: string;
    createdAt: string;
    description?: string;
  }>>({
    queryKey: ["/api/transactions/pending"],
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 1000, // Poll every second for real-time updates
    refetchIntervalInBackground: true,
  });

  // Get the active transaction for validation
  const activeTransaction = pendingTransactions.length > 0 ? pendingTransactions[0] : null;

  // Monitor for new payment requests and start timer
  useEffect(() => {
    if (activeTransaction) {
      const transactionId = activeTransaction.transactionId;
      
      // Only start timer for truly new transactions that haven't been processed
      if (!processedTransactionIds.has(transactionId) && requestCooldown === 0) {
        setRequestCooldown(120);
        setProcessedTransactionIds(prev => new Set(prev).add(transactionId));
      }
    } else if (!activeTransaction && requestCooldown > 0) {
      setRequestCooldown(0);
    }
  }, [activeTransaction, requestCooldown, processedTransactionIds]);

  // Handle timer expiration to automatically reject transactions
  useEffect(() => {
    const checkTimerExpiry = async () => {
      if (requestCooldown === 0 && activeTransaction) {
        try {
          await apiRequest("PATCH", `/api/transactions/${activeTransaction.id}/status`, {
            status: "rejected",
            rejectionReason: "timed out"
          });
          
          // Remove timed out transaction from processed set
          setProcessedTransactionIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(activeTransaction.transactionId);
            return newSet;
          });
          
          queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
        } catch (error) {
          console.error("Failed to reject timed out transaction:", error);
        }
      }
    };

    // Add a small delay to prevent immediate execution
    const timer = setTimeout(checkTimerExpiry, 100);
    return () => clearTimeout(timer);
  }, [requestCooldown, activeTransaction]);

  // Approve transaction mutation with dual authentication
  const approveTransaction = useMutation({
    mutationFn: async (data: { 
      transactionId: number; 
      cashierAmount: string; 
      cashierVmfNumber: string;
      originalAmount: string;
      originalVmfNumber: string;
    }) => {
      // Validate amounts match exactly
      const cashierAmountNum = parseFloat(data.cashierAmount);
      const originalAmountNum = parseFloat(data.originalAmount);
      
      if (Math.abs(cashierAmountNum - originalAmountNum) > 0.01) {
        throw new Error("AMOUNT_MISMATCH");
      }
      
      // Validate VMF numbers match exactly (case-insensitive)
      if (data.cashierVmfNumber.toUpperCase() !== data.originalVmfNumber.toUpperCase()) {
        throw new Error("VMF_MISMATCH");
      }
      
      await apiRequest("PATCH", `/api/transactions/${data.transactionId}/status`, {
        status: "completed",
        verifiedAmount: data.cashierAmount,
        verifiedVmfNumber: data.cashierVmfNumber
      });
    },
    onSuccess: (_, variables) => {
      showSuccessNotification();
      setRequestCooldown(0); // Stop timer since transaction is completed
      // Remove completed transaction from processed set
      setProcessedTransactionIds(prev => {
        const newSet = new Set(prev);
        // Find the transaction ID from the variables if available
        if (activeTransaction) {
          newSet.delete(activeTransaction.transactionId);
        }
        return newSet;
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
      
      const errorMessage = error.message;
      if (errorMessage === "AMOUNT_MISMATCH") {
        showFailureNotification();
      } else if (errorMessage === "VMF_MISMATCH") {
        showFailureNotification();
      } else {
        showFailureNotification();
      }
    },
  });

  // Reject transaction mutation with reason
  const rejectTransaction = useMutation({
    mutationFn: async (data: { transactionId: number; reason: string }) => {
      await apiRequest("PATCH", `/api/transactions/${data.transactionId}/status`, {
        status: "rejected",
        rejectionReason: data.reason
      });
    },
    onSuccess: (_, variables) => {
      showFailureNotification();
      setRequestCooldown(0); // Stop timer since transaction is rejected
      
      // Remove rejected transaction from processed set
      setProcessedTransactionIds(prev => {
        const newSet = new Set(prev);
        if (activeTransaction) {
          newSet.delete(activeTransaction.transactionId);
        }
        return newSet;
      });
      
      // Reset the workflow for next transaction
      setCashCountingStep(1);
      setCashAmount("");
      setVmfNumber("");
      setActiveSession(prev => ({ ...prev, amount: "0" }));
      
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
        description: "Failed to reject transfer",
        variant: "destructive",
      });
    },
  });

  // Handle final transaction approval (validations already completed)
  const handleApproveTransaction = (transaction: any) => {
    // Check if cashier has completed the 3-step process
    if (cashCountingStep < 4 || !cashAmount || !vmfNumber) {
      toast({
        title: "Incomplete Process",
        description: "Please complete the 3-step cash counting process first",
        variant: "destructive",
      });
      return;
    }

    // Since validation already happened during steps 1 & 2, just approve
    approveTransaction.mutate({
      transactionId: transaction.id,
      cashierAmount: cashAmount,
      cashierVmfNumber: vmfNumber,
      originalAmount: transaction.amount,
      originalVmfNumber: transaction.vmfNumber || ""
    });
  };

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
        subtitle={(user as any)?.firstName || "Security Cashier"}
        icon="fas fa-shield-alt"
        color="accent"
      />

      <div className="p-4">
        {/* Request Cooldown Timer */}
        {requestCooldown > 0 && (
          <div className="flex justify-center mb-4">
            <div className={`
              w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-1500
              ${requestCooldown > 60 ? 'bg-green-500' : 
                requestCooldown > 30 ? 'bg-amber-500' : 'bg-red-500'}
            `}>
              <div className="text-2xl font-bold text-white">
                {Math.floor(requestCooldown / 60)}:{(requestCooldown % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        )}

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
              {/* Step 1: Enter Amount */}
              <div className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  cashCountingStep > 1 ? 'bg-success' : 'bg-primary'
                }`}>
                  {cashCountingStep > 1 ? (
                    <i className="fas fa-check text-white text-sm"></i>
                  ) : (
                    <span className="text-white text-sm font-bold">1</span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Enter Cash Amount</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                    {cashAmount ? `ZMW ${parseFloat(cashAmount).toLocaleString()}` : 'Enter the physical cash amount counted'}
                  </p>
                  {cashCountingStep === 1 && (
                    <Button 
                      onClick={() => setShowAmountModal(true)}
                      className="mt-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <i className="fas fa-calculator mr-2"></i>Enter Amount
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 2: Enter VMF Number */}
              <div className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  cashCountingStep > 2 ? 'bg-success' : cashCountingStep === 2 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {cashCountingStep > 2 ? (
                    <i className="fas fa-check text-white text-sm"></i>
                  ) : (
                    <span className="text-white text-sm font-bold">2</span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium text-sm ${
                    cashCountingStep >= 2 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'
                  }`}>Enter VMF Number</h4>
                  <p className={`text-xs mt-1 ${
                    cashCountingStep >= 2 ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'
                  }`}>
                    {vmfNumber ? `VMF: ${vmfNumber}` : 'Input the VMF form number'}
                  </p>
                  {cashCountingStep === 2 && (
                    <Button 
                      onClick={() => setShowVMFModal(true)}
                      className="mt-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <i className="fas fa-hashtag mr-2"></i>Enter VMF Number
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 3: Take VMF Photo */}
              <div className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  cashCountingStep > 3 ? 'bg-success' : cashCountingStep === 3 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {cashCountingStep > 3 ? (
                    <i className="fas fa-check text-white text-sm"></i>
                  ) : (
                    <span className="text-white text-sm font-bold">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium text-sm ${
                    cashCountingStep >= 3 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'
                  }`}>Take VMF Photo</h4>
                  <p className={`text-xs mt-1 ${
                    cashCountingStep >= 3 ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'
                  }`}>
                    {cashCountingStep > 3 ? 'VMF photo captured successfully' : 'Use phone camera to capture VMF form'}
                  </p>
                  {cashCountingStep === 3 && (
                    <Button 
                      onClick={() => setShowUploadModal(true)}
                      className="mt-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <i className="fas fa-camera mr-2"></i>Take Photo
                    </Button>
                  )}
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
            ) : pendingTransactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-bell text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No pending requests</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Payment requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(pendingTransactions as any[]).map((transaction: any) => (
                  <div key={transaction.id} className="border border-warning bg-warning bg-opacity-5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200">Payment Request</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {transaction.description || 'Cash Digitization'}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                          ID: {transaction.transactionId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-gray-800 dark:text-gray-200">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <Badge className="status-pending">Pending Approval</Badge>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <Button 
                        onClick={() => handleApproveTransaction(transaction)}
                        disabled={approveTransaction.isPending || rejectTransaction.isPending}
                        className="flex-1 bg-success hover:bg-success/90 text-white py-2 rounded-lg font-medium"
                      >
                        <i className="fas fa-check mr-2"></i>
                        {approveTransaction.isPending ? "Verifying..." : "Approve Transfer"}
                      </Button>
                      <Button 
                        onClick={() => rejectTransaction.mutate({
                          transactionId: transaction.id,
                          reason: "manual rejection"
                        })}
                        disabled={rejectTransaction.isPending || approveTransaction.isPending}
                        className="flex-1 bg-destructive hover:bg-destructive/90 text-white py-2 rounded-lg font-medium"
                      >
                        <i className="fas fa-times mr-2"></i>
                        {rejectTransaction.isPending ? "Rejecting..." : "Reject"}
                      </Button>
                    </div>
                  </div>
                ))}
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

      {/* Amount Entry Modal */}
      <Dialog open={showAmountModal} onOpenChange={setShowAmountModal}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-center">Enter Cash Amount</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Cash Amount (ZMW)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="text-lg text-center font-bold"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the physical cash amount you counted</p>
            </div>
            
            <div className="flex space-x-3">
              <Button 
                onClick={() => setShowAmountModal(false)} 
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (!cashAmount || parseFloat(cashAmount) <= 0) {
                    toast({
                      title: "Invalid Amount",
                      description: "Please enter a valid cash amount",
                      variant: "destructive",
                    });
                    return;
                  }

                  // Immediate validation against active transaction
                  if (activeTransaction) {
                    const cashierAmountNum = parseFloat(cashAmount);
                    const originalAmountNum = parseFloat(activeTransaction.amount);
                    
                    if (Math.abs(cashierAmountNum - originalAmountNum) > 0.01) {
                      // Immediate transaction failure due to amount mismatch
                      showFailureNotification();
                      rejectTransaction.mutate({
                        transactionId: activeTransaction.id,
                        reason: "mismatched amount"
                      });
                      setShowAmountModal(false);
                      setCashCountingStep(1);
                      setCashAmount("");
                      return;
                    }
                  }

                  // If validation passes, proceed to next step
                  setCashCountingStep(2);
                  setActiveSession(prev => ({ ...prev, amount: cashAmount }));
                  setShowAmountModal(false);
                  toast({
                    title: "Amount Verified",
                    description: `Cash amount of ZMW ${parseFloat(cashAmount).toLocaleString()} matches merchant request`,
                  });
                }}
                disabled={!cashAmount || parseFloat(cashAmount) <= 0}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                <i className="fas fa-check mr-2"></i>
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* VMF Number Modal */}
      <Dialog open={showVMFModal} onOpenChange={setShowVMFModal}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-center">Enter VMF Number</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="vmf">VMF Form Number</Label>
              <Input
                id="vmf"
                type="text"
                placeholder="VMF-XXXXXX"
                value={vmfNumber}
                onChange={(e) => setVmfNumber(e.target.value.toUpperCase())}
                className="text-lg text-center font-bold"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the VMF form number exactly as printed</p>
            </div>
            
            <div className="flex space-x-3">
              <Button 
                onClick={() => setShowVMFModal(false)} 
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (!vmfNumber || vmfNumber.length < 3) {
                    toast({
                      title: "Invalid VMF Number",
                      description: "Please enter a valid VMF number",
                      variant: "destructive",
                    });
                    return;
                  }

                  // Immediate validation against active transaction
                  if (activeTransaction) {
                    if (vmfNumber.toUpperCase() !== (activeTransaction.vmfNumber || "").toUpperCase()) {
                      // Immediate transaction failure due to VMF mismatch
                      showFailureNotification();
                      rejectTransaction.mutate({
                        transactionId: activeTransaction.id,
                        reason: "mismatched vmf number"
                      });
                      setShowVMFModal(false);
                      setCashCountingStep(1);
                      setCashAmount("");
                      setVmfNumber("");
                      return;
                    }
                  }

                  // If validation passes, proceed to next step
                  setCashCountingStep(3);
                  setShowVMFModal(false);
                  toast({
                    title: "VMF Number Verified",
                    description: `VMF number ${vmfNumber} matches merchant request`,
                  });
                }}
                disabled={!vmfNumber || vmfNumber.length < 3}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                <i className="fas fa-check mr-2"></i>
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          if (cashCountingStep === 3) {
            setCashCountingStep(4);
            toast({
              title: "VMF Photo Captured",
              description: "Cash counting process completed successfully",
            });
          }
        }}
      />
    </div>
  );
}
