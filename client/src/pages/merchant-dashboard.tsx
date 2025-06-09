import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import QRCodeModal from "@/components/qr-code-modal";
import RequestCooldownModal from "@/components/request-cooldown-modal";
import WalletLimitsDisplay from "@/components/wallet-limits-display";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MerchantDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { isConnected } = useWebSocket();
  const [showQRModal, setShowQRModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [vmfNumber, setVmfNumber] = useState("");
  const [vmfPhoto, setVmfPhoto] = useState<File | null>(null);
  const [vmfPhotoUrl, setVmfPhotoUrl] = useState<string>("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [requestCooldown, setRequestCooldown] = useState(0);
  const [isRequestDisabled, setIsRequestDisabled] = useState(false);
  const [showRequestCooldown, setShowRequestCooldown] = useState(false);

  // Timer effect for request cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (requestCooldown > 0) {
      interval = setInterval(() => {
        setRequestCooldown(prev => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            setIsRequestDisabled(false);
            setShowRequestCooldown(false);
          }
          return Math.max(0, newValue);
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

  // Fetch wallet data
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["/api/wallet"],
    retry: false,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
  });

  // Create payment request mutation
  const createPaymentRequest = useMutation({
    mutationFn: async ({ amount, vmfNumber }: { amount: string; vmfNumber: string }) => {
      await apiRequest("POST", "/api/transactions", {
        toUserId: user?.id,
        amount,
        vmfNumber,
        type: "cash_digitization",
        status: "pending",
        description: `Cash digitization request - VMF: ${vmfNumber}`,
      });
    },
    onSuccess: () => {
      // Start 60-second cooldown with modal
      setIsRequestDisabled(true);
      setRequestCooldown(60);
      setShowRequestCooldown(true);
      
      toast({
        title: "Success",
        description: "Payment request sent to security cashier",
      });
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
        description: "Failed to create payment request",
        variant: "destructive",
      });
    },
  });

  const handleRequestPayment = () => {
    if (!vmfNumber.trim() || !vmfPhoto) {
      toast({
        title: "Missing Information",
        description: "Please enter VMF number and capture VMF photo",
        variant: "destructive",
      });
      return;
    }

    const amount = Math.round(parseFloat(paymentAmount));
    const dailySpent = Math.round(parseFloat(wallet?.dailySpent || "0"));
    const dailyLimit = 1000000; // K1,000,000 limit
    const remainingLimit = dailyLimit - dailySpent;

    if (amount > remainingLimit) {
      toast({
        title: "Daily Limit Exceeded",
        description: `Transaction amount (ZMW ${amount.toLocaleString()}) exceeds your available daily limit. Available: ZMW ${remainingLimit.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    createPaymentRequest.mutate({ amount: paymentAmount, vmfNumber });
  };

  const formatCurrency = (amount: string | number) => {
    return `ZMW ${Math.round(parseFloat(amount.toString())).toLocaleString()}`;
  };

  const handleVmfPhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVmfPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setVmfPhotoUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  if (isLoading || walletLoading) {
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
        subtitle={user?.firstName || "Merchant"}
        icon="fas fa-store"
        color="primary"
      />

      <div className="p-4">
        {/* Transfer Limits - Shows Wallet Balance */}
        {wallet && <WalletLimitsDisplay wallet={wallet} />}

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
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
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
              
              {/* VMF Photo Capture */}
              <div>
                <Label htmlFor="vmf-photo">VMF Photo *</Label>
                <div className="mt-2">
                  {!vmfPhoto ? (
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                      <i className="fas fa-camera text-gray-400 text-2xl mb-3"></i>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                        Take a photo of your VMF document
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleVmfPhotoCapture}
                        className="hidden"
                        id="vmf-photo-input"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('vmf-photo-input')?.click()}
                        className="w-full"
                      >
                        <i className="fas fa-camera mr-2"></i>
                        Capture VMF Photo
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={vmfPhotoUrl}
                        alt="VMF Document"
                        className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setVmfPhoto(null);
                          setVmfPhotoUrl("");
                        }}
                        className="absolute top-2 right-2"
                      >
                        <i className="fas fa-times"></i>
                      </Button>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('vmf-photo-input')?.click()}
                          className="flex-1"
                        >
                          <i className="fas fa-camera mr-2"></i>
                          Retake Photo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6 mt-6">
          <Button
            onClick={() => {
              if (!paymentAmount || !vmfNumber.trim() || !vmfPhoto) {
                toast({
                  title: "Missing Information",
                  description: "Please enter amount, VMF number, and capture VMF photo before generating QR code",
                  variant: "destructive",
                });
                return;
              }
              
              const amount = Math.round(parseFloat(paymentAmount));
              const dailySpent = Math.round(parseFloat(wallet?.dailySpent || "0"));
              const dailyLimit = 1000000;
              const remainingLimit = dailyLimit - dailySpent;

              if (amount > remainingLimit) {
                toast({
                  title: "Daily Limit Exceeded",
                  description: `Amount (ZMW ${amount.toLocaleString()}) exceeds available daily limit. Available: ZMW ${remainingLimit.toLocaleString()}`,
                  variant: "destructive",
                });
                return;
              }

              setShowQRModal(true);
            }}
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
            disabled={createPaymentRequest.isPending || isRequestDisabled}
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
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-history text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No transactions yet</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Your transactions will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(showAllTransactions ? transactions.slice(0, 30) : transactions.slice(0, 5)).map((transaction: any) => {
                  const dateTime = formatDateTime(transaction.createdAt);
                  return (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                          transaction.status === 'completed' ? 'bg-green-200 dark:bg-green-800' :
                          transaction.status === 'pending' ? 'bg-orange-200 dark:bg-orange-800' :
                          transaction.status === 'rejected' ? 'bg-red-200 dark:bg-red-800' :
                          'bg-gray-200 dark:bg-gray-700'
                        }`}>
                          <i className={`fas ${
                            transaction.status === 'completed' ? 'fa-arrow-down text-green-500' :
                            transaction.status === 'pending' ? 'fa-clock text-orange-500' :
                            transaction.status === 'rejected' ? 'fa-times text-red-500' :
                            'fa-times text-gray-400'
                          }`}></i>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
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
        onClose={() => setShowQRModal(false)}
        amount={paymentAmount}
        vmfNumber={vmfNumber}
      />

      <RequestCooldownModal
        isOpen={showRequestCooldown}
        countdown={requestCooldown}
        onClose={() => setShowRequestCooldown(false)}
      />
    </div>
  );
}
