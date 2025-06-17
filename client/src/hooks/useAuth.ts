import { useQuery } from "@tanstack/react-query";
import { signInUser, signOutUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const signIn = async (email: string, password: string) => {
    try {
      await signInUser(email, password);
      // The Firebase auth will trigger backend verification
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await signOutUser();
      // Clear backend session
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      window.location.reload();
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signOut
  };
}
