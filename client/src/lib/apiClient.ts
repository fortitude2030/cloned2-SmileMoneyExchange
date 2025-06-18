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
    // Try with existing token first
    const existingToken = localStorage.getItem('firebaseToken');
    if (existingToken) {
      const response = await makeRequest(existingToken);
      
      // If token is valid, return response
      if (response.ok || response.status !== 401) {
        return response;
      }
    }

    // Token expired or missing, get fresh token
    const currentUser = auth.currentUser;
    if (!currentUser) {
      // User not authenticated, redirect to login
      window.location.href = '/';
      throw new Error('Authentication required');
    }

    // Get fresh token
    const freshToken = await currentUser.getIdToken(true);
    localStorage.setItem('firebaseToken', freshToken);
    
    // Retry request with fresh token
    return await makeRequest(freshToken);
    
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