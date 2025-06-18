import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onAuthChange, signOutUser } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { apiRequest } from "@/lib/apiClient";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        // Always get fresh token from Firebase Auth
        const currentUser = auth.currentUser;
        if (!currentUser) {
          localStorage.removeItem('firebaseToken');
          return null;
        }

        // Force refresh the token to ensure it's valid
        const freshToken = await currentUser.getIdToken(true);
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
  });

  useEffect(() => {
    setIsLoading(userLoading);
  }, [userLoading]);

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
    firebaseUser: null,
    isLoading,
    isAuthenticated: !!user,
    signOut,
  };
}
