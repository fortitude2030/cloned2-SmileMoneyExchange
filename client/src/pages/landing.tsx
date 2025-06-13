import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function Landing() {
  const [selectedRole, setSelectedRole] = useState<string>("");

  const handleLogin = async () => {
    if (!selectedRole) return;
    
    try {
      const response = await fetch('/api/dev-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: selectedRole }),
        credentials: 'include',
      });
      
      if (response.ok) {
        window.location.reload();
      } else {
        console.error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardContent className="pt-8 pb-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mb-4">
              <i className="fas fa-mobile-alt text-white text-3xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">EMI Core Banking</h1>
            <p className="text-gray-600 dark:text-gray-400">Electronic Money Institution Platform</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Login As
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merchant">Merchant</SelectItem>
                  <SelectItem value="cashier">Security Cashier</SelectItem>
                  <SelectItem value="finance">Finance Officer</SelectItem>
                  <SelectItem value="admin">Smile Money Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleLogin} 
              className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-semibold"
              disabled={!selectedRole}
            >
              Access Core Banking
            </Button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Electronic Money Institution Platform
            </p>
            <Button 
              onClick={() => window.location.href = "/dev-login"}
              variant="outline"
              className="mt-2 text-sm"
            >
              Banking Operations Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
