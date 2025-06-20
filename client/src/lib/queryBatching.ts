import { queryClient } from './queryClient';

// Request batching system to reduce API calls
class QueryBatcher {
  private batchQueue: Map<string, Array<{
    resolver: (data: any) => void;
    rejecter: (error: any) => void;
    timestamp: number;
  }>> = new Map();
  
  private batchTimeout: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_DELAY = 50; // 50ms batching window
  private readonly MAX_BATCH_SIZE = 10;

  // Batch similar requests together
  batchRequest<T>(
    batchKey: string,
    requestFn: () => Promise<T>,
    individualKey?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queue = this.batchQueue.get(batchKey) || [];
      
      queue.push({
        resolver: resolve,
        rejecter: reject,
        timestamp: Date.now()
      });
      
      this.batchQueue.set(batchKey, queue);
      
      // Execute batch if it reaches max size
      if (queue.length >= this.MAX_BATCH_SIZE) {
        this.executeBatch(batchKey, requestFn);
        return;
      }
      
      // Set timeout for batch execution
      if (!this.batchTimeout.has(batchKey)) {
        const timeout = setTimeout(() => {
          this.executeBatch(batchKey, requestFn);
        }, this.BATCH_DELAY);
        
        this.batchTimeout.set(batchKey, timeout);
      }
    });
  }

  private async executeBatch<T>(batchKey: string, requestFn: () => Promise<T>) {
    const queue = this.batchQueue.get(batchKey);
    if (!queue || queue.length === 0) return;
    
    // Clear timeout and queue
    const timeout = this.batchTimeout.get(batchKey);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeout.delete(batchKey);
    }
    this.batchQueue.delete(batchKey);
    
    try {
      const result = await requestFn();
      
      // Resolve all requests in batch with same result
      queue.forEach(({ resolver }) => resolver(result));
    } catch (error) {
      // Reject all requests in batch
      queue.forEach(({ rejecter }) => rejecter(error));
    }
  }

  // Clear expired batch requests
  cleanup() {
    const now = Date.now();
    const EXPIRE_TIME = 5000; // 5 seconds
    
    this.batchQueue.forEach((queue, key) => {
      const validRequests = queue.filter(req => now - req.timestamp < EXPIRE_TIME);
      
      if (validRequests.length === 0) {
        this.batchQueue.delete(key);
        const timeout = this.batchTimeout.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.batchTimeout.delete(key);
        }
      } else {
        this.batchQueue.set(key, validRequests);
      }
    });
  }
}

export const queryBatcher = new QueryBatcher();

// Request deduplication for identical simultaneous requests
class RequestDeduplicator {
  private activeRequests: Map<string, Promise<any>> = new Map();
  
  deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if identical request is already in flight
    if (this.activeRequests.has(key)) {
      return this.activeRequests.get(key) as Promise<T>;
    }
    
    // Execute new request and cache promise
    const promise = requestFn()
      .finally(() => {
        // Remove from active requests when complete
        this.activeRequests.delete(key);
      });
    
    this.activeRequests.set(key, promise);
    return promise;
  }
  
  // Clear stale requests
  cleanup() {
    // Promises automatically clean themselves up via finally block
    // This method exists for potential future enhancements
  }
}

export const requestDeduplicator = new RequestDeduplicator();

// Intelligent query scheduling based on user interaction patterns
class QueryScheduler {
  private scheduledQueries: Map<string, NodeJS.Timeout> = new Map();
  private userActivity = {
    lastInteraction: Date.now(),
    isActive: true,
    activeTab: true
  };

  constructor() {
    // Monitor user activity
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.userActivity.activeTab = !document.hidden;
        this.adjustScheduling();
      });
      
      ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, () => {
          this.userActivity.lastInteraction = Date.now();
          this.userActivity.isActive = true;
          this.adjustScheduling();
        }, { passive: true });
      });
      
      // Check for inactivity
      setInterval(() => {
        const timeSinceLastInteraction = Date.now() - this.userActivity.lastInteraction;
        this.userActivity.isActive = timeSinceLastInteraction < 30000; // 30 seconds
        this.adjustScheduling();
      }, 10000); // Check every 10 seconds
    }
  }

  // Schedule query execution based on priority and user activity
  scheduleQuery(
    key: string,
    queryFn: () => void,
    priority: 'high' | 'medium' | 'low',
    delay?: number
  ) {
    // Clear existing scheduled query
    const existing = this.scheduledQueries.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    
    // Calculate delay based on priority and user activity
    const baseDelay = delay || this.getDelayForPriority(priority);
    const adjustedDelay = this.adjustDelayForActivity(baseDelay);
    
    const timeout = setTimeout(() => {
      queryFn();
      this.scheduledQueries.delete(key);
    }, adjustedDelay);
    
    this.scheduledQueries.set(key, timeout);
  }

  private getDelayForPriority(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 100;
      case 'medium': return 1000;
      case 'low': return 5000;
    }
  }

  private adjustDelayForActivity(baseDelay: number): number {
    if (!this.userActivity.activeTab) {
      return baseDelay * 3; // Slower updates when tab not active
    }
    
    if (!this.userActivity.isActive) {
      return baseDelay * 2; // Slower updates when user inactive
    }
    
    return baseDelay;
  }

  private adjustScheduling() {
    // Reschedule all pending queries based on new activity state
    const currentScheduled = Array.from(this.scheduledQueries.entries());
    
    currentScheduled.forEach(([key, timeout]) => {
      // This would require storing additional metadata about each scheduled query
      // For now, we let existing timeouts complete and new schedules will use adjusted timing
    });
  }

  // Cancel scheduled query
  cancelQuery(key: string) {
    const timeout = this.scheduledQueries.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledQueries.delete(key);
    }
  }

  // Clear all scheduled queries
  clear() {
    this.scheduledQueries.forEach(timeout => clearTimeout(timeout));
    this.scheduledQueries.clear();
  }
}

export const queryScheduler = new QueryScheduler();

// Connection-aware query management
class ConnectionManager {
  private isOnline = navigator.onLine;
  private connectionQuality: 'fast' | 'slow' | 'offline' = 'fast';
  private pendingQueries: Array<() => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushPendingQueries();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.connectionQuality = 'offline';
      });
      
      // Monitor connection quality
      this.monitorConnectionQuality();
    }
  }

  private monitorConnectionQuality() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateConnectionQuality = () => {
        if (!this.isOnline) {
          this.connectionQuality = 'offline';
          return;
        }
        
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g' || effectiveType === '3g') {
          this.connectionQuality = 'fast';
        } else {
          this.connectionQuality = 'slow';
        }
      };
      
      connection.addEventListener('change', updateConnectionQuality);
      updateConnectionQuality();
    }
  }

  // Execute query with connection awareness
  executeWithConnectionAwareness(queryFn: () => void, priority: 'high' | 'medium' | 'low') {
    if (!this.isOnline) {
      if (priority === 'high') {
        this.pendingQueries.unshift(queryFn); // High priority goes first
      } else {
        this.pendingQueries.push(queryFn);
      }
      return;
    }
    
    if (this.connectionQuality === 'slow' && priority === 'low') {
      // Delay low priority queries on slow connections
      setTimeout(queryFn, 2000);
      return;
    }
    
    queryFn();
  }

  private flushPendingQueries() {
    while (this.pendingQueries.length > 0) {
      const queryFn = this.pendingQueries.shift();
      if (queryFn) {
        queryFn();
      }
    }
  }

  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      quality: this.connectionQuality
    };
  }
}

export const connectionManager = new ConnectionManager();

// Cleanup service for all batching systems
export const cleanupBatchingSystems = () => {
  queryBatcher.cleanup();
  requestDeduplicator.cleanup();
  
  // Clean up every 30 seconds
  setInterval(() => {
    queryBatcher.cleanup();
    requestDeduplicator.cleanup();
  }, 30000);
};