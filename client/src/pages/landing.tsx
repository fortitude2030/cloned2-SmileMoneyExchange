import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { signInUser, createUser, resetPassword } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showRegistration] = useState(false); // Disable self-registration
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInUser(email, password);
        toast({
          title: "Welcome back",
          description: "You have been successfully logged in.",
        });
      } else {
        // Block self-registration
        toast({
          title: "Registration disabled",
          description: "Account registration is disabled. Please contact your administrator for account creation.",
          variant: "destructive",
        });
        return;
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials. Please contact your administrator.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to reset your password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      toast({
        title: "Password reset sent",
        description: "Check your email for password reset instructions.",
      });
      setShowForgotPassword(false);
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to send password reset email.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-4 shadow-2xl bg-gray-800 border-gray-700">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-600 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center shadow-lg">
              <span className="text-3xl">🏦</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Testco E-Money</h1>
            <p className="text-gray-300">Secure Financial Solutions</p>
          </div>

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200 font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@testco.com"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 transition-colors"
                disabled={isLoading || !email}
              >
                {isLoading ? "Sending..." : "Send Reset Email"}
              </Button>

              <Button 
                type="button"
                onClick={() => setShowForgotPassword(false)}
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
              >
                Back to Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200 font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@testco.com"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-gray-200 font-medium">Password</Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 transition-colors"
                disabled={isLoading || !email || !password}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          {!showForgotPassword && (
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Need an account? Contact your administrator
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Licensed E-Money Issuer • Bank of Zambia Regulated
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}