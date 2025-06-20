import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { cacheWarmingService, backgroundRefreshService } from './cacheWarming';
import { queryBatcher, requestDeduplicator, queryScheduler, connectionManager } from './queryBatching';
import { transformQueryData, invalidateRelatedQueries, backgroundSync } from './queryNormalization';

// Central query coordination system
class QueryCoordinator {
  private isInitialized = false;
  private userContext: {
    userId?: string;
    role?: string;
    organizationId?: number;
    currentRoute?: string;
  } = {};

  // Initialize coordinator with user context
  initialize(userContext: typeof this.userContext) {
    this.userContext = userContext;
    this.isInitialized = true;
    
    // Start cache warming based on user role
    this.warmInitialCache();
    
    // Setup background refresh for critical data
    this.setupBackgroundRefresh();
    
    // Start predictive cache warming
    if (userContext.currentRoute) {
      cacheWarmingService.predictiveWarm(userContext.currentRoute, userContext.role || '');
    }
  }

  // Execute optimized query with full coordination
  async executeOptimizedQuery<T>(
    queryKey: any[],
    queryFn: () => Promise<T>,
    options: {
      priority?: 'high' | 'medium' | 'low';
      enableBatching?: boolean;
      enableDeduplication?: boolean;
      transform?: (data: any) => any;
      invalidationStrategy?: 'immediate' | 'delayed' | 'smart';
    } = {}
  ): Promise<T> {
    const {
      priority = 'medium',
      enableBatching = true,
      enableDeduplication = true,
      transform,
      invalidationStrategy = 'smart'
    } = options;

    const keyString = JSON.stringify(queryKey);
    
    // Check connection and adjust strategy
    const connection = connectionManager.getConnectionStatus();
    if (!connection.isOnline && priority !== 'high') {
      throw new Error('Query requires network connection');
    }

    // Apply deduplication if enabled
    if (enableDeduplication) {
      return requestDeduplicator.deduplicate(keyString, async () => {
        return this.executeWithBatching(queryKey, queryFn, enableBatching, transform);
      });
    }

    return this.executeWithBatching(queryKey, queryFn, enableBatching, transform);
  }

  private async executeWithBatching<T>(
    queryKey: any[],
    queryFn: () => Promise<T>,
    enableBatching: boolean,
    transform?: (data: any) => any
  ): Promise<T> {
    const batchKey = this.getBatchKey(queryKey);
    
    if (enableBatching && this.isBatchable(queryKey)) {
      return queryBatcher.batchRequest(batchKey, async () => {
        const data = await queryFn();
        return transform ? transform(data) : data;
      });
    }

    const data = await queryFn();
    return transform ? transform(data) : data;
  }

  private getBatchKey(queryKey: any[]): string {
    // Group similar queries for batching
    const [endpoint] = queryKey;
    if (typeof endpoint === 'string') {
      if (endpoint.includes('/transactions')) return 'transactions';
      if (endpoint.includes('/wallet')) return 'wallets';
      if (endpoint.includes('/settlement')) return 'settlements';
      if (endpoint.includes('/organizations')) return 'organizations';
    }
    return 'default';
  }

  private isBatchable(queryKey: any[]): boolean {
    const [endpoint] = queryKey;
    return typeof endpoint === 'string' && (
      endpoint.includes('/transactions') ||
      endpoint.includes('/organizations') ||
      endpoint.includes('/users')
    );
  }

  // Smart mutation with coordinated invalidation
  async executeMutation<T>(
    mutationFn: () => Promise<T>,
    options: {
      invalidationRules?: Array<{
        queryKey: any[];
        condition?: (result: T) => boolean;
      }>;
      optimisticUpdate?: {
        queryKey: any[];
        updater: (old: any) => any;
      };
      onSuccess?: (result: T) => void;
    } = {}
  ): Promise<T> {
    const { invalidationRules = [], optimisticUpdate, onSuccess } = options;

    // Apply optimistic update
    let previousData: any;
    if (optimisticUpdate) {
      await queryClient.cancelQueries({ queryKey: optimisticUpdate.queryKey });
      previousData = queryClient.getQueryData(optimisticUpdate.queryKey);
      queryClient.setQueryData(optimisticUpdate.queryKey, optimisticUpdate.updater);
    }

    try {
      const result = await mutationFn();

      // Apply smart invalidation
      invalidationRules.forEach(rule => {
        if (!rule.condition || rule.condition(result)) {
          queryClient.invalidateQueries({ queryKey: rule.queryKey });
        }
      });

      // Execute success callback
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      // Rollback optimistic update on error
      if (optimisticUpdate && previousData !== undefined) {
        queryClient.setQueryData(optimisticUpdate.queryKey, previousData);
      }
      throw error;
    }
  }

  // Intelligent cache warming based on user context
  private warmInitialCache() {
    const { userId, role, organizationId } = this.userContext;

    switch (role) {
      case 'merchant':
        if (userId) {
          cacheWarmingService.warmMerchantCache(userId);
        }
        break;
      case 'admin':
        cacheWarmingService.warmAdminCache();
        break;
      case 'finance':
        if (organizationId) {
          cacheWarmingService.warmFinanceCache(organizationId);
        }
        break;
    }
  }

  // Setup role-based background refresh
  private setupBackgroundRefresh() {
    const { userId, role } = this.userContext;

    if (role === 'merchant' && userId) {
      // Refresh wallet data frequently for merchants
      backgroundRefreshService.startRefresh(
        'merchant-wallet',
        () => this.refreshWalletData(userId),
        30000 // 30 seconds
      );

      // Refresh transactions less frequently
      backgroundRefreshService.startRefresh(
        'merchant-transactions',
        () => this.refreshTransactionData(userId),
        120000 // 2 minutes
      );
    }

    if (role === 'admin') {
      // Refresh settlement requests for admins
      backgroundRefreshService.startRefresh(
        'admin-settlements',
        () => this.refreshSettlementData(),
        60000 // 1 minute
      );
    }
  }

  private async refreshWalletData(userId: string) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.byUser(userId) });
  }

  private async refreshTransactionData(userId: string) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.byUser(userId) });
  }

  private async refreshSettlementData() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.settlements.requests() });
  }

  // Update user context (for route changes, role updates, etc.)
  updateContext(updates: Partial<typeof this.userContext>) {
    this.userContext = { ...this.userContext, ...updates };
    
    // Trigger predictive warming for new route
    if (updates.currentRoute && this.userContext.role) {
      cacheWarmingService.predictiveWarm(updates.currentRoute, this.userContext.role);
    }
  }

  // Clean shutdown
  shutdown() {
    backgroundRefreshService.stopAll();
    queryScheduler.clear();
    this.isInitialized = false;
  }

  // Get coordinator status
  getStatus() {
    return {
      initialized: this.isInitialized,
      userContext: this.userContext,
      cacheWarming: cacheWarmingService.getStatus(),
      connection: connectionManager.getConnectionStatus()
    };
  }
}

export const queryCoordinator = new QueryCoordinator();

// Hooks for optimized queries using the coordinator
export const useCoordinatedQuery = <T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options: {
    priority?: 'high' | 'medium' | 'low';
    enableBatching?: boolean;
    enableDeduplication?: boolean;
    transform?: (data: any) => any;
    staleTime?: number;
    refetchInterval?: number;
  } = {}
) => {
  const {
    priority = 'medium',
    enableBatching = true,
    enableDeduplication = true,
    transform,
    staleTime = 60000,
    refetchInterval
  } = options;

  return {
    queryKey,
    queryFn: () => queryCoordinator.executeOptimizedQuery(
      queryKey,
      queryFn,
      { priority, enableBatching, enableDeduplication, transform }
    ),
    staleTime,
    refetchInterval,
    networkMode: 'online' as const,
    retry: (failureCount: number, error: any) => {
      if (error?.status >= 400 && error?.status < 500) return false;
      return failureCount < (priority === 'high' ? 5 : 3);
    }
  };
};

// Auto-initialization hook
export const useQueryCoordinator = (userContext: {
  userId?: string;
  role?: string;
  organizationId?: number;
  currentRoute?: string;
}) => {
  if (!queryCoordinator.getStatus().initialized) {
    queryCoordinator.initialize(userContext);
  } else {
    queryCoordinator.updateContext(userContext);
  }

  return queryCoordinator;
};