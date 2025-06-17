import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const token = localStorage.getItem('authToken');
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      if (!token) return null;
      
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          return null;
        }
        throw new Error('Failed to fetch user');
      }
      
      return response.json();
    },
    retry: false,
    enabled: !!token,
  });

  const signOut = async () => {
    try {
      if (token) {
        await fetch('/api/dev-logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
      localStorage.removeItem('authToken');
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('authToken');
      window.location.reload();
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !!token,
    signOut,
  };
}
