import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';

// Cache warming strategies based on user role and behavior
class CacheWarmingService {
  private warmingQueue: Map<string, number> = new Map();
  private readonly MAX_CONCURRENT_WARMING = 3;
  private activeWarming = 0;

  // Warm merchant-specific data on login
  async warmMerchantCache(userId: string) {
    if (this.activeWarming >= this.MAX_CONCURRENT_WARMING) return;
    
    this.activeWarming++;
    
    try {
      await Promise.allSettled([
        this.warmWalletData(userId),
        this.warmRecentTransactions(userId),
        this.warmUserProfile(userId)
      ]);
    } finally {
      this.activeWarming--;
    }
  }

  // Warm admin dashboard data
  async warmAdminCache() {
    if (this.activeWarming >= this.MAX_CONCURRENT_WARMING) return;
    
    this.activeWarming++;
    
    try {
      await Promise.allSettled([
        this.warmPendingSettlements(),
        this.warmRecentAdminTransactions(),
        this.warmOrganizationData()
      ]);
    } finally {
      this.activeWarming--;
    }
  }

  // Warm finance portal data
  async warmFinanceCache(organizationId: number) {
    if (this.activeWarming >= this.MAX_CONCURRENT_WARMING) return;
    
    this.activeWarming++;
    
    try {
      await Promise.allSettled([
        this.warmOrganizationTransactions(organizationId),
        this.warmComplianceData(),
        this.warmOrganizationDetails(organizationId)
      ]);
    } finally {
      this.activeWarming--;
    }
  }

  private async warmWalletData(userId: string) {
    const key = `wallet-${userId}`;
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.wallet.byUser(userId),
        queryFn: () => fetch(`/api/wallet/${userId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 30000
      });
    } catch (error) {
      console.warn('Failed to warm wallet cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmRecentTransactions(userId: string) {
    const key = `transactions-${userId}`;
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.transactions.byUser(userId),
        queryFn: () => fetch(`/api/transactions/${userId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 60000
      });
    } catch (error) {
      console.warn('Failed to warm transactions cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmUserProfile(userId: string) {
    const key = `profile-${userId}`;
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.auth.user(),
        queryFn: () => fetch('/api/auth/user', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 300000
      });
    } catch (error) {
      console.warn('Failed to warm profile cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmPendingSettlements() {
    const key = 'pending-settlements';
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.settlements.requests(),
        queryFn: () => fetch('/api/settlement-requests', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 60000
      });
    } catch (error) {
      console.warn('Failed to warm settlements cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmRecentAdminTransactions() {
    const key = 'admin-transactions';
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.admin.transactions(),
        queryFn: () => fetch('/api/admin/transactions', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 120000
      });
    } catch (error) {
      console.warn('Failed to warm admin transactions cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmOrganizationData() {
    const key = 'organizations';
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.organizations.all(),
        queryFn: () => fetch('/api/organizations', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 600000
      });
    } catch (error) {
      console.warn('Failed to warm organizations cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmOrganizationTransactions(organizationId: number) {
    const key = `org-transactions-${organizationId}`;
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: ['organization-transactions', organizationId],
        queryFn: () => fetch(`/api/organizations/${organizationId}/transactions`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 120000
      });
    } catch (error) {
      console.warn('Failed to warm organization transactions cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmComplianceData() {
    const key = 'compliance-reports';
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.compliance.reports(),
        queryFn: () => fetch('/api/compliance/reports', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 300000
      });
    } catch (error) {
      console.warn('Failed to warm compliance cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  private async warmOrganizationDetails(organizationId: number) {
    const key = `org-details-${organizationId}`;
    if (this.warmingQueue.has(key)) return;
    
    this.warmingQueue.set(key, Date.now());
    
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.organizations.byId(organizationId),
        queryFn: () => fetch(`/api/organizations/${organizationId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}` }
        }).then(res => res.json()),
        staleTime: 300000
      });
    } catch (error) {
      console.warn('Failed to warm organization details cache:', error);
    } finally {
      this.warmingQueue.delete(key);
    }
  }

  // Predictive cache warming based on user navigation patterns
  async predictiveWarm(currentRoute: string, userRole: string) {
    switch (currentRoute) {
      case '/merchant':
        if (userRole === 'merchant') {
          // Pre-warm likely next actions
          setTimeout(() => this.warmTransactionHistory(), 2000);
        }
        break;
      
      case '/admin':
        if (userRole === 'admin') {
          // Pre-warm admin sub-sections
          setTimeout(() => this.warmAdminSubsections(), 1500);
        }
        break;
      
      case '/finance':
        if (userRole === 'finance') {
          // Pre-warm finance reports
          setTimeout(() => this.warmFinanceReports(), 2000);
        }
        break;
    }
  }

  private async warmTransactionHistory() {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      await this.warmRecentTransactions(userId);
    }
  }

  private async warmAdminSubsections() {
    await Promise.allSettled([
      this.warmPendingSettlements(),
      this.warmOrganizationData()
    ]);
  }

  private async warmFinanceReports() {
    await this.warmComplianceData();
  }

  // Clear expired warming entries
  cleanup() {
    const now = Date.now();
    const EXPIRE_TIME = 300000; // 5 minutes
    
    this.warmingQueue.forEach((timestamp, key) => {
      if (now - timestamp > EXPIRE_TIME) {
        this.warmingQueue.delete(key);
      }
    });
  }

  // Get warming status
  getStatus() {
    return {
      activeWarming: this.activeWarming,
      queueSize: this.warmingQueue.size,
      maxConcurrent: this.MAX_CONCURRENT_WARMING
    };
  }
}

export const cacheWarmingService = new CacheWarmingService();

// Intelligent background refresh system
class BackgroundRefreshService {
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isVisible = true;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isVisible = !document.hidden;
        this.adjustRefreshRates();
      });
    }
  }

  // Start background refresh for critical data
  startRefresh(key: string, refreshFn: () => Promise<void>, intervalMs: number) {
    this.stopRefresh(key);
    
    const actualInterval = this.isVisible ? intervalMs : intervalMs * 2;
    
    const interval = setInterval(async () => {
      try {
        await refreshFn();
      } catch (error) {
        console.warn(`Background refresh failed for ${key}:`, error);
      }
    }, actualInterval);
    
    this.refreshIntervals.set(key, interval);
  }

  // Stop background refresh
  stopRefresh(key: string) {
    const interval = this.refreshIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(key);
    }
  }

  // Adjust refresh rates based on visibility
  private adjustRefreshRates() {
    // Note: This would require storing the original interval times
    // For now, new refreshes will use the adjusted rate
  }

  // Stop all background refreshes
  stopAll() {
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
  }
}

export const backgroundRefreshService = new BackgroundRefreshService();

// Export cleanup function
export const cleanupCacheServices = () => {
  cacheWarmingService.cleanup();
  backgroundRefreshService.stopAll();
  
  // Run cleanup every 5 minutes
  setInterval(() => {
    cacheWarmingService.cleanup();
  }, 300000);
};