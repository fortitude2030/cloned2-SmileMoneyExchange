import { auth } from '@/lib/firebase';

export async function apiRequest(url: string, options: RequestInit = {}) {
  const makeRequest = async (token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Handle existing headers properly
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      });
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  try {
    // Smart token management - use cached token first, only refresh when needed
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Try with cached token first
      let token = localStorage.getItem('firebaseToken');
      
      if (!token) {
        // Get cached Firebase token (doesn't force network refresh)
        token = await currentUser.getIdToken(false);
        localStorage.setItem('firebaseToken', token);
      }
      
      try {
        return await makeRequest(token);
      } catch (authError: any) {
        // Only refresh token on 401 errors
        if (authError.message?.includes('401')) {
          try {
            const freshToken = await currentUser.getIdToken(true);
            localStorage.setItem('firebaseToken', freshToken);
            return await makeRequest(freshToken);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            localStorage.removeItem('firebaseToken');
            throw refreshError;
          }
        }
        throw authError;
      }
    }
    
    // For unauthenticated requests, try without token
    return await makeRequest();
    
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

export async function apiRequestWithAuth(url: string, method: string = 'GET', body?: any) {
  const options: RequestInit = {
    method,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return apiRequest(url, options);
}