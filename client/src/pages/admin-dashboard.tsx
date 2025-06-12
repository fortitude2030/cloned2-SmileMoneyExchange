import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { SettlementRequest } from "@/../../shared/schema";

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
  
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    isOpen: false,
    settlementId: null,
    action: null,
    reason: '',
    reasonComment: ''
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

  // Fetch settlement requests for admin with auto-refresh
  const { data: settlementRequests = [], isLoading: settlementsLoading } = useQuery<SettlementRequest[]>({
    queryKey: ["/api/settlement-requests"],
    retry: false,
    refetchInterval: 3000, // Auto-refresh every 3 seconds
    refetchIntervalInBackground: true, // Keep refreshing when tab is not active
  });

  // Approve settlement mutation
  const approveSettlement = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/admin/settlement-requests/${id}/approve`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settlement request approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve settlement",
        variant: "destructive",
      });
    }
  });

  // Hold settlement mutation
  const holdSettlement = useMutation({
    mutationFn: async ({ id, holdReason, reasonComment }: { id: number; holdReason: string; reasonComment?: string }) => {
      await apiRequest("PATCH", `/api/admin/settlement-requests/${id}/hold`, {
        holdReason,
        reasonComment
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settlement request placed on hold",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] });
      setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to hold settlement",
        variant: "destructive",
      });
    }
  });

  // Reject settlement mutation
  const rejectSettlement = useMutation({
    mutationFn: async ({ id, rejectReason, reasonComment }: { id: number; rejectReason: string; reasonComment?: string }) => {
      await apiRequest("PATCH", `/api/admin/settlement-requests/${id}/reject`, {
        rejectReason,
        reasonComment
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settlement request rejected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] });
      setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject settlement",
        variant: "destructive",
      });
    }
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

  const handleSubmitAction = () => {
    if (!actionDialog.settlementId || !actionDialog.action || !actionDialog.reason) {
      toast({
        title: "Error",
        description: "Please select a reason",
        variant: "destructive",
      });
      return;
    }

    if (actionDialog.reason === 'other' && !actionDialog.reasonComment.trim()) {
      toast({
        title: "Error",
        description: "Comment is required when selecting 'other' reason",
        variant: "destructive",
      });
      return;
    }

    if (actionDialog.reasonComment.length > 125) {
      toast({
        title: "Error",
        description: "Comment must be 125 characters or less",
        variant: "destructive",
      });
      return;
    }

    if (actionDialog.action === 'hold') {
      holdSettlement.mutate({
        id: actionDialog.settlementId,
        holdReason: actionDialog.reason,
        reasonComment: actionDialog.reasonComment || undefined
      });
    } else {
      rejectSettlement.mutate({
        id: actionDialog.settlementId,
        rejectReason: actionDialog.reason,
        reasonComment: actionDialog.reasonComment || undefined
      });
    }
  };

  const getHoldReasons = () => [
    { value: 'insufficient_documentation', label: 'Insufficient documentation' },
    { value: 'settlement_cover', label: 'Settlement Cover' },
    { value: 'pending_verification', label: 'Pending verification' },
    { value: 'other', label: 'Other' }
  ];

  const getRejectReasons = () => [
    { value: 'invalid_account_details', label: 'Invalid account details' },
    { value: 'duplicate_request', label: 'Duplicate request' },
    { value: 'policy_violation', label: 'Policy violation' },
    { value: 'other', label: 'Other' }
  ];

  const formatCurrency = (amount: string | number) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 'ZMW 0';
    const truncatedAmount = Math.floor(numericAmount);
    return `ZMW ${truncatedAmount.toLocaleString()}`;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 font-medium border border-red-300">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 font-medium border border-yellow-300">Medium Priority</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 font-medium border border-gray-300">Low Priority</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 font-medium border">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600 text-white font-medium">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-orange-600 text-white font-medium">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-600 text-white font-medium">Approved</Badge>;
      case 'hold':
        return <Badge className="bg-orange-600 text-white font-medium">On Hold</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600 text-white font-medium">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white font-medium">{status}</Badge>;
    }
  };

  // Calculate metrics from settlement requests
  const requests = (settlementRequests as any[]) || [];
  const pendingRequests = requests.filter((req: any) => req.status === 'pending');
  const totalVolume = requests.reduce((sum: number, req: any) => sum + parseFloat(req.amount || '0'), 0);

  if (isLoading || settlementsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <i className="fas fa-user-shield text-white text-2xl"></i>
          </div>
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

      <div className="p-4">
        {/* System Overview */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Pending Approvals</p>
                  <h3 className="text-2xl font-bold text-warning">{pendingRequests.length}</h3>
                </div>
                <div className="w-10 h-10 bg-warning bg-opacity-10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-clock text-warning"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Total Volume</p>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    {formatCurrency(totalVolume)}
                  </h3>
                </div>
                <div className="w-10 h-10 bg-success bg-opacity-10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-success"></i>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Maker-Checker Queue */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <i className="fas fa-tasks text-red-600 mr-2"></i>
              Maker-Checker Queue
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
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-tasks text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No pending approvals</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Settlement requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request: any) => (
                  <div key={request.id} className={`border-l-4 rounded-lg p-4 shadow-md ${
                    request.priority === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-400' :
                    request.priority === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-400' :
                    'border-gray-400 bg-gray-50 dark:bg-gray-800 dark:border-gray-500'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200">
                          Settlement Request - {request.organizationId ? `Org ${request.organizationId}` : 'Unknown'}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          To: {request.bankName} (****{request.accountNumber.slice(-4)})
                        </p>
                        <p className="text-gray-500 dark:text-gray-500 text-xs">
                          Submitted: {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-gray-800 dark:text-gray-200">
                          {formatCurrency(request.amount)}
                        </p>
                        <div className="flex flex-col items-end space-y-1">
                          {getPriorityBadge(request.priority)}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Only show action buttons for pending requests */}
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
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium"
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

        {/* System Analytics */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
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
