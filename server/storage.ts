import {
  users,
  organizations,
  branches,
  wallets,
  transactions,
  documents,
  settlementRequests,
  type User,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type Branch,
  type InsertBranch,
  type Wallet,
  type Transaction,
  type InsertTransaction,
  type Document,
  type InsertDocument,
  type SettlementRequest,
  type InsertSettlementRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lt, sql, or, isNull, gt, not, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizationById(id: number): Promise<Organization | undefined>;
  getOrganizationsByUserId(userId: string): Promise<Organization[]>;
  
  // Branch operations
  createBranch(branch: InsertBranch): Promise<Branch>;
  getBranchesByOrganization(organizationId: number): Promise<Branch[]>;
  updateBranchBalance(branchId: number, balance: string): Promise<void>;
  
  // Wallet operations
  getOrCreateWallet(userId: string): Promise<Wallet>;
  updateWalletBalance(userId: string, balance: string): Promise<void>;
  checkTransferLimits(userId: string, amount: number): Promise<{ allowed: boolean; reason?: string }>;
  updateDailySpending(userId: string, amount: number): Promise<void>;
  checkAndResetDailySpending(wallet: Wallet): Promise<void>;
  getTodayTransactionTotals(userId: string): Promise<{ completed: string; total: string }>;
  setCashierDailyAllocation(userId: string, amount: string): Promise<void>;
  checkCashierBalance(userId: string, requestAmount: number): Promise<{ sufficient: boolean; balance: string }>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUserId(userId: string): Promise<Transaction[]>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  updateTransactionStatus(id: number, status: string): Promise<void>;
  updateTransactionStatusWithReason(id: number, status: string, rejectionReason: string): Promise<void>;
  getPendingTransactionsByReceiver(userId: string): Promise<Transaction[]>;
  getAllPendingTransactions(): Promise<Transaction[]>;
  markExpiredTransactions(): Promise<void>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByTransactionId(transactionId: number): Promise<Document[]>;
  
  // Settlement operations
  createSettlementRequest(request: InsertSettlementRequest): Promise<SettlementRequest>;
  getSettlementRequestsByOrganization(organizationId: number): Promise<SettlementRequest[]>;
  getPendingSettlementRequests(): Promise<SettlementRequest[]>;
  updateSettlementRequestStatus(id: number, status: string, reviewedBy?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Create wallet for new user
    if (user) {
      await this.getOrCreateWallet(user.id);
    }

    return user;
  }

  // Organization operations
  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const [org] = await db
      .insert(organizations)
      .values(orgData)
      .returning();
    return org;
  }

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationsByUserId(userId: string): Promise<Organization[]> {
    const user = await this.getUser(userId);
    if (!user?.organizationId) return [];
    
    const org = await this.getOrganizationById(user.organizationId);
    return org ? [org] : [];
  }

  // Branch operations
  async createBranch(branchData: InsertBranch): Promise<Branch> {
    const [branch] = await db
      .insert(branches)
      .values(branchData)
      .returning();
    return branch;
  }

  async getBranchesByOrganization(organizationId: number): Promise<Branch[]> {
    return await db
      .select()
      .from(branches)
      .where(eq(branches.organizationId, organizationId))
      .orderBy(branches.name);
  }

  async updateBranchBalance(branchId: number, balance: string): Promise<void> {
    await db
      .update(branches)
      .set({ balance, updatedAt: new Date() })
      .where(eq(branches.id, branchId));
  }

  // Wallet operations
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const [existingWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId));

    if (existingWallet) {
      // Check if daily spending needs to be reset
      await this.checkAndResetDailySpending(existingWallet);
      // Re-fetch the wallet after potential reset
      const [updatedWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));
      return updatedWallet || existingWallet;
    }

    const [wallet] = await db
      .insert(wallets)
      .values({ 
        userId,
        balance: "0",
        dailyLimit: "1000000",
        dailySpent: "0",
        lastResetDate: new Date(),
        isActive: true
      })
      .returning();
    return wallet;
  }

  async checkAndResetDailySpending(wallet: Wallet): Promise<void> {
    const now = new Date();
    const lastReset = new Date(wallet.lastResetDate);
    
    // Check if it's a new day (after midnight)
    const isNewDay = now.toDateString() !== lastReset.toDateString();
    
    if (isNewDay) {
      // Only reset daily spending for merchants
      const user = await this.getUser(wallet.userId);
      if (user?.role === 'merchant') {
        await db
          .update(wallets)
          .set({
            dailySpent: "0",
            lastResetDate: now,
            updatedAt: now,
          })
          .where(eq(wallets.userId, wallet.userId));
      }
    }
  }

  async updateWalletBalance(userId: string, balance: string): Promise<void> {
    await db
      .update(wallets)
      .set({ balance, updatedAt: new Date() })
      .where(eq(wallets.userId, userId));
  }

  async checkTransferLimits(userId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    const wallet = await this.getOrCreateWallet(userId);
    const user = await this.getUser(userId);
    
    // Check if wallet is active
    if (!wallet.isActive) {
      return { allowed: false, reason: "Wallet is inactive" };
    }

    // Check wallet balance
    const currentBalance = Math.round(parseFloat(wallet.balance || '0'));
    if (amount > currentBalance) {
      return { 
        allowed: false, 
        reason: `Insufficient wallet balance. Available: ZMW ${currentBalance.toLocaleString()}` 
      };
    }

    // Only check daily limits for merchants
    if (user?.role === 'merchant') {
      const currentDailySpent = Math.round(parseFloat(wallet.dailySpent || '0'));
      const dailyLimit = 1000000; // K1,000,000 limit for merchants

      if (currentDailySpent + amount > dailyLimit) {
        const remaining = Math.max(dailyLimit - currentDailySpent, 0);
        return { 
          allowed: false, 
          reason: `Daily limit exceeded. Remaining: ZMW ${remaining.toLocaleString()}` 
        };
      }
    }

    return { allowed: true };
  }

  async updateDailySpending(userId: string, amount: number): Promise<void> {
    const user = await this.getUser(userId);
    
    // Only track daily spending for merchants
    if (user?.role === 'merchant') {
      const wallet = await this.getOrCreateWallet(userId);
      const currentDailySpent = Math.round(parseFloat(wallet.dailySpent || '0'));
      const newDailySpent = currentDailySpent + Math.round(amount);

      await db
        .update(wallets)
        .set({
          dailySpent: newDailySpent.toString(),
          lastTransactionDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));
    }
  }

  async getTodayTransactionTotals(userId: string): Promise<{ completed: string; total: string }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();

    const [result] = await db
      .select({
        completed: sql<string>`COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(amount AS DECIMAL) ELSE 0 END), 0)`,
        total: sql<string>`COALESCE(SUM(CASE WHEN status IN ('completed', 'pending') AND (expires_at IS NULL OR expires_at > NOW()) THEN CAST(amount AS DECIMAL) ELSE 0 END), 0)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.fromUserId, userId),
          gte(transactions.createdAt, today),
          lt(transactions.createdAt, tomorrow),
          sql`status NOT IN ('rejected', 'failed')`
        )
      );

    return {
      completed: result?.completed || "0",
      total: result?.total || "0"
    };
  }

  async setCashierDailyAllocation(userId: string, amount: string): Promise<void> {
    await db
      .update(wallets)
      .set({ 
        dailyAllocation: amount,
        balance: amount, // Set balance to daily allocation
        dailySpent: "0", // Reset daily spent
        lastResetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(wallets.userId, userId));
  }

  async checkCashierBalance(userId: string, requestAmount: number): Promise<{ sufficient: boolean; balance: string }> {
    const wallet = await this.getOrCreateWallet(userId);
    const currentBalance = parseFloat(wallet.balance);
    
    return {
      sufficient: currentBalance >= requestAmount,
      balance: wallet.balance
    };
  }

  // Mark expired pending transactions as expired
  async markExpiredTransactions(): Promise<void> {
    const now = new Date();
    await db
      .update(transactions)
      .set({ 
        status: 'expired',
        updatedAt: now
      })
      .where(
        and(
          eq(transactions.status, 'pending'),
          sql`expires_at IS NOT NULL AND expires_at <= NOW()`
        )
      );
  }

  // Transaction operations
  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(transactionData)
      .returning();
    return transaction;
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        and(
          sql`(from_user_id = ${userId} OR to_user_id = ${userId})`,
          sql`(status != 'pending' OR expires_at IS NULL OR expires_at > NOW())`
        )
      )
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionById(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction;
  }

  async updateTransactionStatus(id: number, status: string): Promise<void> {
    await db
      .update(transactions)
      .set({ status, updatedAt: new Date() })
      .where(eq(transactions.id, id));
  }

  async updateTransactionStatusWithReason(id: number, status: string, rejectionReason: string): Promise<void> {
    await db
      .update(transactions)
      .set({ status, rejectionReason, updatedAt: new Date() })
      .where(eq(transactions.id, id));
  }

  async getAllPendingTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.status, 'pending'))
      .orderBy(desc(transactions.createdAt));
  }

  async getPendingTransactionsByReceiver(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.toUserId, userId),
          eq(transactions.status, "pending")
        )
      )
      .orderBy(desc(transactions.createdAt));
  }

  // Document operations
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(documentData)
      .returning();
    return document;
  }

  async getDocumentsByTransactionId(transactionId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.transactionId, transactionId));
  }

  // Settlement operations
  async createSettlementRequest(requestData: InsertSettlementRequest): Promise<SettlementRequest> {
    const [request] = await db
      .insert(settlementRequests)
      .values(requestData)
      .returning();
    return request;
  }

  async getSettlementRequestsByOrganization(organizationId: number): Promise<SettlementRequest[]> {
    return await db
      .select()
      .from(settlementRequests)
      .where(eq(settlementRequests.organizationId, organizationId))
      .orderBy(desc(settlementRequests.createdAt));
  }

  async getPendingSettlementRequests(): Promise<SettlementRequest[]> {
    return await db
      .select()
      .from(settlementRequests)
      .where(eq(settlementRequests.status, "pending"))
      .orderBy(settlementRequests.priority, desc(settlementRequests.createdAt));
  }

  async updateSettlementRequestStatus(id: number, status: string, reviewedBy?: string): Promise<void> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
      updateData.reviewedAt = new Date();
    }

    await db
      .update(settlementRequests)
      .set(updateData)
      .where(eq(settlementRequests.id, id));
  }
}

export const storage = new DatabaseStorage();
