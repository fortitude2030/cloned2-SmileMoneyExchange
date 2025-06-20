import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { apiRequest } from '@/lib/queryClient';
import { transformQueryData, invalidateRelatedQueries, backgroundSync } from '@/lib/queryNormalization';

// Optimized query configurations based on data criticality
const QUERY_CONFIGS = {
  CRITICAL: {
    staleTime: 15000, // 15 seconds
    gcTime: 300000, // 5 minutes
    refetchInterval: 30000, // 30 seconds
  },
  STANDARD: {
    staleTime: 60000, // 1 minute
    gcTime: 600000, // 10 minutes
    refetchInterval: 120000, // 2 minutes
  },
  BACKGROUND: {
    staleTime: 300000, // 5 minutes
    gcTime: 1800000, // 30 minutes
    refetchInterval: 300000, // 5 minutes
  }
};

// Optimized wallet query with intelligent caching
export const useOptimizedWallet = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.wallet.byUser(userId),
    queryFn: async () => {
      const data = await fetch(`/api/wallet/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`
        }
      }).then(res => res.json());
      return transformQueryData.wallet(data);
    },
    enabled: !!userId,
    ...QUERY_CONFIGS.CRITICAL,
    // Deduplicate identical requests
    structuralSharing: true,
    // Intelligent retry logic
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) return false;
      return failureCount < 3;
    }
  });
};

// Optimized transactions query with background prefetching
export const useOptimizedTransactions = (userId: string) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: queryKeys.transactions.byUser(userId),
    queryFn: async () => {
      const data = await fetch(`/api/transactions/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`
        }
      }).then(res => res.json());
      
      // Background sync related data
      backgroundSync.syncUserData(userId);
      
      return transformQueryData.transactions(data);
    },
    enabled: !!userId,
    ...QUERY_CONFIGS.STANDARD,
    // Intelligent stale-while-revalidate pattern
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });
};

// Admin transactions with optimized polling
export const useOptimizedAdminTransactions = () => {
  return useQuery({
    queryKey: queryKeys.admin.transactions(),
    queryFn: async () => {
      const data = await fetch('/api/admin/transactions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`
        }
      }).then(res => res.json());
      return transformQueryData.transactions(data);
    },
    ...QUERY_CONFIGS.STANDARD,
    // Reduce polling frequency for admin views
    refetchInterval: 60000,
    // Smart background updates
    refetchIntervalInBackground: false
  });
};

// Settlement requests with relationship-aware caching
export const useOptimizedSettlementRequests = () => {
  return useQuery({
    queryKey: queryKeys.settlements.requests(),
    queryFn: async () => {
      const data = await fetch('/api/settlement-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`
        }
      }).then(res => res.json());
      return transformQueryData.settlementRequests(data);
    },
    ...QUERY_CONFIGS.STANDARD,
    // Intelligent refresh strategy
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });
};

// Organizations with static data optimization
export const useOptimizedOrganizations = () => {
  return useQuery({
    queryKey: queryKeys.organizations.all(),
    queryFn: async () => {
      return fetch('/api/organizations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`
        }
      }).then(res => res.json());
    },
    ...QUERY_CONFIGS.BACKGROUND,
    // Organizations rarely change, optimize accordingly
    staleTime: 900000, // 15 minutes
    refetchInterval: false
  });
};

// Optimized mutations with smart invalidation
export const useOptimizedPaymentRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { amount: string; vmfNumber: string }) => {
      return apiRequest('POST', '/api/transactions', data);
    },
    onMutate: async (variables) => {
      // Optimistic update for immediate UI feedback
      const userId = localStorage.getItem('currentUserId');
      if (userId) {
        await queryClient.cancelQueries({ queryKey: queryKeys.transactions.byUser(userId) });
        
        // Add optimistic transaction
        const previousTransactions = queryClient.getQueryData(queryKeys.transactions.byUser(userId));
        if (Array.isArray(previousTransactions)) {
          const optimisticTransaction = {
            id: Date.now(),
            transactionId: `PENDING-${Date.now()}`,
            amount: variables.amount,
            status: 'pending' as const,
            fromUserId: userId,
            toUserId: userId,
            description: `Cash digitization - VMF: ${variables.vmfNumber}`,
            createdAt: new Date().toISOString()
          };
          
          queryClient.setQueryData(
            queryKeys.transactions.byUser(userId),
            [optimisticTransaction, ...previousTransactions]
          );
        }
      }
    },
    onSuccess: (data) => {
      // Smart invalidation based on relationships
      invalidateRelatedQueries.onTransactionUpdate(data.userId, data.organizationId);
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      const userId = localStorage.getItem('currentUserId');
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.byUser(userId) });
      }
    }
  });
};

// Settlement processing with cascade invalidation
export const useOptimizedSettlementAction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { settlementId: number; action: string; reason?: string }) => {
      return apiRequest('POST', `/api/admin/settlements/${data.settlementId}/${data.action}`, {
        reason: data.reason
      });
    },
    onSuccess: (data, variables) => {
      // Cascade invalidation for settlement updates
      invalidateRelatedQueries.onSettlementUpdate(data.organizationId, data.userId);
      
      // Background refresh admin data
      backgroundSync.syncAdminData();
    }
  });
};

// User management with selective invalidation
export const useOptimizedUserUpdate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { userId: string; updates: any }) => {
      return apiRequest('PATCH', `/api/admin/users/${data.userId}`, data.updates);
    },
    onSuccess: (data, variables) => {
      // Selective invalidation based on update type
      if (variables.updates.organizationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all() });
      }
      
      if (variables.updates.role) {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      }
      
      // Always invalidate user-specific data
      invalidateRelatedQueries.onWalletUpdate(variables.userId);
    }
  });
};