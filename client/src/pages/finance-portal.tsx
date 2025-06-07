import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  identifier: z.string().min(1, "Identifier is required"),
  location: z.string().optional(),
});

const settlementSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  priority: z.enum(["low", "medium", "high"]),
});

export default function FinancePortal() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);

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

  // Fetch organization data
  const { data: organizations = [] } = useQuery({
    queryKey: ["/api/organizations"],
    retry: false,
  });

  // Fetch branches
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["/api/branches"],
    retry: false,
  });

  // Fetch wallet
  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
    retry: false,
  });

  // Fetch settlement requests
  const { data: settlementRequests = [], isLoading: settlementsLoading } = useQuery({
    queryKey: ["/api/settlement-requests"],
    retry: false,
  });

  // Branch form
  const branchForm = useForm({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      identifier: "",
      location: "",
    },
  });

  // Settlement form
  const settlementForm = useForm({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      amount: "",
      bankName: "",
      accountNumber: "",
      priority: "medium" as const,
    },
  });

  // Create branch mutation
  const createBranch = useMutation({
    mutationFn: async (data: z.infer<typeof branchSchema>) => {
      await apiRequest("POST", "/api/branches", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branch created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setShowBranchDialog(false);
      branchForm.reset();
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
        description: "Failed to create branch",
        variant: "destructive",
      });
    },
  });

  // Create settlement request mutation
  const createSettlementRequest = useMutation({
    mutationFn: async (data: z.infer<typeof settlementSchema>) => {
      await apiRequest("POST", "/api/settlement-requests", {
        ...data,
        status: "pending",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settlement request created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] });
      setShowSettlementDialog(false);
      settlementForm.reset();
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
        description: "Failed to create settlement request",
        variant: "destructive",
      });
    },
  });

  // Create test settlement requests mutation
  const createTestSettlementRequests = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/dev/settlement-requests", {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test settlement requests created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement-requests"] });
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
        description: "Failed to create test settlement requests",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    return `ZMW ${parseFloat(amount.toString()).toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600 text-white font-medium">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-orange-600 text-white font-medium">Pending Approval</Badge>;
      case 'approved':
        return <Badge className="bg-blue-600 text-white font-medium">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600 text-white font-medium">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white font-medium">{status}</Badge>;
    }
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

  const calculateTotalBalance = () => {
    return branches.reduce((total, branch: any) => total + parseFloat(branch.balance || "0"), 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <i className="fas fa-building text-white text-2xl"></i>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileHeader
        title="Finance Portal"
        subtitle={organizations[0]?.name || "Organization"}
        icon="fas fa-building"
        color="secondary"
      />

      <div className="p-4">
        {/* Organization Overview */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Total Balance</p>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    {formatCurrency(calculateTotalBalance())}
                  </h3>
                </div>
                <div className="w-10 h-10 bg-secondary bg-opacity-10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-wallet text-secondary"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Active Branches</p>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    {branches.filter((b: any) => b.isActive).length}
                  </h3>
                </div>
                <div className="w-10 h-10 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-store text-primary"></i>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Management */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Branch Management</h3>
              <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
                    <i className="fas fa-plus mr-2"></i>Add Branch
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Branch</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={branchForm.handleSubmit((data) => createBranch.mutate(data))} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Branch Name</Label>
                      <Input
                        {...branchForm.register("name")}
                        placeholder="Enter branch name"
                      />
                      {branchForm.formState.errors.name && (
                        <p className="text-sm text-destructive">{branchForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="identifier">Identifier</Label>
                      <Input
                        {...branchForm.register("identifier")}
                        placeholder="e.g., BR-001"
                      />
                      {branchForm.formState.errors.identifier && (
                        <p className="text-sm text-destructive">{branchForm.formState.errors.identifier.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="location">Location (Optional)</Label>
                      <Input
                        {...branchForm.register("location")}
                        placeholder="Enter location"
                      />
                    </div>
                    <Button type="submit" disabled={createBranch.isPending} className="w-full">
                      {createBranch.isPending ? "Creating..." : "Create Branch"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            {branchesLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
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
            ) : branches.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-store text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No branches yet</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Create your first branch to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {branches.map((branch: any) => (
                  <div key={branch.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-success bg-opacity-10 rounded-lg flex items-center justify-center mr-3">
                        <i className="fas fa-store text-success"></i>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{branch.name}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">ID: {branch.identifier}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                        {formatCurrency(branch.balance)}
                      </p>
                      <Badge className={branch.isActive ? "status-completed" : "status-rejected"}>
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settlement Requests */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Settlement Requests</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => createTestSettlementRequests.mutate()}
                  disabled={createTestSettlementRequests.isPending}
                  variant="outline"
                  className="text-xs px-3 py-1"
                >
                  {createTestSettlementRequests.isPending ? "Creating..." : "Add Test Data"}
                </Button>
                <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium">
                      <i className="fas fa-plus mr-2"></i>New Settlement
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Settlement Request</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={settlementForm.handleSubmit((data) => createSettlementRequest.mutate(data))} className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        {...settlementForm.register("amount")}
                        placeholder="Enter amount"
                        type="number"
                      />
                      {settlementForm.formState.errors.amount && (
                        <p className="text-sm text-destructive">{settlementForm.formState.errors.amount.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        {...settlementForm.register("bankName")}
                        placeholder="e.g., Standard Bank"
                      />
                      {settlementForm.formState.errors.bankName && (
                        <p className="text-sm text-destructive">{settlementForm.formState.errors.bankName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        {...settlementForm.register("accountNumber")}
                        placeholder="Enter account number"
                      />
                      {settlementForm.formState.errors.accountNumber && (
                        <p className="text-sm text-destructive">{settlementForm.formState.errors.accountNumber.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={settlementForm.watch("priority")}
                        onValueChange={(value: "low" | "medium" | "high") => settlementForm.setValue("priority", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low Priority</SelectItem>
                          <SelectItem value="medium">Medium Priority</SelectItem>
                          <SelectItem value="high">High Priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={createSettlementRequest.isPending} className="w-full">
                      {createSettlementRequest.isPending ? "Creating..." : "Create Request"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            {settlementsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="w-32 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                        <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      </div>
                      <div className="text-right">
                        <div className="w-20 h-5 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                        <div className="w-16 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                    <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : settlementRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-university text-gray-400 text-xl"></i>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No settlement requests</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">Create your first settlement request</p>
              </div>
            ) : (
              <div className="space-y-3">
                {settlementRequests.map((request: any) => (
                  <div key={request.id} className={`border-2 rounded-lg p-4 shadow-md ${
                    request.status === 'pending' ? 'border-orange-400 bg-orange-50 dark:bg-orange-950 dark:border-orange-600' :
                    request.status === 'approved' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 dark:border-blue-600' :
                    request.status === 'completed' ? 'border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-600' :
                    request.status === 'rejected' ? 'border-red-400 bg-red-50 dark:bg-red-950 dark:border-red-600' :
                    'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Bank Settlement Request</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          To: {request.bankName} - ACC: ****{request.accountNumber.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
                          {formatCurrency(request.amount)}
                        </p>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">
                        Submitted: {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                      {getPriorityBadge(request.priority)}
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
        role="finance"
        tabs={[
          { id: "home", label: "Home", icon: "fas fa-home" },
          { id: "reports", label: "Reports", icon: "fas fa-chart-bar" },
          { id: "settings", label: "Settings", icon: "fas fa-cog" },
        ]}
      />
    </div>
  );
}
