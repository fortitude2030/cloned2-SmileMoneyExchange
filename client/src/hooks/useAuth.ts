import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onAuthChange, signOutUser } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const token = localStorage.getItem('firebaseToken');
      if (!token) return null;
      
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
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
