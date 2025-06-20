import { useState, useEffect } from 'react';
import { queryClient } from '@/lib/queryClient';

interface PerformanceMetrics {
  totalQueries: number;
  activeQueries: number;
  staleQueries: number;
  errorQueries: number;
  memoryEstimate: number;
  lastUpdated: number;
}

export function usePerformanceMonitor(enabled: boolean = false) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const calculateMetrics = (): PerformanceMetrics => {
    const cache = queryClient.getQueryCache();
    const allQueries = cache.getAll();
    
    return {
      totalQueries: allQueries.length,
      activeQueries: allQueries.filter(q => q.state.fetchStatus === 'fetching').length,
      staleQueries: allQueries.filter(q => q.isStale()).length,
      errorQueries: allQueries.filter(q => q.state.status === 'error').length,
      memoryEstimate: allQueries.reduce((total, query) => {
        try {
          return total + JSON.stringify(query.state.data || {}).length;
        } catch {
          return total;
        }
      }, 0),
      lastUpdated: Date.now()
    };
  };

  const refreshMetrics = () => {
    if (enabled) {
      setMetrics(calculateMetrics());
    }
  };

  const clearStaleQueries = () => {
    const cache = queryClient.getQueryCache();
    let clearedCount = 0;
    
    cache.getAll().forEach(query => {
      if (query.isStale()) {
        queryClient.removeQueries({ queryKey: query.queryKey });
        clearedCount++;
      }
    });
    
    refreshMetrics();
    return clearedCount;
  };

  const clearAllCache = () => {
    queryClient.clear();
    refreshMetrics();
  };

  useEffect(() => {
    if (enabled) {
      refreshMetrics();
      const interval = setInterval(refreshMetrics, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [enabled]);

  return {
    metrics,
    refreshMetrics,
    clearStaleQueries,
    clearAllCache,
    isEnabled: enabled
  };
}

// Simple query invalidation helper
export const invalidateUserQueries = (userId?: string) => {
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ['wallet', 'user', userId] });
    queryClient.invalidateQueries({ queryKey: ['transactions', 'user', userId] });
  }
  queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
};

export const invalidateAdminQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['admin'] });
  queryClient.invalidateQueries({ queryKey: ['settlement-requests'] });
  queryClient.invalidateQueries({ queryKey: ['organizations'] });
};