import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { signInUser, createUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!email || !password) || (!isLogin && (!firstName || !lastName))) return;
    
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInUser(email, password);
        toast({
          title: "Welcome back",
          description: "You have been successfully logged in.",
        });
      } else {
        const userCredential = await createUser(email, password);
        // Update the user profile with first and last name
        if (userCredential.user) {
          await userCredential.user.updateProfile({
            displayName: `${firstName} ${lastName}`
          });
        }
        toast({
          title: "Account created",
          description: "Your account has been created successfully. Please wait for admin approval.",
        });
      }
    } catch (error: any) {
      toast({
        title: isLogin ? "Login failed" : "Registration failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required={!isLogin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@testco.com"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-white text-primary hover:bg-white/90 font-semibold py-3"
              disabled={isLoading || !email || !password || (!isLogin && (!firstName || !lastName))}
            >
              {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-white/80 hover:text-white text-sm underline"
            >
              {isLogin ? "Need an account? Register here" : "Already have an account? Sign in"}
            </button>
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