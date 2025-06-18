import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function DevLogin() {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const roles = [
    { 
      id: 'merchant', 
      name: 'Merchant Portal', 
      description: 'Payment requests, QR generation, transaction monitoring',
      icon: 'fas fa-store',
      color: 'bg-blue-600'
    },
    { 
      id: 'cashier', 
      name: 'Cashier Portal', 
      description: 'Transaction processing, QR scanning, cash validation',
      icon: 'fas fa-cash-register',
      color: 'bg-green-600'
    },
    { 
      id: 'finance', 
      name: 'Finance Portal', 
      description: 'Settlement management, merchant monitoring, organization admin',
      icon: 'fas fa-chart-line',
      color: 'bg-purple-600'
    },
    { 
      id: 'admin', 
      name: 'Admin Portal', 
      description: 'Settlement approvals, AML monitoring, regulatory compliance',
      icon: 'fas fa-user-shield',
      color: 'bg-red-600'
    }
  ];

  const handleLogin = async (role: string) => {
    setIsLoading(true);
    try {
      // Clear any existing auth tokens first
      localStorage.removeItem('auth_token');
      localStorage.removeItem('authToken');
      
      const response = await apiRequest('POST', '/api/dev-login', { role });
      
      // Store the authentication token
      localStorage.setItem('authToken', response.token);
      
      toast({
        title: "Login Successful",
        description: `Logged in as ${role}`,
      });
      
      // Redirect to the appropriate dashboard
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
      
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Failed to login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-mobile-alt text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Smile Money Platform
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Development Login - Select a role to test
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <Card 
              key={role.id} 
              className="shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => !isLoading && handleLogin(role.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${role.color} rounded-xl flex items-center justify-center`}>
                    <i className={`${role.icon} text-white text-xl`}></i>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {role.description}
                </p>
                <Button 
                  className={`w-full ${role.color} hover:opacity-90 text-white`}
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogin(role.id);
                  }}
                >
                  {isLoading ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className={`${role.icon} mr-2`}></i>
                  )}
                  Login as {role.name.replace(' Portal', '')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Development Environment - All roles have pre-configured test data
          </p>
        </div>
      </div>
    </div>
  );
}