import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import AdminUserManagement from "@/components/admin-user-management";
import AdminOrganizationManagement from "@/components/admin-organization-management";
import AmlConfigurationDashboard from "@/components/aml-configuration-dashboard";
import AmlAlertManagement from "@/components/aml-alert-management";
import ComplianceReportsDashboard from "@/components/compliance-reports-dashboard";
import AccountingDashboard from "@/components/accounting-dashboard";
import { apiRequest } from "@/lib/queryClient";
import { DashboardStatsSkeleton, SettlementRequestSkeleton, TransactionListSkeleton } from "@/components/ui/loading-skeletons";

interface ActionDialogState {
  isOpen: boolean;
  settlementId: number | null;
  action: 'hold' | 'reject' | null;
  reason: string;
  reasonComment: string;
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSubTab, setActiveSubTab] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    isOpen: false,
    settlementId: null,
    action: null,
    reason: '',
    reasonComment: ''
  });

  const queryClient = useQueryClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isLoading, isAuthenticated]);

  // Format currency helper
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return 'ZMW 0';
    // Use Math.floor to truncate decimals without rounding
    const truncatedAmount = Math.floor(numAmount);
    return `ZMW ${truncatedAmount.toLocaleString()}`;
  };

  // Fetch settlement requests
  const { data: settlementRequests = [], isLoading: settlementsLoading } = useQuery({
    queryKey: ['/api/settlement-requests'],
    refetchInterval: 30000, // 30 seconds instead of 3 seconds
  });

  // Fetch transaction log
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['/api/admin/transactions'],
    refetchInterval: 60000, // 60 seconds instead of 3 seconds
  });

  // Filter pending requests (include both pending and hold status as "pending approval")
  const pendingRequests = Array.isArray(settlementRequests) ? 
    settlementRequests.filter((request: any) => request.status === 'pending' || request.status === 'hold') : [];

  // Filter and sort transactions
  const filteredTransactions = Array.isArray(transactions) ? 
    transactions.filter((transaction: any) => {
      if (priorityFilter === 'all') return true;
      return transaction.priority === priorityFilter;
    }).sort((a: any, b: any) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 2);
        case 'amount':
          return parseFloat(b.amount) - parseFloat(a.amount);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    }) : [];

  // Hold settlement mutation
  const holdSettlement = useMutation({
    mutationFn: async ({ id, reason, reasonComment }: { id: number; reason: string; reasonComment?: string }) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/hold`, { holdReason: reason, reasonComment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      toast({
        title: "Settlement request held successfully",
        description: "The settlement request has been placed on hold.",
      });
      setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error holding settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reject settlement mutation
  const rejectSettlement = useMutation({
    mutationFn: async ({ id, reason, reasonComment }: { id: number; reason: string; reasonComment?: string }) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/reject`, { rejectReason: reason, reasonComment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      toast({
        title: "Settlement request rejected",
        description: "The settlement request has been rejected.",
      });
      setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error rejecting settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Approve settlement mutation
  const approveSettlement = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-breakdown'] });
      toast({
        title: "Settlement request approved",
        description: "The settlement request has been approved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error approving settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Release settlement mutation (for held settlements)
  const releaseSettlement = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/release`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-breakdown'] });
      toast({
        title: "Settlement request released",
        description: "The settlement request has been released and approved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error releasing settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update transaction priority mutation
  const updateTransactionPriority = useMutation({
    mutationFn: async ({ id, priority }: { id: number; priority: string }) => {
      return apiRequest('PATCH', `/api/transactions/${id}/priority`, { priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
      toast({
        title: "Priority updated",
        description: "Transaction priority has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating priority",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenActionDialog = (settlementId: number, action: 'hold' | 'reject') => {
    setActionDialog({
      isOpen: true,
      settlementId,
      action,
      reason: '',
      reasonComment: ''
    });
  };

  const handleSubmitAction = async () => {
    if (!actionDialog.settlementId || !actionDialog.reason) return;

    const payload = {
      id: actionDialog.settlementId,
      reason: actionDialog.reason,
      reasonComment: actionDialog.reason === 'other' ? actionDialog.reasonComment : undefined
    };

    if (actionDialog.action === 'hold') {
      holdSettlement.mutate(payload);
    } else if (actionDialog.action === 'reject') {
      rejectSettlement.mutate(payload);
    }
  };

  const getHoldReasons = () => [
    { value: 'insufficient_documentation', label: 'Insufficient Documentation' },
    { value: 'verification_required', label: 'Additional Verification Required' },
    { value: 'compliance_review', label: 'Compliance Review Needed' },
    { value: 'other', label: 'Other (specify below)' }
  ];

  const getRejectReasons = () => [
    { value: 'invalid_documentation', label: 'Invalid Documentation' },
    { value: 'insufficient_funds', label: 'Insufficient Funds' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'fraud_suspicion', label: 'Fraud Suspicion' },
    { value: 'other', label: 'Other (specify below)' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileHeader
        title="Admin Portal"
        subtitle={(user as any)?.firstName || "Admin"}
        icon="fas fa-user-shield"
        color="red-600"
      />

      {/* Main Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="flex overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: 'fas fa-tachometer-alt' },
            { id: 'customers', label: 'Customers', icon: 'fas fa-users', hasSubMenu: true },
            { id: 'operations', label: 'Operations', icon: 'fas fa-cogs', hasSubMenu: true },
            { id: 'aml', label: 'AML', icon: 'fas fa-shield-alt', hasSubMenu: true },
            { id: 'compliance', label: 'Compliance', icon: 'fas fa-file-alt' },
            { id: 'accounting', label: 'Accounting', icon: 'fas fa-chart-line', hasSubMenu: true }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.hasSubMenu) {
                  // Set default sub-tab for menus with sub-items
                  if (tab.id === 'customers') setActiveSubTab('users');
                  else if (tab.id === 'operations') setActiveSubTab('transactions');
                  else if (tab.id === 'aml') setActiveSubTab('aml-config');
                  else if (tab.id === 'accounting') setActiveSubTab('overview');
                } else {
                  setActiveSubTab('');
                }
              }}
              className={`flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
              {tab.hasSubMenu && <i className="fas fa-chevron-down ml-1 text-xs"></i>}
            </button>
          ))}
        </div>
        
        {/* Sub-navigation for menu items with sub-menus */}
        {(activeTab === 'customers' || activeTab === 'operations' || activeTab === 'aml' || activeTab === 'accounting') && (
          <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="flex overflow-x-auto px-4">
              {activeTab === 'customers' && [
                { id: 'users', label: 'Users', icon: 'fas fa-user' },
                { id: 'organizations', label: 'Organizations', icon: 'fas fa-building' }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id)}
                  className={`flex items-center px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeSubTab === subTab.id
                      ? 'border-red-400 text-red-600 dark:text-red-400 bg-white dark:bg-gray-600'
                      : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                  }`}
                >
                  <i className={`${subTab.icon} mr-2 text-xs`}></i>
                  {subTab.label}
                </button>
              ))}
              
              {activeTab === 'operations' && [
                { id: 'transactions', label: 'Transactions', icon: 'fas fa-exchange-alt' },
                { id: 'settlements', label: 'Settlements', icon: 'fas fa-university' }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id)}
                  className={`flex items-center px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeSubTab === subTab.id
                      ? 'border-red-400 text-red-600 dark:text-red-400 bg-white dark:bg-gray-600'
                      : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                  }`}
                >
                  <i className={`${subTab.icon} mr-2 text-xs`}></i>
                  {subTab.label}
                </button>
              ))}
              
              {activeTab === 'aml' && [
                { id: 'aml-config', label: 'AML Config', icon: 'fas fa-cog' },
                { id: 'aml-alerts', label: 'AML Alerts', icon: 'fas fa-exclamation-triangle' }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id)}
                  className={`flex items-center px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeSubTab === subTab.id
                      ? 'border-red-400 text-red-600 dark:text-red-400 bg-white dark:bg-gray-600'
                      : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                  }`}
                >
                  <i className={`${subTab.icon} mr-2 text-xs`}></i>
                  {subTab.label}
                </button>
              ))}
              
              {activeTab === 'accounting' && [
                { id: 'overview', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
                { id: 'revenue', label: 'Revenue', icon: 'fas fa-dollar-sign' },
                { id: 'statements', label: 'Statements', icon: 'fas fa-file-invoice' },
                { id: 'journal', label: 'Journal & Ledger', icon: 'fas fa-book' },
                { id: 'reports', label: 'Reports', icon: 'fas fa-chart-bar' }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id)}
                  className={`flex items-center px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeSubTab === subTab.id
                      ? 'border-red-400 text-red-600 dark:text-red-400 bg-white dark:bg-gray-600'
                      : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                  }`}
                >
                  <i className={`${subTab.icon} mr-2 text-xs`}></i>
                  {subTab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* System Overview */}
            {settlementsLoading || transactionsLoading ? (
              <div className="mb-6">
                <DashboardStatsSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-red-600">
                          {pendingRequests.length}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Pending Approvals</p>
                      </div>
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {Array.isArray(transactions) ? transactions.filter((t: any) => t.status === 'completed').length : 0}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Completed Today</p>
                      </div>
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <i className="fas fa-check-circle text-green-600 dark:text-green-400"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Transaction Overview Card */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-exchange-alt text-blue-600 mr-2"></i>
                  Transaction Overview
                </h3>
                
                {transactionsLoading ? (
                  <div className="animate-pulse">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-gray-200 dark:bg-gray-700 h-16 rounded"></div>
                      ))}
                    </div>
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ) : (
                  <>
                    {/* Transaction Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-center">
                        <p className="text-blue-700 dark:text-blue-300 text-xs font-medium">TODAY'S TOTAL</p>
                        <p className="text-blue-900 dark:text-blue-100 text-lg font-bold">
                          {transactions ? (transactions as any[]).filter(t => {
                            const today = new Date().toDateString();
                            return new Date(t.createdAt).toDateString() === today;
                          }).length : 0}
                        </p>
                      </div>
                      
                      <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-center">
                        <p className="text-green-700 dark:text-green-300 text-xs font-medium">COMPLETED</p>
                        <p className="text-green-900 dark:text-green-100 text-lg font-bold">
                          {transactions ? (transactions as any[]).filter(t => t.status === 'completed').length : 0}
                        </p>
                      </div>
                      
                      <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg text-center">
                        <p className="text-yellow-700 dark:text-yellow-300 text-xs font-medium">PENDING</p>
                        <p className="text-yellow-900 dark:text-yellow-100 text-lg font-bold">
                          {transactions ? (transactions as any[]).filter(t => t.status === 'pending').length : 0}
                        </p>
                      </div>
                      
                      <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg text-center">
                        <p className="text-red-700 dark:text-red-300 text-xs font-medium">FAILED</p>
                        <p className="text-red-900 dark:text-red-100 text-lg font-bold">
                          {transactions ? (transactions as any[]).filter(t => t.status === 'failed').length : 0}
                        </p>
                      </div>
                    </div>
                    
                    {/* Total Volume */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">Total Volume Today</span>
                        <span className="text-gray-900 dark:text-gray-100 text-lg font-bold">
                          ZMW {transactions ? (transactions as any[])
                            .filter(t => {
                              const today = new Date().toDateString();
                              return new Date(t.createdAt).toDateString() === today;
                            })
                            .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
                            .toLocaleString() : '0'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Action Button */}
                    <Button 
                      onClick={() => setActiveTab('transactions')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <i className="fas fa-list mr-2"></i>
                      View All Transactions
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <>
            {/* Transaction Log */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                    <i className="fas fa-exchange-alt text-blue-600 mr-2"></i>
                    Transaction Log
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Latest First</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {transactionsLoading ? (
                  <TransactionListSkeleton count={3} />
                ) : transactions && Array.isArray(transactions) && transactions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(transactions as any[])
                      .sort((a, b) => {
                        if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        if (sortBy === 'amount') return parseFloat(b.amount || '0') - parseFloat(a.amount || '0');
                        if (sortBy === 'status') return a.status.localeCompare(b.status);
                        return 0;
                      })
                      .map((transaction: any) => (
                        <div key={transaction.id} className={`border rounded-lg p-4 ${
                          transaction.status === 'completed' ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-950' :
                          transaction.status === 'pending' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950' :
                          'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-950'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-200">
                                {transaction.transactionId}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {transaction.fromUserId} → {transaction.toUserId}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-800 dark:text-gray-200">
                                ZMW {parseFloat(transaction.amount || '0').toLocaleString()}
                              </p>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' :
                                transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                              }`}>
                                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(transaction.createdAt).toLocaleString()}
                          </p>
                          {transaction.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {transaction.description}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-exchange-alt text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Transaction history will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Settlements Tab */}
        {activeTab === 'settlements' && (
          <>
            {/* Maker-Checker Queue */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-tasks text-red-600 mr-2"></i>
                  Settlement Management
                </h3>
                
                {settlementsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="border-l-4 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="w-48 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-32 h-3 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
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
                          <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(settlementRequests) && settlementRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-tasks text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No settlement requests</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Settlement requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(settlementRequests) && settlementRequests.map((request: any) => (
                      <div key={request.id} className={`border-l-4 rounded-lg p-4 shadow-md ${
                        request.status === 'pending' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 dark:border-orange-400' :
                        request.status === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-400' :
                        request.status === 'hold' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-400' :
                        'border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-400'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                              Settlement Request #{request.id}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {request.user?.email}
                            </p>
                            <p className="text-gray-500 dark:text-gray-500 text-xs">
                              {new Date(request.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
                              {formatCurrency(request.amount)}
                            </p>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              request.status === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                              request.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' :
                              request.status === 'held' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                            }`}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </div>
                        </div>

                        {request.status === 'pending' ? (
                          <div className="flex space-x-3">
                            <Button 
                              onClick={() => approveSettlement.mutate(request.id)}
                              disabled={approveSettlement.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-check mr-2"></i>Approve
                            </Button>
                            <Button 
                              onClick={() => handleOpenActionDialog(request.id, 'hold')}
                              disabled={holdSettlement.isPending}
                              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-pause mr-2"></i>Hold
                            </Button>
                            <Button 
                              onClick={() => handleOpenActionDialog(request.id, 'reject')}
                              disabled={rejectSettlement.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-times mr-2"></i>Reject
                            </Button>
                          </div>
                        ) : request.status === 'hold' ? (
                          <div className="flex space-x-3">
                            <Button 
                              onClick={() => releaseSettlement.mutate(request.id)}
                              disabled={releaseSettlement.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-check mr-2"></i>Release & Approve
                            </Button>
                            <Button 
                              onClick={() => handleOpenActionDialog(request.id, 'reject')}
                              disabled={rejectSettlement.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-times mr-2"></i>Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {request.reviewedBy && request.reviewedAt ? (
                                <>Processed by Admin on {new Date(request.reviewedAt).toLocaleDateString()}</>
                              ) : (
                                <>Status: {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</>
                              )}
                            </p>
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

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <>
            {/* Filtering Controls */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Filter & Sort</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Select 
                    value={priorityFilter} 
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={sortBy} 
                    onValueChange={setSortBy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Sort by Date</SelectItem>
                      <SelectItem value="priority">Sort by Priority</SelectItem>
                      <SelectItem value="amount">Sort by Amount</SelectItem>
                      <SelectItem value="status">Sort by Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Log */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-list text-blue-600 mr-2"></i>
                  Transaction Management
                </h3>
                
                {transactionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg mr-3"></div>
                          <div className="flex-1">
                            <div className="w-32 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="w-20 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                          <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(transactions) && transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-list text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Transaction history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredTransactions.slice(0, 50).map((transaction: any) => (
                      <div key={transaction.id} className={`p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 ${
                        transaction.priority === 'high' ? 'border-red-500' :
                        transaction.priority === 'medium' ? 'border-yellow-500' :
                        'border-gray-400'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center flex-1">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                              transaction.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                              transaction.status === 'pending' ? 'bg-orange-100 dark:bg-orange-900' :
                              transaction.status === 'rejected' ? 'bg-red-100 dark:bg-red-900' :
                              'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              <i className={`fas ${
                                transaction.status === 'completed' ? 'fa-check text-green-600 dark:text-green-400' :
                                transaction.status === 'pending' ? 'fa-clock text-orange-600 dark:text-orange-400' :
                                transaction.status === 'rejected' ? 'fa-times text-red-600 dark:text-red-400' :
                                'fa-circle text-gray-600 dark:text-gray-400'
                              }`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`font-medium text-sm truncate ${
                                  transaction.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                                  transaction.status === 'pending' ? 'text-orange-600 dark:text-orange-400' :
                                  transaction.status === 'rejected' ? 'text-red-600 dark:text-red-400' :
                                  'text-gray-600 dark:text-gray-400'
                                }`}>
                                  {transaction.transactionId}
                                </p>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' :
                                  transaction.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                }`}>
                                  {transaction.priority?.charAt(0).toUpperCase() + transaction.priority?.slice(1) || 'Medium'} Priority
                                </span>
                              </div>
                              <p className="text-gray-500 dark:text-gray-500 text-xs truncate">
                                {transaction.type === 'qr_payment' ? 'QR Payment' : 
                                 transaction.type === 'rtp' ? 'Real-time Payment' : 
                                 transaction.type || 'Transfer'} • 
                                {new Date(transaction.createdAt).toLocaleDateString()}
                              </p>
                              {transaction.description && (
                                <p className="text-gray-400 dark:text-gray-600 text-xs truncate mt-1">
                                  {transaction.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                              {formatCurrency(transaction.amount)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {new Date(transaction.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        
                        {/* Priority Control for Admin */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Priority:</span>
                            <Select 
                              value={transaction.priority || 'medium'} 
                              onValueChange={(priority) => updateTransactionPriority.mutate({ id: transaction.id, priority })}
                              disabled={updateTransactionPriority.isPending}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' :
                              transaction.status === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                              transaction.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                            }`}>
                              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <>
            {/* System Analytics */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">System Analytics</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {Array.isArray(settlementRequests) ? settlementRequests.length : 0}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Total Requests</p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {Array.isArray(settlementRequests) ? settlementRequests.filter((r) => r.status === 'approved').length : 0}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Approved</p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-secondary">
                      {Array.isArray(settlementRequests) && settlementRequests.length > 0 ? 
                        Math.round((settlementRequests.filter((r) => r.status === 'approved').length / settlementRequests.length) * 100) : 0
                      }%
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Success Rate</p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-primary">2.3m</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Process Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Customers - Users Tab */}
        {activeTab === 'customers' && activeSubTab === 'users' && (
          <AdminUserManagement />
        )}

        {/* Customers - Organizations Tab */}
        {activeTab === 'customers' && activeSubTab === 'organizations' && (
          <AdminOrganizationManagement />
        )}

        {/* Operations - Transactions Tab */}
        {activeTab === 'operations' && activeSubTab === 'transactions' && (
          <>
            {/* Filtering Controls */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Filter & Sort</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Select 
                    value={priorityFilter} 
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={sortBy} 
                    onValueChange={setSortBy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Sort by Date</SelectItem>
                      <SelectItem value="priority">Sort by Priority</SelectItem>
                      <SelectItem value="amount">Sort by Amount</SelectItem>
                      <SelectItem value="status">Sort by Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Log */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-list text-blue-600 mr-2"></i>
                  Transaction Management
                </h3>
                
                {transactionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg mr-3"></div>
                          <div className="flex-1">
                            <div className="w-32 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="w-20 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                          <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(transactions) && transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-list text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Transaction history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {Array.isArray(transactions) && transactions.map((transaction: any) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                            transaction.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                            transaction.status === 'pending' ? 'bg-orange-100 dark:bg-orange-900' :
                            transaction.status === 'rejected' ? 'bg-red-100 dark:bg-red-900' :
                            'bg-gray-100 dark:bg-gray-700'
                          }`}>
                            <i className={`fas ${
                              transaction.status === 'completed' ? 'fa-check text-green-600 dark:text-green-400' :
                              transaction.status === 'pending' ? 'fa-clock text-orange-600 dark:text-orange-400' :
                              transaction.status === 'rejected' ? 'fa-times text-red-600 dark:text-red-400' :
                              'fa-circle text-gray-600 dark:text-gray-400'
                            }`}></i>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-gray-800 dark:text-gray-200">
                                {transaction.transactionId}
                              </p>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' :
                                transaction.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}>
                                {transaction.priority || 'medium'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {transaction.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </p>
                            {transaction.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-48">
                                {transaction.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                            K{parseFloat(transaction.amount).toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {new Date(transaction.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Operations - Settlements Tab */}
        {activeTab === 'operations' && activeSubTab === 'settlements' && (
          <>
            {/* System Overview */}
            {settlementsLoading || transactionsLoading ? (
              <div className="mb-6">
                <DashboardStatsSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-red-600">
                          {pendingRequests.length}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Pending Approvals</p>
                      </div>
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {Array.isArray(transactions) ? transactions.filter((t: any) => t.status === 'completed').length : 0}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Completed Today</p>
                      </div>
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <i className="fas fa-check-circle text-green-600 dark:text-green-400"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Settlement Requests Card */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-university text-blue-600 mr-2"></i>
                  Settlement Requests
                </h3>
                
                {settlementsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="border-l-4 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="w-48 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-32 h-3 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
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
                          <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(settlementRequests) && settlementRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-tasks text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No settlement requests</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Settlement requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(settlementRequests) && settlementRequests.map((request: any) => (
                      <div key={request.id} className={`border-l-4 rounded-lg p-4 shadow-md ${
                        request.status === 'pending' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 dark:border-orange-400' :
                        request.status === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-400' :
                        request.status === 'hold' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-400' :
                        'border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-400'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                              Settlement Request #{request.id}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {request.user?.email}
                            </p>
                            <p className="text-gray-500 dark:text-gray-500 text-xs">
                              {new Date(request.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                              ZMW {parseFloat(request.amount).toLocaleString()}
                            </p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              request.status === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                              request.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' :
                              request.status === 'hold' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                            }`}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        
                        {request.status === 'pending' && (
                          <div className="flex space-x-3 mt-3">
                            <Button
                              onClick={() => approveSettlement.mutate({ id: request.id })}
                              disabled={approveSettlement.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-check mr-2"></i>Approve
                            </Button>
                            <Button
                              onClick={() => handleOpenActionDialog(request.id, 'hold')}
                              disabled={holdSettlement.isPending}
                              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-pause mr-2"></i>Hold
                            </Button>
                            <Button
                              onClick={() => handleOpenActionDialog(request.id, 'reject')}
                              disabled={rejectSettlement.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-times mr-2"></i>Reject
                            </Button>
                          </div>
                        )}
                        
                        {request.status !== 'pending' && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {request.reviewedBy && request.reviewedAt ? (
                                <>Processed by Admin on {new Date(request.reviewedAt).toLocaleDateString()}</>
                              ) : (
                                <>Status: {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</>
                              )}
                            </p>
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

        {/* AML - Config Tab */}
        {activeTab === 'aml' && activeSubTab === 'aml-config' && (
          <AmlConfigurationDashboard />
        )}

        {/* AML - Alerts Tab */}
        {activeTab === 'aml' && activeSubTab === 'aml-alerts' && (
          <AmlAlertManagement />
        )}

        {/* Accounting - Dashboard Tab */}
        {activeTab === 'accounting' && activeSubTab === 'overview' && (
          <AccountingDashboard />
        )}

        {/* Accounting - Revenue Tab */}
        {activeTab === 'accounting' && activeSubTab === 'revenue' && (
          <AccountingDashboard />
        )}

        {/* Accounting - Statements Tab */}
        {activeTab === 'accounting' && activeSubTab === 'statements' && (
          <>
            {/* Financial Statements Content */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-file-invoice text-blue-600 mr-2"></i>
                  Financial Statements
                </h3>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Balance Sheet</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Assets, Liabilities & Equity overview</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Income Statement</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Revenue and expenses breakdown</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Chart of Accounts</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Account structure management</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Accounting - Journal Tab */}
        {activeTab === 'accounting' && activeSubTab === 'journal' && (
          <>
            {/* Journal Entries Content */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-book text-blue-600 mr-2"></i>
                  Journal Entries & Ledger
                </h3>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">JE-2024-001</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Transaction Fee Revenue</p>
                        <p className="text-xs text-gray-500">Dec 21, 2025 • K850.00</p>
                      </div>
                      <Badge variant="default">posted</Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium border-b pb-2">
                        <span>Account</span>
                        <span className="text-right">Debit</span>
                        <span className="text-right">Credit</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <span>1200 - Cash</span>
                        <span className="text-right">K850.00</span>
                        <span className="text-right">-</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <span>4100 - Transaction Fee Revenue</span>
                        <span className="text-right">-</span>
                        <span className="text-right">K850.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">JE-2024-002</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Settlement Processing</p>
                        <p className="text-xs text-gray-500">Dec 21, 2025 • K1,250.00</p>
                      </div>
                      <Badge variant="default">posted</Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium border-b pb-2">
                        <span>Account</span>
                        <span className="text-right">Debit</span>
                        <span className="text-right">Credit</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <span>1200 - Cash</span>
                        <span className="text-right">K150.00</span>
                        <span className="text-right">-</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <span>2100 - Settlement Liability</span>
                        <span className="text-right">K1,100.00</span>
                        <span className="text-right">-</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <span>4200 - Settlement Fee Revenue</span>
                        <span className="text-right">-</span>
                        <span className="text-right">K150.00</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <span>2200 - Customer Deposits</span>
                        <span className="text-right">-</span>
                        <span className="text-right">K1,100.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Accounting - Reports Tab */}
        {activeTab === 'accounting' && activeSubTab === 'reports' && (
          <>
            {/* Quick Export Actions */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-download text-blue-600 mr-2"></i>
                  Quick Export Actions
                </h3>
                
                {/* Export Format Options */}
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">Export Current Data</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <Button 
                      variant="outline" 
                      className="flex items-center justify-center"
                      onClick={() => {
                        // Trigger PDF export of current financial data
                        window.open('/api/accounting/export/pdf', '_blank');
                      }}
                    >
                      <i className="fas fa-file-pdf text-red-600 mr-2"></i>
                      PDF
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex items-center justify-center"
                      onClick={() => {
                        // Trigger Excel export
                        window.open('/api/accounting/export/excel', '_blank');
                      }}
                    >
                      <i className="fas fa-file-excel text-green-600 mr-2"></i>
                      Excel
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex items-center justify-center"
                      onClick={() => {
                        // Trigger Word export
                        window.open('/api/accounting/export/word', '_blank');
                      }}
                    >
                      <i className="fas fa-file-word text-blue-600 mr-2"></i>
                      Word
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex items-center justify-center"
                      onClick={() => {
                        // Trigger CSV export
                        window.open('/api/accounting/export/csv', '_blank');
                      }}
                    >
                      <i className="fas fa-file-csv text-orange-600 mr-2"></i>
                      CSV
                    </Button>
                  </div>
                </div>

                {/* Report Types */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Financial Statements</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Balance Sheet, Income Statement, Cash Flow</p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/accounting/generate-report/financial-statements', { 
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });
                            const result = await response.json();
                            if (response.ok) {
                              alert(`${result.message}. Click OK to download.`);
                              window.open(result.downloadUrl, '_blank');
                            } else {
                              alert(`Error: ${result.message}`);
                            }
                          } catch (error) {
                            alert('Error generating financial statements report');
                          }
                        }}
                      >
                        Generate
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const getEmailsFromContainer = (containerId: string) => {
                              const container = document.querySelector(containerId);
                              const emailElements = container?.querySelectorAll('span');
                              return Array.from(emailElements || []).map(span => span.textContent).filter(email => email);
                            };
                            
                            const recipients = getEmailsFromContainer('#finance-recipients');
                            if (recipients.length === 0) recipients.push('test@cash.smilemoney.africa');
                            
                            const response = await fetch('/api/accounting/schedule-report', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                reportType: 'financial-statements',
                                frequency: 'monthly',
                                recipients: recipients,
                                format: 'pdf'
                              })
                            });
                            const result = await response.json();
                            alert(result.message);
                          } catch (error) {
                            alert('Error scheduling report');
                          }
                        }}
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Revenue Analysis</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Transaction fees, settlement charges breakdown</p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/accounting/generate-report/revenue-analysis', { 
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });
                            const result = await response.json();
                            if (response.ok) {
                              alert(`${result.message}. Click OK to download.`);
                              window.open(result.downloadUrl, '_blank');
                            } else {
                              alert(`Error: ${result.message}`);
                            }
                          } catch (error) {
                            alert('Error generating revenue analysis report');
                          }
                        }}
                      >
                        Generate
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const getEmailsFromContainer = (containerId: string) => {
                              const container = document.querySelector(containerId);
                              const emailElements = container?.querySelectorAll('span');
                              return Array.from(emailElements || []).map(span => span.textContent).filter(email => email);
                            };
                            
                            const recipients = getEmailsFromContainer('#finance-recipients');
                            if (recipients.length === 0) recipients.push('test@cash.smilemoney.africa');
                            
                            const response = await fetch('/api/accounting/schedule-report', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                reportType: 'revenue-analysis',
                                frequency: 'weekly',
                                recipients: recipients,
                                format: 'excel'
                              })
                            });
                            const result = await response.json();
                            alert(result.message);
                          } catch (error) {
                            alert('Error scheduling report');
                          }
                        }}
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Transaction Summary</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Daily, weekly, monthly transaction reports</p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/accounting/generate-report/transaction-summary', { 
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });
                            const result = await response.json();
                            if (response.ok) {
                              alert(`${result.message}. Click OK to download.`);
                              window.open(result.downloadUrl, '_blank');
                            } else {
                              alert(`Error: ${result.message}`);
                            }
                          } catch (error) {
                            alert('Error generating transaction summary report');
                          }
                        }}
                      >
                        Generate
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const getEmailsFromContainer = (containerId: string) => {
                              const container = document.querySelector(containerId);
                              const emailElements = container?.querySelectorAll('span');
                              return Array.from(emailElements || []).map(span => span.textContent).filter(email => email);
                            };
                            
                            const recipients = getEmailsFromContainer('#operations-recipients');
                            if (recipients.length === 0) recipients.push('test@cash.smilemoney.africa');
                            
                            const response = await fetch('/api/accounting/schedule-report', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                reportType: 'transaction-summary',
                                frequency: 'daily',
                                recipients: recipients,
                                format: 'csv'
                              })
                            });
                            const result = await response.json();
                            alert(result.message);
                          } catch (error) {
                            alert('Error scheduling report');
                          }
                        }}
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Regulatory Reports</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Bank of Zambia compliance reports</p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/accounting/generate-report/regulatory', { 
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });
                            const result = await response.json();
                            if (response.ok) {
                              alert(`${result.message}. Click OK to download.`);
                              window.open(result.downloadUrl, '_blank');
                            } else {
                              alert(`Error: ${result.message}`);
                            }
                          } catch (error) {
                            alert('Error generating regulatory report');
                          }
                        }}
                      >
                        Generate
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const getEmailsFromContainer = (containerId: string) => {
                              const container = document.querySelector(containerId);
                              const emailElements = container?.querySelectorAll('span');
                              return Array.from(emailElements || []).map(span => span.textContent).filter(email => email);
                            };
                            
                            const recipients = getEmailsFromContainer('#compliance-recipients');
                            if (recipients.length === 0) recipients.push('test@cash.smilemoney.africa');
                            
                            const response = await fetch('/api/accounting/schedule-report', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                reportType: 'regulatory',
                                frequency: 'monthly',
                                recipients: recipients,
                                format: 'pdf'
                              })
                            });
                            const result = await response.json();
                            alert(result.message);
                          } catch (error) {
                            alert('Error scheduling report');
                          }
                        }}
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Email Distribution */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Automated Email Distribution</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Configure automatic report delivery to stakeholders</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs"
                    onClick={() => alert('Email configuration feature coming soon!')}
                  >
                    <i className="fas fa-envelope mr-2"></i>
                    Configure Recipients
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reports & Export from AccountingDashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-file-text"></i>
                    Generate Reports
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-20 flex-col gap-2" onClick={async () => {
                      try {
                        const response = await fetch('/api/accounting/generate-report/financial-statements', { 
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        if (response.ok) {
                          window.open(result.downloadUrl, '_blank');
                        } else {
                          alert(`Error: ${result.message}`);
                        }
                      } catch (error) {
                        alert('Error generating financial statements');
                      }
                    }}>
                      <i className="fas fa-file-text text-lg"></i>
                      <span className="text-xs">Financial Statements</span>
                    </Button>
                    
                    <Button variant="outline" className="h-20 flex-col gap-2" onClick={async () => {
                      try {
                        const response = await fetch('/api/accounting/generate-report/revenue-analysis', { 
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        if (response.ok) {
                          window.open(result.downloadUrl, '_blank');
                        } else {
                          alert(`Error: ${result.message}`);
                        }
                      } catch (error) {
                        alert('Error generating revenue analysis');
                      }
                    }}>
                      <i className="fas fa-chart-bar text-lg"></i>
                      <span className="text-xs">Revenue Analysis</span>
                    </Button>
                    
                    <Button variant="outline" className="h-20 flex-col gap-2" onClick={async () => {
                      try {
                        window.open('/api/accounting/export/csv', '_blank');
                      } catch (error) {
                        alert('Error downloading journal entries');
                      }
                    }}>
                      <i className="fas fa-download text-lg"></i>
                      <span className="text-xs">Journal Entries</span>
                    </Button>
                    
                    <Button variant="outline" className="h-20 flex-col gap-2" onClick={async () => {
                      try {
                        const response = await fetch('/api/accounting/generate-report/regulatory', { 
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        if (response.ok) {
                          window.open(result.downloadUrl, '_blank');
                        } else {
                          alert(`Error: ${result.message}`);
                        }
                      } catch (error) {
                        alert('Error generating audit trail');
                      }
                    }}>
                      <i className="fas fa-file-text text-lg"></i>
                      <span className="text-xs">Audit Trail</span>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <Label>Report Format</Label>
                    <Select defaultValue="pdf">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Document</SelectItem>
                        <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                        <SelectItem value="csv">CSV File</SelectItem>
                        <SelectItem value="json">JSON Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-share-alt"></i>
                    Sharing & Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <Label>Email Recipients Management</Label>
                    
                    {/* Financial Reports Recipients */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Financial Reports</Label>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const email = prompt('Enter email address:');
                            if (email && email.includes('@')) {
                              const container = document.querySelector('#finance-recipients');
                              if (container) {
                                const emailTag = document.createElement('div');
                                emailTag.className = 'flex items-center gap-2 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs';
                                emailTag.innerHTML = `
                                  <span>${email}</span>
                                  <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700">×</button>
                                `;
                                container.appendChild(emailTag);
                              }
                            }
                          }}
                        >
                          + Add Email
                        </Button>
                      </div>
                      <div id="finance-recipients" className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded">
                        <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs">
                          <span>test@cash.smilemoney.africa</span>
                          <button onclick="this.parentElement.remove()" className="text-red-500 hover:text-red-700">×</button>
                        </div>
                      </div>
                    </div>

                    {/* Operations Reports Recipients */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Operations Reports</Label>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const email = prompt('Enter email address:');
                            if (email && email.includes('@')) {
                              const container = document.querySelector('#operations-recipients');
                              if (container) {
                                const emailTag = document.createElement('div');
                                emailTag.className = 'flex items-center gap-2 bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs';
                                emailTag.innerHTML = `
                                  <span>${email}</span>
                                  <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700">×</button>
                                `;
                                container.appendChild(emailTag);
                              }
                            }
                          }}
                        >
                          + Add Email
                        </Button>
                      </div>
                      <div id="operations-recipients" className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded">
                        <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs">
                          <span>test@cash.smilemoney.africa</span>
                          <button onclick="this.parentElement.remove()" className="text-red-500 hover:text-red-700">×</button>
                        </div>
                      </div>
                    </div>

                    {/* Compliance Reports Recipients */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Compliance Reports</Label>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const email = prompt('Enter email address:');
                            if (email && email.includes('@')) {
                              const container = document.querySelector('#compliance-recipients');
                              if (container) {
                                const emailTag = document.createElement('div');
                                emailTag.className = 'flex items-center gap-2 bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs';
                                emailTag.innerHTML = `
                                  <span>${email}</span>
                                  <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700">×</button>
                                `;
                                container.appendChild(emailTag);
                              }
                            }
                          }}
                        >
                          + Add Email
                        </Button>
                      </div>
                      <div id="compliance-recipients" className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded">
                        <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs">
                          <span>test@cash.smilemoney.africa</span>
                          <button onclick="this.parentElement.remove()" className="text-red-500 hover:text-red-700">×</button>
                        </div>
                      </div>
                    </div>

                    {/* Admin Notifications Recipients */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Admin Notifications</Label>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const email = prompt('Enter email address:');
                            if (email && email.includes('@')) {
                              const container = document.querySelector('#admin-recipients');
                              if (container) {
                                const emailTag = document.createElement('div');
                                emailTag.className = 'flex items-center gap-2 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-xs';
                                emailTag.innerHTML = `
                                  <span>${email}</span>
                                  <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700">×</button>
                                `;
                                container.appendChild(emailTag);
                              }
                            }
                          }}
                        >
                          + Add Email
                        </Button>
                      </div>
                      <div id="admin-recipients" className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded">
                        <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-xs">
                          <span>test@cash.smilemoney.africa</span>
                          <button onclick="this.parentElement.remove()" className="text-red-500 hover:text-red-700">×</button>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Click × to remove email recipients. Changes are applied when scheduling reports.
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={async () => {
                          try {
                            const getEmailsFromContainer = (containerId: string) => {
                              const container = document.querySelector(containerId);
                              const emailElements = container?.querySelectorAll('span');
                              return Array.from(emailElements || []).map(span => span.textContent).filter(email => email);
                            };

                            const financeEmails = getEmailsFromContainer('#finance-recipients').join(',');
                            const operationsEmails = getEmailsFromContainer('#operations-recipients').join(',');
                            const complianceEmails = getEmailsFromContainer('#compliance-recipients').join(',');
                            const adminEmails = getEmailsFromContainer('#admin-recipients').join(',');
                            
                            const response = await fetch('/api/admin/email-settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                financeEmails,
                                operationsEmails,
                                complianceEmails,
                                adminEmails
                              })
                            });
                            
                            if (response.ok) {
                              alert('Email settings saved successfully');
                            } else {
                              alert('Failed to save email settings');
                            }
                          } catch (error) {
                            alert('Error saving email settings');
                          }
                        }}
                      >
                        Save Settings
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/admin/email-settings');
                            if (response.ok) {
                              const settings = await response.json();
                              
                              const loadEmailsToContainer = (containerId: string, emails: string, colorClass: string) => {
                                const container = document.querySelector(containerId);
                                if (container) {
                                  container.innerHTML = '';
                                  emails.split(',').filter(email => email.trim()).forEach(email => {
                                    const emailTag = document.createElement('div');
                                    emailTag.className = `flex items-center gap-2 ${colorClass} px-2 py-1 rounded text-xs`;
                                    emailTag.innerHTML = `
                                      <span>${email.trim()}</span>
                                      <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700">×</button>
                                    `;
                                    container.appendChild(emailTag);
                                  });
                                }
                              };

                              loadEmailsToContainer('#finance-recipients', settings.financeEmails || '', 'bg-blue-100 dark:bg-blue-900');
                              loadEmailsToContainer('#operations-recipients', settings.operationsEmails || '', 'bg-green-100 dark:bg-green-900');
                              loadEmailsToContainer('#compliance-recipients', settings.complianceEmails || '', 'bg-orange-100 dark:bg-orange-900');
                              loadEmailsToContainer('#admin-recipients', settings.adminEmails || '', 'bg-purple-100 dark:bg-purple-900');
                              
                              alert('Email settings loaded');
                            } else {
                              alert('No saved email settings found');
                            }
                          } catch (error) {
                            alert('Error loading email settings');
                          }
                        }}
                      >
                        Load Settings
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Schedule</Label>
                    <Select defaultValue="manual">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Only</SelectItem>
                        <SelectItem value="daily">Daily at 9:00 AM</SelectItem>
                        <SelectItem value="weekly">Weekly on Monday</SelectItem>
                        <SelectItem value="monthly">Monthly on 1st</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full" onClick={() => {
                    alert('Report Shared Successfully - Financial report sent to specified recipients');
                  }}>
                    <i className="fas fa-share-alt mr-2"></i>
                    Share Report
                  </Button>

                  <div className="text-xs text-gray-500">
                    <p>• Automatic reports sent monthly on 1st</p>
                    <p>• Regulatory compliance reports quarterly</p>
                    <p>• Custom reports available on request</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Compliance Tab */}
        {activeTab === 'compliance' && (
          <>
            {/* Compliance Reports Overview */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-blue-600">12</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Monthly Reports</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <i className="fas fa-calendar-alt text-blue-600 dark:text-blue-400"></i>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Last: Dec 2024</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-green-600">4</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Quarterly Reports</p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      <i className="fas fa-chart-line text-green-600 dark:text-green-400"></i>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Last: Q4 2024</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-purple-600">1</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Annual Reports</p>
                    </div>
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                      <i className="fas fa-file-alt text-purple-600 dark:text-purple-400"></i>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Last: 2024</p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Reports */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-calendar-alt text-blue-600 mr-2"></i>
                  Monthly Compliance Reports
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">AML Transaction Monitoring</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Monthly suspicious activity and threshold breaches</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Current</Button>
                      <Button size="sm" variant="outline" className="text-xs">View History</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Transaction Volume Report</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Monthly transaction statistics for BoZ</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Current</Button>
                      <Button size="sm" variant="outline" className="text-xs">View History</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">KYC Compliance Status</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Customer verification and documentation status</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Current</Button>
                      <Button size="sm" variant="outline" className="text-xs">View History</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Risk Assessment Summary</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Monthly risk evaluation and mitigation measures</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Current</Button>
                      <Button size="sm" variant="outline" className="text-xs">View History</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quarterly Reports */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-chart-line text-green-600 mr-2"></i>
                  Quarterly Compliance Reports
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Regulatory Compliance Review</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Comprehensive compliance assessment for BoZ</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Q1 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">Previous Quarters</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">AML Program Effectiveness</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Quarterly review of AML controls and procedures</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Q1 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">Previous Quarters</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Business Growth Analysis</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Quarterly business metrics and expansion plans</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Q1 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">Previous Quarters</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Financial Performance Report</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Quarterly financial health and sustainability metrics</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate Q1 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">Previous Quarters</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Annual Reports */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-file-alt text-purple-600 mr-2"></i>
                  Annual Compliance Reports
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Annual Regulatory Filing</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Comprehensive annual report for Bank of Zambia</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">View 2024</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">AML Program Annual Review</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Annual assessment of AML effectiveness and updates</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">View 2024</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Risk Management Report</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Annual risk assessment and mitigation strategies</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">View 2024</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Business Continuity Plan</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Annual review of business continuity and disaster recovery</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="text-xs">Generate 2025</Button>
                      <Button size="sm" variant="outline" className="text-xs">View 2024</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Original Compliance Dashboard */}
            <ComplianceReportsDashboard />
          </>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <>
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">System Configuration</h3>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Database Status</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Connected</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Real-time Updates</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <MobileNav
        activeTab="home"
        role="admin"
        tabs={[
          { id: "home", label: "Home", icon: "fas fa-home" },
          { id: "analytics", label: "Analytics", icon: "fas fa-chart-bar" },
          { id: "users", label: "Users", icon: "fas fa-users" },
        ]}
      />

      {/* Action Dialog for Hold/Reject */}
      <Dialog open={actionDialog.isOpen} onOpenChange={() => setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' })}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-center">
              {actionDialog.action === 'hold' ? 'Hold Settlement Request' : 'Reject Settlement Request'}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-600 dark:text-gray-400">
              {actionDialog.action === 'hold' ? 'Temporarily hold this settlement request with a reason' : 'Permanently reject this settlement request with a reason'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Select 
                value={actionDialog.reason} 
                onValueChange={(value) => setActionDialog(prev => ({ ...prev, reason: value, reasonComment: value === 'other' ? prev.reasonComment : '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {(actionDialog.action === 'hold' ? getHoldReasons() : getRejectReasons()).map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {actionDialog.reason === 'other' && (
              <div>
                <Label htmlFor="reasonComment">Comment * (125 chars max)</Label>
                <Textarea
                  id="reasonComment"
                  value={actionDialog.reasonComment}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, reasonComment: e.target.value }))}
                  placeholder="Enter detailed reason..."
                  maxLength={125}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {actionDialog.reasonComment.length}/125 characters
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex space-x-3 mt-6">
            <Button 
              onClick={() => setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' })}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitAction}
              disabled={!actionDialog.reason || (actionDialog.reason === 'other' && !actionDialog.reasonComment.trim()) || holdSettlement.isPending || rejectSettlement.isPending}
              className={`flex-1 ${actionDialog.action === 'hold' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
            >
              {(holdSettlement.isPending || rejectSettlement.isPending) ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className={`fas ${actionDialog.action === 'hold' ? 'fa-pause' : 'fa-times'} mr-2`}></i>
                  {actionDialog.action === 'hold' ? 'Hold' : 'Reject'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}