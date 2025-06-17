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
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-white/10 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl">🏦</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Testco E-Money</h1>
            <p className="text-white/80">Secure Financial Solutions</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Select Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Choose your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="finance">Finance Officer</SelectItem>
                  <SelectItem value="merchant">Merchant</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleLogin}
              className="w-full bg-white text-primary hover:bg-white/90 font-semibold py-3"
              disabled={!selectedRole}
            >
              Login as {selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : "..."}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm">
              Licensed E-Money Issuer • Bank of Zambia Regulated
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}