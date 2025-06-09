import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import DocumentUploadModal from "@/components/document-upload-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CashierDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { isConnected } = useWebSocket();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeSession, setActiveSession] = useState({
    merchant: "Tech Store Plus",
    location: "Westlands Branch, Nairobi",
    amount: "25000"
  });

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
  const { data: pendingTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions/pending"],
    retry: false,
  });

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
    mutationFn: async (transactionId: number) => {
      await apiRequest("PATCH", `/api/transactions/${transactionId}/status`, {
        status: "rejected"
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transfer rejected",
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
              {/* Step 1: Count Cash */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
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
                {pendingTransactions.map((transaction: any) => (
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
                        onClick={() => approveTransaction.mutate(transaction.id)}
                        disabled={approveTransaction.isPending}
                        className="flex-1 bg-success hover:bg-success/90 text-white py-2 rounded-lg font-medium"
                      >
                        <i className="fas fa-check mr-2"></i>Approve Transfer
                      </Button>
                      <Button 
                        onClick={() => rejectTransaction.mutate(transaction.id)}
                        disabled={rejectTransaction.isPending}
                        className="flex-1 bg-destructive hover:bg-destructive/90 text-white py-2 rounded-lg font-medium"
                      >
                        <i className="fas fa-times mr-2"></i>Reject
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

      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}
