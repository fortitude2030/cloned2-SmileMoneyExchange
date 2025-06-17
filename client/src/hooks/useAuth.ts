import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onAuthChange, signOutUser } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      setIsLoading(false);
      
      if (firebaseUser) {
        // Get Firebase ID token and verify with backend
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch('/api/auth/firebase-verify', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.error('Firebase verification error:', error);
        }
      }
    });

    return unsubscribe;
  }, []);

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      if (!firebaseUser) return null;
      
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch user');
      }
      
      return response.json();
    },
    retry: false,
    enabled: !!firebaseUser,
  });

  const signOut = async () => {
    try {
      await signOutUser();
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      window.location.reload();
    }
  };

  return {
    user,
    firebaseUser,
    isLoading,
    isAuthenticated: !!firebaseUser && !!user,
    signOut,
  };
}
