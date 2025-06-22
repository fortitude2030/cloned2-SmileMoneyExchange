import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';

// Normalized data structures for consistent state management
interface NormalizedTransaction {
  id: number;
  transactionId: string;
  amount: string;
  status: 'pending' | 'completed' | 'rejected' | 'approved';
  fromUserId: string;
  toUserId: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  organizationId?: number;
}

interface NormalizedWallet {
  userId: string;
  balance: string;
  dailyLimit: string;
  dailyCollected: string;
  dailyTransferred: string;
  isActive: boolean;
  todayCompleted: number;
  todayTotal: number;
}

interface NormalizedSettlementRequest {
  id: number;
  organizationId: number;
  userId: string;
  amount: string;
  status: 'pending' | 'approved' | 'rejected' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  reviewedBy?: string;
  rejectionReason?: string;
  holdReason?: string;
}

// Query result normalization utilities
export const normalizeTransactions = (rawTransactions: any[]): NormalizedTransaction[] => {
  if (!Array.isArray(rawTransactions)) return [];
  
  return rawTransactions.map(tx => ({
    id: tx.id,
    transactionId: tx.transactionId || `TX-${tx.id}`,
    amount: String(tx.amount || '0'),
    status: tx.status || 'pending',
    fromUserId: tx.fromUserId || '',
    toUserId: tx.toUserId || '',
    description: tx.description,
    createdAt: tx.createdAt || new Date().toISOString(),
    updatedAt: tx.updatedAt,
    organizationId: tx.organizationId
  }));
};

export const normalizeWallet = (rawWallet: any): NormalizedWallet | null => {
  if (!rawWallet) return null;
  
  return {
    userId: rawWallet.userId || '',
    balance: String(rawWallet.balance || '0'),
    dailyLimit: String(rawWallet.dailyLimit || '0'),
    dailyCollected: String(rawWallet.dailyCollected || '0'),
    dailyTransferred: String(rawWallet.dailyTransferred || '0'),
    isActive: Boolean(rawWallet.isActive),
    todayCompleted: Number(rawWallet.todayCompleted || 0),
    todayTotal: Number(rawWallet.todayTotal || 0)
  };
};

export const normalizeSettlementRequests = (rawRequests: any[]): NormalizedSettlementRequest[] => {
  if (!Array.isArray(rawRequests)) return [];
  
  return rawRequests.map(req => ({
    id: req.id,
    organizationId: req.organizationId,
    userId: req.userId || '',
    amount: String(req.amount || '0'),
    status: req.status || 'pending',
    priority: req.priority || 'medium',
    createdAt: req.createdAt || new Date().toISOString(),
    reviewedBy: req.reviewedBy,
    rejectionReason: req.rejectionReason,
    holdReason: req.holdReason
  }));
};

// Smart cache invalidation based on data relationships
export const invalidateRelatedQueries = {
  // When transaction data changes, invalidate related wallet and admin queries
  onTransactionUpdate: (userId?: string, organizationId?: number) => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.byUser(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.byUser(userId) });
    }
    
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.byId(organizationId) });
    }
    
    // Invalidate admin views
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.transactions() });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements.requests() });
  },
  
  // When wallet balance changes, invalidate transaction and settlement queries
  onWalletUpdate: (userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet.byUser(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.byUser(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements.requests() });
  },
  
  // When settlement status changes, invalidate related organization and transaction data
  onSettlementUpdate: (organizationId: number, userId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements.requests() });
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.byId(organizationId) });
    
    if (userId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.byUser(userId) });
    }
    
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.transactions() });
  }
};

// Query data transformation utilities
export const transformQueryData = {
  // Ensure consistent transaction data structure across different query sources
  transactions: (data: any) => {
    if (Array.isArray(data)) {
      return normalizeTransactions(data);
    }
    return data;
  },
  
  // Normalize wallet data for consistent access patterns
  wallet: (data: any) => {
    return normalizeWallet(data);
  },
  
  // Standardize settlement request data
  settlementRequests: (data: any) => {
    if (Array.isArray(data)) {
      return normalizeSettlementRequests(data);
    }
    return data;
  }
};

// Background query synchronization
export const backgroundSync = {
  // Sync user-specific data in background
  syncUserData: async (userId: string) => {
    try {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: queryKeys.wallet.byUser(userId),
          staleTime: 30000
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.transactions.byUser(userId),
          staleTime: 60000
        })
      ]);
    } catch (error) {
      console.warn('Background sync failed for user data:', error);
    }
  },
  
  // Sync admin dashboard data
  syncAdminData: async () => {
    try {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: queryKeys.admin.transactions(),
          staleTime: 60000
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.settlements.requests(),
          staleTime: 60000
        })
      ]);
    } catch (error) {
      console.warn('Background sync failed for admin data:', error);
    }
  }
};

// Data consistency utilities
export const ensureDataConsistency = {
  // Verify transaction data integrity
  validateTransaction: (transaction: any): boolean => {
    return Boolean(
      transaction &&
      transaction.id &&
      transaction.amount &&
      transaction.status &&
      ['pending', 'completed', 'rejected', 'approved'].includes(transaction.status)
    );
  },
  
  // Verify wallet data integrity
  validateWallet: (wallet: any): boolean => {
    return Boolean(
      wallet &&
      wallet.userId &&
      typeof wallet.balance === 'string' &&
      typeof wallet.isActive === 'boolean'
    );
  },
  
  // Clean invalid data from cache
  cleanInvalidData: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    queries.forEach(query => {
      if (query.state.data) {
        const key = query.queryKey[0];
        
        if (typeof key === 'string' && key.includes('transactions')) {
          const data = query.state.data;
          if (Array.isArray(data)) {
            const validTransactions = data.filter(ensureDataConsistency.validateTransaction);
            if (validTransactions.length !== data.length) {
              queryClient.setQueryData(query.queryKey, validTransactions);
            }
          }
        }
      }
    });
  }
};