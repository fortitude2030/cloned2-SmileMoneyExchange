import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { queryOptimization } from '@/lib/queryOptimization';
import { queryKeys } from '@/lib/queryKeys';
import { apiRequest } from '@/lib/queryClient';

// Type definitions for optimized queries
type QueryPriority = 'CRITICAL' | 'STANDARD' | 'BACKGROUND' | 'STATIC';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'staleTime' | 'gcTime' | 'refetchInterval' | 'retry' | 'retryDelay'> {
  priority?: QueryPriority;
  enableRetry?: boolean;
}

// Optimized query hook
export function useOptimizedQuery<T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options: OptimizedQueryOptions<T> = {}
) {
  const { priority = 'STANDARD', enableRetry = true, ...restOptions } = options;
  
  const config = queryOptimization.configs[priority];
  const retryConfig = priority === 'CRITICAL' ? 
    queryOptimization.retry.critical : 
    queryOptimization.retry.standard;

  return useQuery({
    queryKey,
    queryFn,
    ...config,
    ...(enableRetry ? retryConfig : { retry: false }),
    ...restOptions,
  });
}

// Optimized mutation hook
export function useOptimizedMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, Error, TVariables> = {}
) {
  return useMutation({
    mutationFn,
    ...queryOptimization.retry.standard,
    ...options,
  });
}

// Specific optimized hooks for common queries
export const useOptimizedWallet = (userId: string) => {
  return useOptimizedQuery(
    queryKeys.wallet(userId),
    () => fetch(`/api/wallet/${userId}`).then(res => res.json()),
    { 
      priority: 'CRITICAL',
      enabled: !!userId 
    }
  );
};

export const useOptimizedTransactions = (userId: string) => {
  return useOptimizedQuery(
    queryKeys.transactions(userId),
    () => fetch(`/api/transactions/${userId}`).then(res => res.json()),
    { 
      priority: 'STANDARD',
      enabled: !!userId 
    }
  );
};

export const useOptimizedAdminTransactions = () => {
  return useOptimizedQuery(
    queryKeys.admin.transactions(),
    () => fetch('/api/admin/transactions').then(res => res.json()),
    { priority: 'STANDARD' }
  );
};

export const useOptimizedSettlements = () => {
  return useOptimizedQuery(
    queryKeys.admin.settlements(),
    () => fetch('/api/admin/settlements').then(res => res.json()),
    { priority: 'STANDARD' }
  );
};

export const useOptimizedSettlementRequests = () => {
  return useOptimizedQuery(
    queryKeys.admin.settlementRequests(),
    () => fetch('/api/admin/settlement-requests').then(res => res.json()),
    { priority: 'STANDARD' }
  );
};

export const useOptimizedOrganizations = () => {
  return useOptimizedQuery(
    queryKeys.admin.organizations(),
    () => fetch('/api/organizations').then(res => res.json()),
    { priority: 'STATIC' }
  );
};

// Mutation hooks with optimized invalidation
export const useCreatePaymentRequest = () => {
  return useOptimizedMutation(
    async (data: { amount: string; vmfNumber: string }) => {
      return apiRequest('/api/payment-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    {
      onSuccess: (data: any) => {
        // Invalidate relevant queries
        queryOptimization.invalidate.transactions(data.userId);
      }
    }
  );
};

export const useProcessSettlement = () => {
  return useOptimizedMutation(
    async (data: { settlementId: number; action: string; reason?: string }) => {
      return apiRequest(`/api/admin/settlements/${data.settlementId}/${data.action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: data.reason }),
      });
    },
    {
      onSuccess: () => {
        // Invalidate settlement-related queries
        queryOptimization.invalidate.settlements();
        queryOptimization.invalidate.admin();
      }
    }
  );
};

export const useUpdateUser = () => {
  return useOptimizedMutation(
    async (data: { userId: string; updates: any }) => {
      return apiRequest(`/api/admin/users/${data.userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      });
    },
    {
      onSuccess: () => {
        queryOptimization.invalidate.admin();
      }
    }
  );
};

export const useCreateOrganization = () => {
  return useOptimizedMutation(
    async (data: any) => {
      return apiRequest('/api/organizations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    {
      onSuccess: () => {
        queryOptimization.invalidate.organizations();
      }
    }
  );
};