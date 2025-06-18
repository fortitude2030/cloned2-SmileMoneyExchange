import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onAuthChange, signOutUser } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/apiClient";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [authState, setAuthState] = useState<any>(null);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser ? 'logged in' : 'logged out');
      setAuthState(firebaseUser);
      setIsLoading(!firebaseUser ? false : true); // Reset loading when auth state changes
    });
    return unsubscribe;
  }, []);

  const { data: user, isLoading: userLoading, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        // Wait for Firebase auth state to be available
        if (!authState) {
          return null;
        }

        // Force refresh the token to ensure it's valid
        const freshToken = await authState.getIdToken(true);
        localStorage.setItem('firebaseToken', freshToken);
        
        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${freshToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('firebaseToken');
            return null;
          }
          throw new Error('Failed to fetch user');
        }
        
        return response.json();
      } catch (error) {
        console.error('Auth query failed:', error);
        localStorage.removeItem('firebaseToken');
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!authState, // Only run query when Firebase user is available
  });

  // Refetch user data when auth state changes
  useEffect(() => {
    if (authState) {
      refetch();
    }
  }, [authState, refetch]);

  useEffect(() => {
    // Set loading based on Firebase auth state and user query loading
    if (authState === null) {
      setIsLoading(true);
    } else if (authState && userLoading) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [authState, userLoading]);

  const signOut = async () => {
    try {
      // Clear Firebase token
      localStorage.removeItem('firebaseToken');
      localStorage.removeItem('auth_token');
      
      // Call logout API
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Redirect to login
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Clear tokens anyway and redirect
      localStorage.removeItem('firebaseToken');
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
  };

  return {
    user,
    firebaseUser: authState,
    isLoading,
    isAuthenticated: !!authState && !!user,
    signOut,
  };
}
