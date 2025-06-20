// Centralized query key factory to ensure consistent deduplication
export const queryKeys = {
  // Auth related queries
  auth: {
    user: () => ['auth', 'user'] as const,
  },
  
  // Wallet related queries
  wallet: {
    current: () => ['wallet', 'current'] as const,
    byUser: (userId: string) => ['wallet', 'user', userId] as const,
  },
  
  // Transaction related queries
  transactions: {
    all: () => ['transactions'] as const,
    pending: () => ['transactions', 'pending'] as const,
    qrVerification: () => ['transactions', 'qr-verification'] as const,
    byUser: (userId: string) => ['transactions', 'user', userId] as const,
  },
  
  // Admin queries
  admin: {
    users: () => ['admin', 'users'] as const,
    organizations: () => ['admin', 'organizations'] as const,
    transactions: () => ['admin', 'transactions'] as const,
  },
  
  // Organization queries
  organizations: {
    all: () => ['organizations'] as const,
    byId: (id: number) => ['organizations', id] as const,
    kycDocuments: (id: number) => ['organizations', id, 'kyc-documents'] as const,
  },
  
  // Settlement queries
  settlements: {
    requests: () => ['settlement-requests'] as const,
    breakdown: () => ['settlement-breakdown'] as const,
  },
  
  // Branch queries
  branches: {
    all: () => ['branches'] as const,
  },
  
  // Merchant queries
  merchants: {
    wallets: () => ['merchant-wallets'] as const,
  },
  
  // Compliance queries
  compliance: {
    reports: () => ['compliance', 'reports'] as const,
  },
} as const;

// Helper to invalidate related queries
export const invalidateQueries = {
  auth: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
  },
  
  wallet: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  },
  
  transactions: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  },
  
  organizations: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.organizations() });
  },
};