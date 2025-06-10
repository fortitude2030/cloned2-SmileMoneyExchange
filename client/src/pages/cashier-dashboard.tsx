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
import QRScannerComponent from "@/components/qr-scanner";
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

  // Utility functions for formatting
  const formatCurrency = (amount: string) => {
    const num = Math.round(parseFloat(amount));
    return `ZMW ${num.toLocaleString()}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return {
        date: "Today",
        time: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      };
    } else if (diffHours < 48) {
      return {
        date: "Yesterday",
        time: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      };
    } else {
      return {
        date: date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        }),
        time: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      };
    }
  };

  const getStatusBadge = (status: string, rejectionReason?: string) => {
    const statusColors = {
      completed: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      pending: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
      rejected: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
    };
    
    const displayText = status === 'rejected' && rejectionReason 
      ? rejectionReason 
      : status.charAt(0).toUpperCase() + status.slice(1);
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'}`}>
        {displayText}
      </span>
    );
  };
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
  const [lastInteractionTime, setLastInteractionTime] = useState<number>(0); // Track last interaction timestamp
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  // QR processing states
  const [qrProcessingStep, setQrProcessingStep] = useState(1);
  const [qrAmount, setQrAmount] = useState("");
  const [qrVmfNumber, setQrVmfNumber] = useState("");
  const [activeQrTransaction, setActiveQrTransaction] = useState<any>(null);

  // Timer effect for request cooldown with 30-second inactivity rule
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (requestCooldown > 0) {
      interval = setInterval(() => {
        setRequestCooldown(prev => {
          if (prev <= 1) {
            return 0; // Stop timer
          }
          
          // Check for 30-second inactivity rule
          const now = Date.now();
          const timeSinceLastInteraction = now - lastInteractionTime;
          const secondsSinceInteraction = Math.floor(timeSinceLastInteraction / 1000);
          
          // If 30 seconds have passed since last interaction, cancel transaction
          if (secondsSinceInteraction >= 30 && lastInteractionTime > 0) {
            return 0; // This will trigger the timeout handler
          }
          
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [requestCooldown, lastInteractionTime]);



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

  // Fetch pending transactions (only RTP)
  const { data: pendingTransactions = [], isLoading: transactionsLoading } = useQuery<Array<{
    id: number;
    transactionId: string;
    amount: string;
    status: string;
    vmfNumber?: string;
    createdAt: string;
    description?: string;
    type?: string;
  }>>({
    queryKey: ["/api/transactions/pending"],
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 1000, // Poll every second for real-time updates
    refetchIntervalInBackground: true,
  });

  // Fetch QR transactions separately for direct processing
  const { data: qrTransactions = [], isLoading: qrTransactionsLoading } = useQuery<Array<{
    id: number;
    transactionId: string;
    amount: string;
    status: string;
    vmfNumber?: string;
    createdAt: string;
    description?: string;
    type: string;
  }>>({
    queryKey: ["/api/transactions/qr-verification"],
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 1000, // Poll every second for real-time updates
    refetchIntervalInBackground: true,
  });



  // Fetch all transactions for Recent Transactions section
  const { data: transactions = [], isLoading: allTransactionsLoading } = useQuery<Array<{
    id: number;
    transactionId: string;
    amount: string;
    status: string;
    vmfNumber?: string;
    createdAt: string;
    description?: string;
    rejectionReason?: string;
  }>>({
    queryKey: ["/api/transactions"],
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 1000, // Poll every second for real-time updates
    refetchIntervalInBackground: true,
  });

  // Get the active transaction for validation
  // Filter out QR code transactions from pending queue - they should not show in pending requests
  const rtpTransactions = pendingTransactions.filter(t => t.type !== 'qr_code_payment');
  const activeTransaction = rtpTransactions.length > 0 ? rtpTransactions[0] : null;

  // Set the first QR transaction as active when available (only new pending ones)
  useEffect(() => {
    const pendingQrTransactions = qrTransactions.filter(t => t.status === 'pending');
    if (pendingQrTransactions.length > 0 && !activeQrTransaction) {
      setActiveQrTransaction(pendingQrTransactions[0]);
      setQrProcessingStep(1);
      setQrAmount("");
      setQrVmfNumber("");
    } else if (pendingQrTransactions.length === 0) {
      setActiveQrTransaction(null);
      setQrProcessingStep(1);
      setQrAmount("");
      setQrVmfNumber("");
    }
  }, [qrTransactions, activeQrTransaction]);

  // Monitor for new payment requests and start 120-second timer
  useEffect(() => {
    if (activeTransaction) {
      const transactionId = activeTransaction.transactionId;
      
      // Start 120-second timer for new transactions
      if (!processedTransactionIds.has(transactionId) && requestCooldown === 0) {
        setRequestCooldown(120);
        setLastInteractionTime(Date.now()); // Set initial interaction time
        setProcessedTransactionIds(prev => new Set(prev).add(transactionId));
      }
    } else if (!activeTransaction && requestCooldown > 0) {
      setRequestCooldown(0);
      setLastInteractionTime(0);
    }
  }, [activeTransaction, requestCooldown, processedTransactionIds]);

  // Track user interactions when cashier takes action (enters amount for RTP)
  useEffect(() => {
    if (cashAmount && cashCountingStep >= 2) {
      // Cashier has taken action, update interaction timestamp
      setLastInteractionTime(Date.now());
    }
  }, [cashAmount, cashCountingStep]);

  // Track user interactions when cashier takes action on QR transactions
  useEffect(() => {
    if (qrAmount && qrProcessingStep >= 2) {
      // Cashier has entered QR amount, update interaction timestamp
      setLastInteractionTime(Date.now());
    }
  }, [qrAmount, qrProcessingStep]);

  // Handle timer expiration to automatically reject transactions
  useEffect(() => {
    const checkTimerExpiry = async () => {
      if (requestCooldown === 0 && activeTransaction) {
        try {
          // Determine reason for timeout
          const now = Date.now();
          const timeSinceLastInteraction = now - lastInteractionTime;
          const secondsSinceInteraction = Math.floor(timeSinceLastInteraction / 1000);
          
          const rejectionReason = secondsSinceInteraction >= 30 && lastInteractionTime > 0 
            ? "inactivity timeout" 
            : "timed out";
          
          await apiRequest("PATCH", `/api/transactions/${activeTransaction.id}/status`, {
            status: "rejected",
            rejectionReason: rejectionReason
          });
          
          // Remove timed out transaction from processed set
          setProcessedTransactionIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(activeTransaction.transactionId);
            return newSet;
          });
          
          // Reset interaction tracking
          setLastInteractionTime(0);
          
          queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        } catch (error) {
          console.error("Failed to reject timed out transaction:", error);
        }
      }
    };

    // Add a small delay to prevent immediate execution
    const timer = setTimeout(checkTimerExpiry, 100);
    return () => clearTimeout(timer);
  }, [requestCooldown, activeTransaction, lastInteractionTime]);

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
    // Track user interaction
    setLastInteractionTime(Date.now());
    
    // Check if this is a QR code transaction
    if (transaction.type === 'qr_code_payment') {
      // For QR code transactions, open the QR scanner directly
      setCurrentTransaction(transaction);
      setShowQRScanner(true);
      return;
    }

    // For cash digitization transactions, check if cashier has completed the 3-step process
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
        {/* Test Timer Buttons (temporary) */}
        {requestCooldown === 0 && (
          <div className="flex justify-center gap-2 mb-4">
            <Button 
              onClick={() => {
                setRequestCooldown(120);
                setLastInteractionTime(Date.now());
              }}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
            >
              Start 120s Timer
            </Button>
          </div>
        )}

        {requestCooldown > 0 && (
          <div className="flex justify-center gap-2 mb-2">
            <Button 
              onClick={() => {
                setLastInteractionTime(Date.now());
              }}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
            >
              Reset 30s Inactivity
            </Button>
            <Button 
              onClick={() => {
                setRequestCooldown(0);
                setLastInteractionTime(0);
              }}
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1"
            >
              Stop Timer
            </Button>
          </div>
        )}

        {/* Request Cooldown Timer */}
        {requestCooldown > 0 && (
          <div className="flex justify-center mb-4">
            <div className={`
              w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-1000 ease-in-out
              ${requestCooldown > 100 ? 'bg-green-500' : 
                requestCooldown > 60 ? 'bg-amber-500' : 
                requestCooldown > 20 ? 'bg-green-500' : 
                requestCooldown > 10 ? 'bg-amber-500' : 'bg-red-500'}
            `}>
              <div className="text-2xl font-bold text-white">
                {requestCooldown.toString().padStart(2, '0')}
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

        {/* Cash Counting Workflow - Only show when there are pending transactions */}
        {activeTransaction && (
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <CardContent className="p-4">
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
                  {cashAmount && (
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                      ZMW {Math.round(parseFloat(cashAmount)).toLocaleString()}
                    </p>
                  )}
                  {cashCountingStep === 1 && (
                    <Button 
                      onClick={() => {
                        setLastInteractionTime(Date.now());
                        setShowAmountModal(true);
                      }}
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
                  {vmfNumber && (
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                      VMF: {vmfNumber}
                    </p>
                  )}
                  {cashCountingStep === 2 && (
                    <Button 
                      onClick={() => {
                        setLastInteractionTime(Date.now());
                        setShowVMFModal(true);
                      }}
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
                  {cashCountingStep > 3 && (
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                      VMF photo captured successfully
                    </p>
                  )}
                  {cashCountingStep === 3 && (
                    <Button 
                      onClick={() => {
                        setLastInteractionTime(Date.now());
                        setShowUploadModal(true);
                      }}
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
        )}



        {/* QR Code Processing - Direct 3-step flow for QR transactions */}
        {activeQrTransaction && (
          <Card className="shadow-sm border border-blue-200 dark:border-blue-700">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Step 1: Enter Amount */}
                <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    qrProcessingStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600'
                  }`}>
                    1
                  </div>
                  <div className="flex-1">
                    {qrProcessingStep > 1 && (
                      <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                        Amount entered: {formatCurrency(qrAmount)}
                      </p>
                    )}
                    {qrProcessingStep <= 1 && (
                      <Button 
                        onClick={qrProcessingStep === 1 ? () => {
                          setLastInteractionTime(Date.now());
                          setShowAmountModal(true);
                        } : undefined}
                        disabled={qrProcessingStep < 1}
                        className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium ${
                          qrProcessingStep === 1 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Enter Amount
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step 2: Enter VMF Number */}
                <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    qrProcessingStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600'
                  }`}>
                    2
                  </div>
                  <div className="flex-1">
                    {qrProcessingStep > 2 && (
                      <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                        VMF entered: {qrVmfNumber}
                      </p>
                    )}
                    {qrProcessingStep <= 2 && (
                      <Button 
                        onClick={qrProcessingStep === 2 ? () => {
                          setLastInteractionTime(Date.now());
                          setShowVMFModal(true);
                        } : undefined}
                        disabled={qrProcessingStep < 2}
                        className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium ${
                          qrProcessingStep === 2 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Enter VMF
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step 3: Take Photo & Launch QR Scanner */}
                <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    qrProcessingStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600'
                  }`}>
                    3
                  </div>
                  <div className="flex-1">
                    {qrProcessingStep > 3 && (
                      <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                        Photo captured - Ready for QR scan
                      </p>
                    )}
                    {qrProcessingStep <= 3 && (
                      <Button 
                        onClick={qrProcessingStep === 3 ? () => {
                          setLastInteractionTime(Date.now());
                          setShowUploadModal(true);
                        } : undefined}
                        disabled={qrProcessingStep < 3}
                        className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium ${
                          qrProcessingStep === 3 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Take Photo
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* RTP Pending Payment Requests - Remove this card since we auto-approve RTP transactions */}
        {false && activeTransaction && (
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
                      {transaction.type === 'qr_code_payment' ? (
                        // QR Code transactions: Direct scanner button
                        <>
                          <Button 
                            onClick={() => {
                              setCurrentTransaction(transaction);
                              setShowQRScanner(true);
                            }}
                            disabled={approveTransaction.isPending || rejectTransaction.isPending}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium"
                          >
                            <i className="fas fa-qrcode mr-2"></i>
                            Scan QR Code
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
                        </>
                      ) : (
                        // Cash digitization transactions: Original approve/reject flow
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Recent Transactions</h3>
              <Button 
                variant="ghost" 
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                onClick={() => setShowAllTransactions(!showAllTransactions)}
              >
                {showAllTransactions ? 'Show Last 5' : 'Show Last 30'}
              </Button>
            </div>
            
            {allTransactionsLoading ? (
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
            ) : !Array.isArray(transactions) || transactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-history text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No transactions yet</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Your transactions will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(showAllTransactions ? (Array.isArray(transactions) ? transactions.slice(0, 30) : []) : (Array.isArray(transactions) ? transactions.slice(0, 5) : [])).map((transaction: any) => {
                  const dateTime = formatDateTime(transaction.createdAt);
                  return (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <div>
                          <p className={`font-medium text-sm ${
                            transaction.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                            transaction.status === 'pending' ? 'text-orange-600 dark:text-orange-400' :
                            transaction.status === 'rejected' ? 'text-red-600 dark:text-red-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {transaction.toUser?.name || transaction.fromUser?.name || 'Unknown Merchant'}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">
                            {dateTime.date} at {dateTime.time}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            Ref: {transaction.transactionId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-sm ${
                          transaction.status === 'completed' ? 'text-green-600' :
                          transaction.status === 'pending' ? 'text-orange-600' :
                          transaction.status === 'rejected' ? 'text-red-600' :
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {formatCurrency(transaction.amount)}
                        </p>
                        {getStatusBadge(transaction.status, transaction.rejectionReason)}
                      </div>
                    </div>
                  );
                })}
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
                placeholder="0"
                value={cashAmount}
                onChange={(e) => {
                  // Track user interaction when typing
                  setLastInteractionTime(Date.now());
                  // Round any input to whole numbers only
                  const rounded = Math.round(parseFloat(e.target.value) || 0);
                  setCashAmount(rounded > 0 ? rounded.toString() : "");
                }}
                className="text-lg text-center font-bold"
              />

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

                  // Validation for both RTP and QR transactions
                  const targetTransaction = activeTransaction || activeQrTransaction;
                  if (targetTransaction) {
                    const cashierAmountNum = parseFloat(cashAmount);
                    const originalAmountNum = parseFloat(targetTransaction.amount);
                    
                    if (Math.abs(cashierAmountNum - originalAmountNum) > 0.01) {
                      // Immediate transaction failure due to amount mismatch
                      showFailureNotification();
                      
                      if (activeTransaction) {
                        rejectTransaction.mutate({
                          transactionId: activeTransaction.id,
                          reason: "mismatched amount"
                        }, {
                          onSuccess: () => {
                            // Invalidate queries to refresh transaction lists
                            queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/transactions/pending'] });
                            // Reset all RTP transaction states
                            setCashCountingStep(1);
                            setActiveSession({
                              merchant: "Tech Store Plus",
                              location: "Westlands Branch, Nairobi",
                              amount: "0"
                            });
                          }
                        });
                      } else if (activeQrTransaction) {
                        rejectTransaction.mutate({
                          transactionId: activeQrTransaction.id,
                          reason: "mismatched amount"
                        }, {
                          onSuccess: () => {
                            // Invalidate queries to refresh transaction lists
                            queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/transactions/qr-verification'] });
                            // Reset all QR transaction states
                            setQrProcessingStep(1);
                            setQrAmount("");
                            setQrVmfNumber("");
                            setActiveQrTransaction(null);
                          }
                        });
                      }
                      
                      // Clear modal and amount
                      setShowAmountModal(false);
                      setCashAmount("");
                      
                      toast({
                        title: "Amount Mismatch",
                        description: `Expected ${formatCurrency(targetTransaction.amount)}, got ${formatCurrency(cashAmount)}. Transaction rejected.`,
                        variant: "destructive",
                      });
                      
                      return;
                    }
                  }

                  // Track user interaction
                  setLastInteractionTime(Date.now());
                  
                  // If validation passes, proceed to next step
                  if (activeQrTransaction) {
                    setQrAmount(cashAmount);
                    setQrProcessingStep(2);
                  } else {
                    setCashCountingStep(2);
                  }
                  
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
                onChange={(e) => {
                  // Track user interaction when typing
                  setLastInteractionTime(Date.now());
                  setVmfNumber(e.target.value.toUpperCase());
                }}
                className="text-lg text-center font-bold"
              />

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

                  // Validation for both RTP and QR transactions
                  const targetTransaction = activeTransaction || activeQrTransaction;
                  if (targetTransaction) {
                    if (vmfNumber.toUpperCase() !== (targetTransaction.vmfNumber || "").toUpperCase()) {
                      // Immediate transaction failure due to VMF mismatch
                      showFailureNotification();
                      rejectTransaction.mutate({
                        transactionId: targetTransaction.id,
                        reason: "mismatched vmf number"
                      });
                      setShowVMFModal(false);
                      if (activeTransaction) {
                        // Don't reset step, just clear form data
                        setCashAmount("");
                      } else if (activeQrTransaction) {
                        // Don't reset step, just clear form data
                        setQrAmount("");
                        setQrVmfNumber("");
                      }
                      setVmfNumber("");
                      return;
                    }
                  }

                  // If validation passes, proceed to next step
                  if (activeQrTransaction) {
                    setQrVmfNumber(vmfNumber);
                    setQrProcessingStep(3);
                  } else {
                    setCashCountingStep(3);
                  }
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

      {/* QR Scanner Modal for QR Code Transactions */}
      <QRScannerComponent
        isOpen={showQRScanner}
        onClose={() => {
          setShowQRScanner(false);
          setCurrentTransaction(null);
        }}
        onScanSuccess={(qrData) => {
          // Process the scanned QR code data
          if (currentTransaction && qrData) {
            // Validate the QR data matches the current transaction
            const expectedAmount = parseFloat(currentTransaction.amount);
            const scannedAmount = qrData.amount;
            
            if (Math.abs(expectedAmount - scannedAmount) < 0.01) {
              // Amounts match, approve the transaction
              approveTransaction.mutate({
                transactionId: currentTransaction.id,
                cashierAmount: currentTransaction.amount,
                cashierVmfNumber: currentTransaction.vmfNumber || "",
                originalAmount: currentTransaction.amount,
                originalVmfNumber: currentTransaction.vmfNumber || ""
              });
              
              toast({
                title: "QR Code Verified",
                description: `Payment of ${formatCurrency(currentTransaction.amount)} confirmed`,
              });
            } else {
              toast({
                title: "Amount Mismatch",
                description: `Expected ${formatCurrency(currentTransaction.amount)}, got ZMW ${scannedAmount.toLocaleString()}`,
                variant: "destructive",
              });
            }
          }
          setShowQRScanner(false);
          setCurrentTransaction(null);
        }}
        expectedAmount={currentTransaction?.amount}
      />

      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          
          // Handle QR processing workflow
          if (activeQrTransaction && qrProcessingStep === 3) {
            setQrProcessingStep(4);
            toast({
              title: "VMF Photo Captured",
              description: "Ready to scan QR code",
            });
            // Launch QR scanner for QR code transactions
            setTimeout(() => {
              setShowQRScanner(true);
              setCurrentTransaction(activeQrTransaction);
            }, 500);
          }
          // Handle cash counting workflow  
          else if (cashCountingStep === 3) {
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
