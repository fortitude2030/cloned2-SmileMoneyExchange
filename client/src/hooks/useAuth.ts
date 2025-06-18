import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onAuthChange, signOutUser } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/apiClient";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [authState, setAuthState] = useState<any>(null);
  const [forceLoggedOut, setForceLoggedOut] = useState(false);

  // Listen to Firebase auth state changes
  useEffect(() => {
    // Check for forced logout flag
    const loggedOutFlag = sessionStorage.getItem('forceLoggedOut');
    if (loggedOutFlag === 'true') {
      setForceLoggedOut(true);
      setAuthState(null);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthChange((firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser ? 'logged in' : 'logged out');
      
      setAuthState(firebaseUser);
      
      // If user logs out, clear everything immediately
      if (!firebaseUser) {
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('auth_token');
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const { data: user, isLoading: userLoading, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        // Wait for Firebase auth state to be available
        if (!authState || forceLoggedOut) {
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
    enabled: !!authState && !forceLoggedOut, // Only run query when Firebase user is available and not forced logout
  });

  // Refetch user data when auth state changes
  useEffect(() => {
    if (authState) {
      refetch();
    }
  }, [authState, refetch]);

  useEffect(() => {
    // Set loading based on Firebase auth state and user query loading
    if (forceLoggedOut) {
      setIsLoading(false);
    } else if (authState === null) {
      setIsLoading(true);
    } else if (authState && userLoading) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [authState, userLoading, forceLoggedOut]);

  const signOut = async () => {
    try {
      console.log('Starting logout process...');
      
      // Set forced logout flag
      sessionStorage.setItem('forceLoggedOut', 'true');
      setForceLoggedOut(true);
      
      // Clear all storage immediately
      localStorage.clear();
      
      // Clear auth state immediately
      setAuthState(null);
      setIsLoading(false);
      
      // Sign out from Firebase
      await signOutUser();
      
      // Call logout API (non-blocking)
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
      
      console.log('Logout complete');
      
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout anyway
      sessionStorage.setItem('forceLoggedOut', 'true');
      setForceLoggedOut(true);
      localStorage.clear();
      setAuthState(null);
      setIsLoading(false);
    }
  };

  return {
    user,
    firebaseUser: authState,
    isLoading,
    isAuthenticated: !forceLoggedOut && !!authState && !!user,
    signOut,
  };
}
