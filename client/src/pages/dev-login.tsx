import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building2, CreditCard, Shield, Users } from "lucide-react";

export default function DevLogin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");

  const loginMutation = useMutation({
    mutationFn: async (role: string) => {
      return await apiRequest("/api/dev-login", "POST", { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Login Successful",
        description: "Redirecting to your dashboard...",
      });
      // Force page refresh to trigger authentication check
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Failed to log in",
        variant: "destructive",
      });
    },
  });

  const handleLogin = () => {
    if (!selectedRole) {
      toast({
        title: "Select Role",
        description: "Please select a role to continue",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(selectedRole);
  };

  const roleIcons = {
    admin: Users,
    finance: Building2,
    merchant: CreditCard,
    cashier: Shield,
  };

  const roleDescriptions = {
    admin: "Full system access and user management",
    finance: "Financial operations and settlement management", 
    merchant: "Transaction processing and business management",
    cashier: "Customer service and transaction support",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Core Banking System</CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            EMI Development Environment
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Your Role</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a role to continue" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleDescriptions).map(([role, description]) => {
                  const Icon = roleIcons[role as keyof typeof roleIcons];
                  return (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium capitalize">{role}</div>
                          <div className="text-xs text-gray-500">{description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleLogin}
            disabled={loginMutation.isPending || !selectedRole}
            className="w-full"
          >
            {loginMutation.isPending ? "Logging in..." : "Access Core Banking"}
          </Button>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Development Environment - Authorized Personnel Only
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}