import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTransactionNotifications } from "@/hooks/use-transaction-notifications";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import QRCodeModal from "@/components/qr-code-modal";

import WalletLimitsDisplay from "@/components/wallet-limits-display";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletBalanceSkeleton, TransactionListSkeleton } from "@/components/ui/loading-skeletons";

export default function MerchantDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { showSuccessNotification, showFailureNotification } = useTransactionNotifications();
  const [showQRModal, setShowQRModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [vmfNumber, setVmfNumber] = useState("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [lastQrTransactionId, setLastQrTransactionId] = useState<string | null>(null);




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

  // Fetch wallet data with smart caching
  const { data: wallet, isLoading: walletLoading } = useQuery<{
    id: number;
    balance: string;
    dailyLimit: string;
    dailyCollected: string;
    dailyTransferred: string;
    isActive: boolean;
    todayCompleted?: string;
    todayTotal?: string;
  }>({
    queryKey: queryKeys.wallet.current(),
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 10000, // Reduced from 1s to 10s - balance updates are not critical for merchant view
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 8000, // Data is fresh for 8 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });

  // Fetch transactions with smart caching
  const { data: transactions = [], isLoading: transactionsLoading, refetch } = useQuery<Array<{
    id: number;
    transactionId: string;
    amount: string;
    status: string;
    vmfNumber?: string;
    createdAt: string;
    description?: string;
    rejectionReason?: string;
    type?: string;
  }>>({
    queryKey: queryKeys.transactions.all(),
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 15000, // Reduced from 2s to 15s - merchant transaction history doesn't need frequent updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 12000, // Data is fresh for 12 seconds
    gcTime: 120000, // Keep in cache for 2 minutes
  });

  // Monitor QR transactions for auto-closing modal
  useEffect(() => {
    if (!showQRModal || !transactions) return;

    // Find the most recent QR transaction for this user
    const recentQrTransaction = transactions
      .filter(t => t.type === "qr_code_payment")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (recentQrTransaction && (recentQrTransaction.status === "completed" || recentQrTransaction.status === "rejected")) {
      // QR transaction completed or rejected - close modal immediately
      setShowQRModal(false);
      setLastQrTransactionId(null);
      
      if (recentQrTransaction.status === "completed") {
        toast({
          title: "QR Payment Completed",
          description: `Payment of ZMW ${Math.round(parseFloat(recentQrTransaction.amount)).toLocaleString()} has been processed successfully`,
        });
      } else if (recentQrTransaction.status === "rejected") {
        toast({
          title: "QR Payment Rejected",
          description: recentQrTransaction.rejectionReason || "QR payment was rejected by the cashier",
          variant: "destructive",
        });
      }
    }
  }, [transactions, showQRModal, toast]);

  // Create payment request mutation
  const createPaymentRequest = useMutation({
    mutationFn: async ({ amount, vmfNumber, type = "cash_digitization" }: { amount: string; vmfNumber: string; type?: string }) => {
      // For QR code payments, we need to route to a cashier
      let targetUserId = (user as any)?.id || "";
      
      if (type === "qr_code_payment") {
        // QR payments should go to the cashier for processing
        targetUserId = "test-cashier-user"; // Route QR payments to cashier
      }
      
      await apiRequest("POST", "/api/transactions", {
        toUserId: targetUserId,
        amount,
        vmfNumber,
        type,
        status: "pending",
        description: type === "qr_code_payment" 
          ? `QR code payment request - VMF: ${vmfNumber}`
          : `Cash digitization request - VMF: ${vmfNumber}`,
      });
    },
    onSuccess: (data: any, variables) => {
      // For QR code payments, track the transaction ID for auto-closing
      if (variables.type === "qr_code_payment" && data && typeof data === 'object' && 'transactionId' in data) {
        setLastQrTransactionId(data.transactionId);
      }
      
      // Clear form and show success toast
      setPaymentAmount("");
      setVmfNumber("");
      toast({
        title: "Request Sent",
        description: "Your payment request has been sent to the security cashier",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
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
      
      // Handle pending transaction restriction
      if (error?.response?.data?.code === 'PENDING_TRANSACTION_EXISTS') {
        toast({
          title: "Transaction Already Pending",
          description: "You already have a pending transaction. Please wait for it to be completed before creating a new one.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to create payment request",
        variant: "destructive",
      });
    },
  });



  const handleRequestPayment = () => {
    if (!vmfNumber.trim()) {
      toast({
        title: "VMF Required",
        description: "Please enter a valid VMF number",
        variant: "destructive",
      });
      return;
    }

    const amount = Math.floor(parseFloat(paymentAmount));
    const dailyCollected = Math.floor(parseFloat(wallet?.dailyCollected || "0"));
    const dailyLimit = 1000000; // K1,000,000 collection limit
    const remainingLimit = dailyLimit - dailyCollected;

    if (amount > remainingLimit) {
      toast({
        title: "Daily Limit Exceeded",
        description: `Transaction amount (ZMW ${Math.floor(amount).toLocaleString()}) exceeds your available daily limit. Available: ZMW ${Math.floor(remainingLimit).toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    createPaymentRequest.mutate({ amount: paymentAmount, vmfNumber });
  };

  const formatCurrency = (amount: string | number) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 'ZMW 0';
    // Use Math.floor to truncate decimals without rounding
    const truncatedAmount = Math.floor(numericAmount);
    return `ZMW ${truncatedAmount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string, rejectionReason?: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600 text-white font-medium">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-orange-600 text-white font-medium">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-600 text-white font-medium">Approved</Badge>;
      case 'rejected':
        return (
          <div className="text-right">
            <Badge className="bg-red-600 text-white font-medium mb-1">Rejected</Badge>
            {rejectionReason && (
              <p className="text-xs text-red-600 dark:text-red-400">{rejectionReason}</p>
            )}
          </div>
        );
      default:
        return <Badge className="bg-gray-600 text-white font-medium">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <i className="fas fa-store text-white text-2xl"></i>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileHeader
        title="Merchant Portal"
        subtitle={(user as any)?.firstName || "Merchant"}
        icon="fas fa-store"
        color="primary"
      />

      <div className="p-4">
        {/* Transfer Limits - Shows Wallet Balance */}
        {walletLoading ? (
          <WalletBalanceSkeleton />
        ) : wallet ? (
          <WalletLimitsDisplay wallet={{
            balance: wallet.balance,
            dailyLimit: wallet.dailyLimit,
            dailyCollected: wallet.dailyCollected || '0',
            dailyTransferred: wallet.dailyTransferred || '0',
            isActive: wallet.isActive,
            todayCompleted: wallet.todayCompleted,
            todayTotal: wallet.todayTotal
          }} userRole="merchant" />
        ) : null}

        {/* Payment Request Form */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Request Payment</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (ZMW)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => {
                    // Round any input to whole numbers only
                    const rounded = Math.round(parseFloat(e.target.value) || 0);
                    setPaymentAmount(rounded > 0 ? rounded.toString() : "");
                  }}
                  placeholder="Enter amount (whole numbers only)"
                />
              </div>
              <div>
                <Label htmlFor="vmf">VMF Number *</Label>
                <Input
                  id="vmf"
                  type="text"
                  value={vmfNumber}
                  onChange={(e) => setVmfNumber(e.target.value)}
                  placeholder="Enter Voucher Movement Form number"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6 mt-6">
          <Button
            onClick={() => {
              if (!paymentAmount || !vmfNumber.trim()) {
                toast({
                  title: "Missing Information",
                  description: "Please enter both amount and VMF number before generating QR code",
                  variant: "destructive",
                });
                return;
              }
              
              const amount = Math.floor(parseFloat(paymentAmount));
              const dailyCollected = Math.round(parseFloat(wallet?.dailyCollected || "0"));
              const dailyLimit = 1000000;
              const remainingLimit = dailyLimit - dailyCollected;

              if (amount > remainingLimit) {
                toast({
                  title: "Daily Limit Exceeded",
                  description: `Amount (ZMW ${amount.toLocaleString()}) exceeds available daily limit. Available: ZMW ${remainingLimit.toLocaleString()}`,
                  variant: "destructive",
                });
                return;
              }

              // Show QR modal directly with the entered data
              setShowQRModal(true);
            }}
            disabled={createPaymentRequest.isPending}
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow h-auto"
            variant="ghost"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-qrcode text-primary text-xl"></i>
              </div>
              <h3 className="font-semibold text-sm">Generate QR</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Payment Request</p>
            </div>
          </Button>
          
          <Button
            onClick={handleRequestPayment}
            disabled={createPaymentRequest.isPending}
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow h-auto disabled:opacity-50"
            variant="ghost"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-accent bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-paper-plane text-accent text-xl"></i>
              </div>
              <h3 className="font-semibold text-sm">Request to Pay</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Send Request</p>
            </div>
          </Button>
        </div>

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
            
            {transactionsLoading ? (
              <TransactionListSkeleton count={3} />
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
                            {transaction.description || 'Cash Digitization'}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">
                            {dateTime.date} at {dateTime.time}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            ID: {transaction.transactionId}
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
                          +{formatCurrency(transaction.amount)}
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
        role="merchant"
        tabs={[
          { id: "home", label: "Home", icon: "fas fa-home" },
          { id: "history", label: "History", icon: "fas fa-history" },
          { id: "profile", label: "Profile", icon: "fas fa-user" },
        ]}
      />

      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => {
          setShowQRModal(false);
          setLastQrTransactionId(null); // Clear tracking when modal closes
          // Create transaction request when QR modal closes
          if (paymentAmount && vmfNumber) {
            createPaymentRequest.mutate({ 
              amount: paymentAmount, 
              vmfNumber,
              type: "qr_code_payment"
            } as any);
          }
        }}
        amount={paymentAmount}
        vmfNumber={vmfNumber}
      />



    </div>
  );
}
