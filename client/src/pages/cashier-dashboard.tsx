import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTransactionNotifications } from "@/hooks/use-transaction-notifications";
import { useTimer } from "@/contexts/timer-context";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import SimpleDocumentUpload from "@/components/simple-document-upload";
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
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return 'ZMW 0';
    // Use Math.floor to truncate decimals without rounding
    const truncatedAmount = Math.floor(numericAmount);
    return `ZMW ${truncatedAmount.toLocaleString()}`;
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
  const [processedTransactionIds, setProcessedTransactionIds] = useState<Set<string>>(new Set());
  const [timedOutTransactionIds, setTimedOutTransactionIds] = useState<Set<string>>(new Set());
  
  // Use global timer system
  const { timeLeft, isActive, hasInteraction, startTimer, markInteraction, stopTimer, setTimeoutCallback } = useTimer();
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  // QR processing states
  const [qrProcessingStep, setQrProcessingStep] = useState(1);
  const [qrAmount, setQrAmount] = useState("");
  const [qrVmfNumber, setQrVmfNumber] = useState("");
  const [activeQrTransaction, setActiveQrTransaction] = useState<any>(null);





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

  // Fetch pending transactions (only RTP) - high frequency polling for immediate updates
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
    refetchInterval: 2000, // Poll every 2 seconds for immediate new requests
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch QR transactions separately for direct processing - high frequency polling
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
    refetchInterval: 2000, // Poll every 2 seconds for immediate QR updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch all transactions for Recent Transactions section - faster polling for real-time updates
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
    refetchInterval: 3000, // Poll every 3 seconds for faster updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch wallet data for real-time balance tracking
  const { data: wallet, isLoading: walletLoading } = useQuery<{
    id: number;
    balance: string;
    dailyLimit: string;
    dailyCollected: string;
    dailyTransferred: string;
    isActive: boolean;
  }>({
    queryKey: ["/api/wallet"],
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 1000, // Poll every 1 second for real-time balance updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Data is immediately stale
  });

  // Clean up state for completed transactions to prevent UI confusion
  useEffect(() => {
    if (transactions.length > 0) {
      // Remove completed/rejected transactions from processing sets to prevent conflicts
      const completedTransactionIds = transactions
        .filter((t: any) => t.status === 'completed' || t.status === 'rejected')
        .map((t: any) => t.transactionId);
      
      if (completedTransactionIds.length > 0) {
        setProcessedTransactionIds(prev => {
          const newSet = new Set(prev);
          completedTransactionIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        
        setTimedOutTransactionIds(prev => {
          const newSet = new Set(prev);
          completedTransactionIds.forEach(id => {
            // Only remove from timeout set if transaction was actually completed successfully
            const transaction = transactions.find((t: any) => t.transactionId === id);
            if (transaction && transaction.status === 'completed') {
              newSet.delete(id);
            }
          });
          return newSet;
        });
      }
    }
  }, [transactions]);

  // Get the active transaction for validation
  // Filter out QR code transactions from pending queue - they should not show in pending requests
  const rtpTransactions = pendingTransactions.filter(t => t.type !== 'qr_code_payment');
  const activeTransaction = rtpTransactions.length > 0 ? rtpTransactions[0] : null;

  // Set the first QR transaction as active when available and auto-launch timer
  useEffect(() => {
    const pendingQrTransactions = qrTransactions.filter(t => t.status === 'pending');
    if (pendingQrTransactions.length > 0 && !activeQrTransaction) {
      const newQrTransaction = pendingQrTransactions[0];
      setActiveQrTransaction(newQrTransaction);
      setQrProcessingStep(1);
      setQrAmount("");
      setQrVmfNumber("");
      
      // Auto-launch timer for QR transactions like RTP transactions
      const transactionId = newQrTransaction.transactionId;
      const canStartTimer = !processedTransactionIds.has(transactionId) && 
                           !timedOutTransactionIds.has(transactionId) && 
                           !isActive && 
                           timeLeft === 0 &&
                           newQrTransaction.status === 'pending';
      
      if (canStartTimer) {
        console.log('Auto-launching QR transaction timer:', transactionId);
        
        // Set timeout callback for QR transaction cancellation
        setTimeoutCallback(async () => {
          console.log('QR Timer expired - auto-cancelling transaction:', transactionId);
          try {
            await apiRequest("PATCH", `/api/transactions/${newQrTransaction.id}/status`, {
              status: "rejected",
              rejectionReason: "timed out"
            });
            setTimedOutTransactionIds(prev => new Set(prev).add(transactionId));
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/transactions/qr-verification"] });
            toast({
              title: "QR Transaction Timed Out",
              description: `QR Transaction ${transactionId} was automatically cancelled due to inactivity.`,
              variant: "destructive",
            });
          } catch (error) {
            console.error("Failed to auto-cancel QR transaction:", error);
          }
        });
        
        startTimer();
        setProcessedTransactionIds(prev => new Set(prev).add(transactionId));
      }
    } else if (pendingQrTransactions.length === 0) {
      setActiveQrTransaction(null);
      setQrProcessingStep(1);
      setQrAmount("");
      setQrVmfNumber("");
    }
  }, [qrTransactions, activeQrTransaction, processedTransactionIds, timedOutTransactionIds, isActive, timeLeft, startTimer]);

  // Monitor for new payment requests and start timer
  useEffect(() => {
    if (activeTransaction) {
      const transactionId = activeTransaction.transactionId;
      
      // Only start timer for truly new transactions with strict conditions
      const canStartTimer = !processedTransactionIds.has(transactionId) && 
                           !timedOutTransactionIds.has(transactionId) && 
                           !isActive && 
                           timeLeft === 0 &&
                           activeTransaction.status === 'pending';
      
      if (canStartTimer) {
        console.log('Starting timer for transaction:', transactionId);
        
        // Reset all UI state for new transaction
        setCashCountingStep(1);
        setCashAmount("");
        setVmfNumber("");
        setShowAmountModal(false);
        setShowVMFModal(false);
        setShowUploadModal(false);
        
        // Set timeout callback for automatic cancellation
        setTimeoutCallback(async () => {
          console.log('Timer expired - auto-cancelling transaction:', transactionId);
          try {
            await apiRequest("PATCH", `/api/transactions/${activeTransaction.id}/status`, {
              status: "rejected",
              rejectionReason: "timed out"
            });
            setTimedOutTransactionIds(prev => new Set(prev).add(transactionId));
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
            toast({
              title: "Transaction Timed Out",
              description: `Transaction ${transactionId} was automatically cancelled due to inactivity.`,
              variant: "destructive",
            });
          } catch (error) {
            console.error("Failed to auto-cancel transaction:", error);
          }
        });
        
        startTimer();
        setProcessedTransactionIds(prev => new Set(prev).add(transactionId));
      }
    } else if (!activeTransaction && isActive) {
      stopTimer();
      // Reset UI state when no active transaction
      setCashCountingStep(1);
      setCashAmount("");
      setVmfNumber("");
    }
  }, [activeTransaction, isActive, timeLeft, processedTransactionIds, timedOutTransactionIds, startTimer, stopTimer, setTimeoutCallback, toast]);

  // Mark interaction when cashier takes action (enters amount for RTP)
  useEffect(() => {
    if (cashAmount && cashCountingStep >= 2) {
      // Cashier has taken action, mark interaction so timer continues past 30 seconds
      markInteraction();
    }
  }, [cashAmount, cashCountingStep, markInteraction]);

  // Mark interaction when cashier takes action on QR transactions
  useEffect(() => {
    if (qrAmount && qrProcessingStep >= 2) {
      // Cashier has entered QR amount, mark interaction so timer continues
      markInteraction();
    }
  }, [qrAmount, qrProcessingStep, markInteraction]);

  // Handle timer expiration to automatically reject transactions
  useEffect(() => {
    const checkTimerExpiry = async () => {
      // Handle RTP transaction timeout
      if (!isActive && timeLeft === 0 && activeTransaction) {
        const transactionId = activeTransaction.transactionId;
        
        // Prevent multiple timeout attempts for the same transaction
        if (timedOutTransactionIds.has(transactionId) || processedTransactionIds.has(transactionId)) {
          return;
        }
        
        // Check if transaction was already completed or rejected in database
        try {
          const response = await fetch(`/api/transactions/${activeTransaction.id}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const transaction = await response.json();
            if (transaction.status === 'completed' || transaction.status === 'rejected') {
              // Transaction already completed/rejected, don't timeout
              return;
            }
          }
        } catch (error) {
          console.error("Failed to check transaction status:", error);
        }
        
        try {
          await apiRequest("PATCH", `/api/transactions/${activeTransaction.id}/status`, {
            status: "rejected",
            rejectionReason: "timed out"
          });
          
          // Mark transaction as timed out to prevent timer restarts
          setTimedOutTransactionIds(prev => new Set(prev).add(transactionId));
          
          // Reset UI state when transaction times out
          setCashCountingStep(1);
          setCashAmount("");
          setVmfNumber("");
          setShowAmountModal(false);
          setShowVMFModal(false);
          setShowUploadModal(false);
          
          queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
        } catch (error) {
          console.error("Failed to reject timed out transaction:", error);
        }
      }

      // Handle QR transaction timeout
      if (!isActive && timeLeft === 0 && activeQrTransaction) {
        const transactionId = activeQrTransaction.transactionId;
        
        // Prevent multiple timeout attempts for the same transaction
        if (timedOutTransactionIds.has(transactionId) || processedTransactionIds.has(transactionId)) {
          return;
        }
        
        // Check if transaction was already completed or rejected in database
        try {
          const response = await fetch(`/api/transactions/${activeQrTransaction.id}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const transaction = await response.json();
            if (transaction.status === 'completed' || transaction.status === 'rejected') {
              // Transaction already completed/rejected, don't timeout
              return;
            }
          }
        } catch (error) {
          console.error("Failed to check QR transaction status:", error);
        }
        
        try {
          await apiRequest("PATCH", `/api/transactions/${activeQrTransaction.id}/status`, {
            status: "rejected",
            rejectionReason: "timed out"
          });
          
          // Mark transaction as timed out to prevent timer restarts
          setTimedOutTransactionIds(prev => new Set(prev).add(transactionId));
          
          // Reset QR UI state when transaction times out
          setQrProcessingStep(1);
          setQrAmount("");
          setQrVmfNumber("");
          setShowQRScanner(false);
          setActiveQrTransaction(null);
          
          queryClient.invalidateQueries({ queryKey: ["/api/transactions/qr-verification"] });
        } catch (error) {
          console.error("Failed to reject timed out QR transaction:", error);
        }
      }
    };

    // Add a small delay to prevent immediate execution
    const timer = setTimeout(checkTimerExpiry, 100);
    return () => clearTimeout(timer);
  }, [isActive, timeLeft, activeTransaction, activeQrTransaction, timedOutTransactionIds, processedTransactionIds]);

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
      console.log('Transaction approved successfully - stopping timer');
      showSuccessNotification();
      
      // Stop timer immediately and mark transaction as processed
      stopTimer();
      
      // Mark transaction as completed to prevent timer restart
      if (activeTransaction) {
        setProcessedTransactionIds(prev => new Set(prev).add(activeTransaction.transactionId));
      }
      if (activeQrTransaction) {
        setProcessedTransactionIds(prev => new Set(prev).add(activeQrTransaction.transactionId));
      }
      
      // Reset UI state for completed transaction
      setCashCountingStep(1);
      setCashAmount("");
      setVmfNumber("");
      
      // Reset QR transaction state
      setQrProcessingStep(1);
      setQrAmount("");
      setQrVmfNumber("");
      setActiveQrTransaction(null);
      setShowQRScanner(false);
      
      // Remove completed transaction from processed set
      setProcessedTransactionIds(prev => {
        const newSet = new Set(prev);
        if (activeTransaction) {
          newSet.delete(activeTransaction.transactionId);
        }
        if (activeQrTransaction) {
          newSet.delete(activeQrTransaction.transactionId);
        }
        return newSet;
      });
      
      // Comprehensive query invalidation to refresh all transaction data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/qr-verification"] });
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
      console.log('Transaction rejected successfully - stopping timer');
      showFailureNotification();
      
      // Stop timer immediately
      stopTimer();
      
      // Mark transaction as completed to prevent timer restart
      if (activeTransaction) {
        setTimedOutTransactionIds(prev => new Set(prev).add(activeTransaction.transactionId));
      }
      if (activeQrTransaction) {
        setTimedOutTransactionIds(prev => new Set(prev).add(activeQrTransaction.transactionId));
      }
      
      // Remove rejected transaction from processed set
      setProcessedTransactionIds(prev => {
        const newSet = new Set(prev);
        if (activeTransaction) {
          newSet.delete(activeTransaction.transactionId);
        }
        if (activeQrTransaction) {
          newSet.delete(activeQrTransaction.transactionId);
        }
        return newSet;
      });
      
      // Reset the workflow for next transaction
      setCashCountingStep(1);
      setCashAmount("");
      setVmfNumber("");
      setActiveSession(prev => ({ ...prev, amount: "0" }));
      
      // Reset QR transaction state
      setQrProcessingStep(1);
      setQrAmount("");
      setQrVmfNumber("");
      setActiveQrTransaction(null);
      setShowQRScanner(false);
      
      // Comprehensive query invalidation to refresh all transaction data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/qr-verification"] });
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
    // Check if this is a QR code transaction
    if (transaction.type === 'qr_code_payment') {
      // For QR code transactions, open the QR scanner directly
      setCurrentTransaction(transaction);
      setShowQRScanner(true);
      // Mark interaction for QR processing
      markInteraction(); // Allow timer to continue for QR scanning
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

    // Mark interaction for processing
    markInteraction(); // Allow timer to continue for cash processing

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

        {/* Transaction Timer - Only shows when there's an active transaction */}
        {(activeTransaction || activeQrTransaction) && isActive && timeLeft > 0 && (
          <div className="flex justify-center mb-3">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-500 ease-in-out shadow-sm border-2 border-black
              ${timeLeft > 90 ? 'bg-green-500' : 
                timeLeft > 60 ? 'bg-yellow-500' : 
                timeLeft > 30 ? 'bg-orange-500' : 'bg-red-500'}
            `}>
              <div className="text-sm font-mono font-bold text-white">
                {timeLeft}
              </div>
            </div>
          </div>
        )}

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
                      ZMW {Math.floor(parseFloat(cashAmount)).toLocaleString()}
                    </p>
                  )}
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
                  {vmfNumber && (
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                      VMF: {vmfNumber}
                    </p>
                  )}
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
                  {cashCountingStep > 3 && (
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                      VMF photo captured successfully
                    </p>
                  )}
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
                        onClick={qrProcessingStep === 1 ? () => setShowAmountModal(true) : undefined}
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
                        onClick={qrProcessingStep === 2 ? () => setShowVMFModal(true) : undefined}
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
                        onClick={qrProcessingStep === 3 ? () => setShowUploadModal(true) : undefined}
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
                  // Keep original amount without rounding
                  const value = e.target.value;
                  setCashAmount(value);
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
                    const cashierAmountNum = Math.floor(parseFloat(cashAmount));
                    const originalAmountNum = Math.floor(parseFloat(targetTransaction.amount));
                    
                    if (cashierAmountNum !== originalAmountNum) {
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

                  // If validation passes, proceed to next step
                  if (activeQrTransaction) {
                    setQrAmount(cashAmount);
                    setQrProcessingStep(2);
                    // Mark interaction for QR processing workflow
                    console.log("Marking interaction for QR workflow");
                    markInteraction(); // Allow timer to continue for QR workflow
                  } else {
                    setCashCountingStep(2);
                    // Mark interaction for cash counting workflow
                    console.log("Marking interaction for cash workflow");
                    markInteraction(); // Allow timer to continue for cash workflow
                  }
                  setActiveSession(prev => ({ ...prev, amount: cashAmount }));
                  setShowAmountModal(false);
                  toast({
                    title: "Amount Verified",
                    description: `Cash amount of ZMW ${Math.floor(parseFloat(cashAmount)).toLocaleString()} matches merchant request`,
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
                        setCashCountingStep(1);
                        setCashAmount("");
                      } else if (activeQrTransaction) {
                        setQrProcessingStep(1);
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
          // Handle cancellation case
          if (qrData && qrData.cancelled) {
            if (currentTransaction) {
              rejectTransaction.mutate({
                transactionId: currentTransaction.id,
                reason: qrData.reason || "QR scan cancelled by user"
              });
            }
            setShowQRScanner(false);
            setCurrentTransaction(null);
            return;
          }
          
          // Process the scanned QR code data without amount validation
          if (currentTransaction && qrData) {
            // Immediately mark QR code as expired/used to prevent reuse
            setCurrentTransaction(null);
            setShowQRScanner(false);
            
            // Remove amount validation - cashier relies only on VMF verification
            approveTransaction.mutate({
              transactionId: currentTransaction.id,
              cashierAmount: currentTransaction.amount,
              cashierVmfNumber: currentTransaction.vmfNumber || "",
              originalAmount: currentTransaction.amount,
              originalVmfNumber: currentTransaction.vmfNumber || ""
            });
            
            toast({
              title: "QR Code Verified",
              description: `Payment verified - completing transaction`,
            });
            
            return;
          }
          
          setShowQRScanner(false);
          setCurrentTransaction(null);
        }}
        expectedAmount={currentTransaction?.amount}
      />

      <SimpleDocumentUpload
        isOpen={showUploadModal}
        transactionId={activeTransaction?.id || activeQrTransaction?.id}
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
