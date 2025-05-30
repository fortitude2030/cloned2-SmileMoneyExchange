import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import QRCodeModal from "@/components/qr-code-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MerchantDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showQRModal, setShowQRModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("25000");

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
    mutationFn: async (amount: string) => {
      await apiRequest("POST", "/api/transactions", {
        toUserId: user?.id,
        amount,
        type: "cash_digitization",
        status: "pending",
        description: "Cash digitization request",
      });
    },
    onSuccess: () => {
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
    createPaymentRequest.mutate(paymentAmount);
  };

  const formatCurrency = (amount: string | number) => {
    return `KSH ${parseFloat(amount.toString()).toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="status-completed">Completed</Badge>;
      case 'pending':
        return <Badge className="status-pending">Pending</Badge>;
      case 'approved':
        return <Badge className="status-approved">Approved</Badge>;
      case 'rejected':
        return <Badge className="status-rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
        {/* Wallet Balance Card */}
        <div className="gradient-secondary rounded-2xl p-6 text-white mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-green-100 text-sm">E-Wallet Balance</p>
              <h2 className="text-3xl font-bold">
                {wallet ? formatCurrency(wallet.balance) : "KSH 0.00"}
              </h2>
            </div>
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <i className="fas fa-wallet text-white text-xl"></i>
            </div>
          </div>
          <div className="flex items-center text-green-100 text-sm">
            <i className="fas fa-arrow-up mr-2"></i>
            <span>Digital cash platform</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button
            onClick={() => setShowQRModal(true)}
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
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow h-auto"
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
              <Button variant="ghost" className="text-primary text-sm font-medium">
                View All
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
                {transactions.map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        transaction.status === 'completed' ? 'bg-success bg-opacity-10' :
                        transaction.status === 'pending' ? 'bg-warning bg-opacity-10' :
                        'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        <i className={`fas ${
                          transaction.status === 'completed' ? 'fa-arrow-down text-success' :
                          transaction.status === 'pending' ? 'fa-clock text-warning' :
                          'fa-times text-gray-400'
                        }`}></i>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          {transaction.description || 'Cash Digitization'}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-sm ${
                        transaction.status === 'completed' ? 'text-success' :
                        transaction.status === 'pending' ? 'text-warning' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        +{formatCurrency(transaction.amount)}
                      </p>
                      {getStatusBadge(transaction.status)}
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
        onAmountChange={setPaymentAmount}
      />
    </div>
  );
}
