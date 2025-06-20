import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onAuthChange, signOutUser } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [authState, setAuthState] = useState<any>(null);

  // Listen to Firebase auth state changes
  useEffect(() => {
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
    queryKey: queryKeys.auth.user(),
    queryFn: async () => {
      try {
        // Wait for Firebase auth state to be available
        if (!authState) {
          return null;
        }

        // Get cached token first, only refresh if expired or missing
        let token = localStorage.getItem('firebaseToken');
        
        // Check if we need to refresh the token (only refresh if necessary)
        try {
          if (!token) {
            const cachedToken = await authState.getIdToken(false); // Get cached token first
            if (cachedToken) {
              token = cachedToken;
              localStorage.setItem('firebaseToken', cachedToken);
            }
          }
        } catch (tokenError) {
          // If cached token fails, force refresh with exponential backoff
          console.warn('Token refresh needed:', tokenError);
          const freshToken = await authState.getIdToken(true);
          token = freshToken;
          localStorage.setItem('firebaseToken', freshToken);
        }
        
        if (!token) {
          throw new Error('No authentication token available');
        }

        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Token expired, try one refresh before failing
            try {
              const freshToken = await authState.getIdToken(true);
              localStorage.setItem('firebaseToken', freshToken);
              
              const retryResponse = await fetch('/api/auth/user', {
                headers: {
                  'Authorization': `Bearer ${freshToken}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (retryResponse.ok) {
                return retryResponse.json();
              }
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
            }
            
            localStorage.removeItem('firebaseToken');
            return null;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      } catch (error: any) {
        console.error('Auth query failed:', error);
        // Only clear token on specific auth errors, not network errors
        if (error?.code?.includes('auth/')) {
          localStorage.removeItem('firebaseToken');
        }
        return null;
      }
    },
    retry: (failureCount, error) => {
      // Implement exponential backoff for network errors
      if (error?.code === 'auth/network-request-failed' && failureCount < 3) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff with 30s max
    refetchOnWindowFocus: false,
    enabled: !!authState, // Only run query when Firebase user is available
    staleTime: 60000, // User data is fresh for 1 minute
    gcTime: 300000, // Keep user data in cache for 5 minutes
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
      console.log('Starting logout process...');
      
      // Clear all storage immediately
      localStorage.clear();
      sessionStorage.clear();
      
      // Sign out from Firebase (don't wait)
      signOutUser().catch(() => {});
      
      // Call logout API (don't wait)
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
      
      // Force complete page reload to clear all state
      window.location.replace('/');
      
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout anyway
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/');
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
