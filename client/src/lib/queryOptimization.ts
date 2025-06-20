import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';

// Query optimization configurations
export const QUERY_CONFIGS = {
  // High-frequency data (balance, active transactions)
  CRITICAL: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds
  },
  
  // Medium-frequency data (transaction history, user data)
  STANDARD: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 60 * 1000, // 1 minute
  },
  
  // Low-frequency data (settings, configurations)
  BACKGROUND: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  },
  
  // Static data (organizations, system configs)
  STATIC: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 15 * 60 * 1000, // 15 minutes
  }
};

// Query invalidation utilities
export const invalidateQueries = {
  // Invalidate user-specific data
  user: (userId?: string) => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.byUser(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.byUser(userId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
  },
  
  // Invalidate transaction-related data
  transactions: (userId?: string) => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.byUser(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.byUser(userId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.transactions() });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  },
  
  // Invalidate settlement data
  settlements: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements.requests() });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements.breakdown() });
  },
  
  // Invalidate organization data
  organizations: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.organizations() });
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all() });
  },
  
  // Invalidate all admin data
  admin: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.transactions() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.organizations() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements.requests() });
  }
};

// Query prefetching utilities
export const prefetchQueries = {
  // Prefetch user data on login
  userSession: async (userId: string) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.wallet(userId),
        queryFn: () => fetch(`/api/wallet/${userId}`).then(res => res.json()),
        ...QUERY_CONFIGS.CRITICAL
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.transactions(userId),
        queryFn: () => fetch(`/api/transactions/${userId}`).then(res => res.json()),
        ...QUERY_CONFIGS.STANDARD
      })
    ]);
  },
  
  // Prefetch admin dashboard data
  adminDashboard: async () => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.admin.transactions(),
        queryFn: () => fetch('/api/admin/transactions').then(res => res.json()),
        ...QUERY_CONFIGS.STANDARD
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.admin.settlements(),
        queryFn: () => fetch('/api/admin/settlements').then(res => res.json()),
        ...QUERY_CONFIGS.STANDARD
      })
    ]);
  }
};

// Cache management utilities
export const cacheManager = {
  // Clear all cached data
  clearAll: () => {
    queryClient.clear();
  },
  
  // Clear user-specific cache on logout
  clearUserData: (userId?: string) => {
    if (userId) {
      queryClient.removeQueries({ queryKey: queryKeys.wallet(userId) });
      queryClient.removeQueries({ queryKey: queryKeys.transactions(userId) });
    }
    queryClient.removeQueries({ queryKey: queryKeys.user() });
  },
  
  // Clear expired cache entries
  clearExpired: () => {
    queryClient.getQueryCache().getAll().forEach(query => {
      if (query.isStale()) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  }
};

// Performance monitoring utilities
export const performanceMonitor = {
  // Log query performance metrics
  logQueryMetrics: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    console.log('Query Performance Metrics:', {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.state.fetchStatus === 'fetching').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      cacheSize: cache.getAll().length
    });
  },
  
  // Monitor memory usage
  getMemoryUsage: () => {
    const cache = queryClient.getQueryCache();
    return {
      queryCount: cache.getAll().length,
      memoryEstimate: cache.getAll().reduce((total, query) => {
        return total + JSON.stringify(query.state.data || {}).length;
      }, 0)
    };
  }
};

// Query retry configuration
export const retryConfig = {
  // Standard retry logic
  standard: {
    retry: (failureCount: number, error: any) => {
      // Don't retry 4xx errors except 429 (rate limit)
      if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000)
  },
  
  // Critical data retry logic (more aggressive)
  critical: {
    retry: (failureCount: number, error: any) => {
      if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
        return false;
      }
      return failureCount < 5;
    },
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 10000)
  }
};

// Export combined optimization utilities
export const queryOptimization = {
  configs: QUERY_CONFIGS,
  invalidate: invalidateQueries,
  prefetch: prefetchQueries,
  cache: cacheManager,
  performance: performanceMonitor,
  retry: retryConfig
};