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
import { generateTransactionId } from "./utils";

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
  updateDailyTransactionAmounts(userId: string, amount: number, role: string, transactionType?: string): Promise<void>;
  checkAndResetDailySpending(wallet: Wallet): Promise<void>;
  getTodayTransactionTotals(userId: string): Promise<{ completed: string; total: string }>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUserId(userId: string): Promise<Transaction[]>;
  getAllTransactionsByCashier(userId: string): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  updateTransactionStatus(id: number, status: string, rejectionReason?: string): Promise<void>;
  updateTransactionProcessor(id: number, processorId: string): Promise<void>;
  getPendingTransactionsByReceiver(userId: string): Promise<Transaction[]>;
  getAllPendingTransactions(): Promise<Transaction[]>;
  getQRVerificationTransactions(): Promise<Transaction[]>;
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
        dailyCollected: "0",
        dailyTransferred: "0",
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
      const user = await this.getUser(wallet.userId);
      
      // Reset daily amounts for all users at midnight
      if (user?.role === 'merchant') {
        await db
          .update(wallets)
          .set({
            dailyCollected: "0",
            balance: "0", // Merchant balance resets to 0 at midnight
            lastResetDate: now,
            updatedAt: now,
          })
          .where(eq(wallets.userId, wallet.userId));
      } else if (user?.role === 'cashier') {
        await db
          .update(wallets)
          .set({
            dailyTransferred: "0",
            lastResetDate: now,
            updatedAt: now,
          })
          .where(eq(wallets.userId, wallet.userId));
      }
    }
  }

  async updateWalletBalance(userId: string, balance: string): Promise<void> {
    const preciseBalance = parseFloat(balance).toFixed(2);
    await db
      .update(wallets)
      .set({ balance: preciseBalance, updatedAt: new Date() })
      .where(eq(wallets.userId, userId));
  }

  async checkTransferLimits(userId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    const wallet = await this.getOrCreateWallet(userId);
    const user = await this.getUser(userId);
    
    // Check if wallet is active
    if (!wallet.isActive) {
      return { allowed: false, reason: "Wallet is inactive" };
    }

    // For cashiers - check their balance and daily transfer limits
    if (user?.role === 'cashier') {
      const currentBalance = parseFloat(wallet.balance || '0');
      if (amount > currentBalance) {
        return { 
          allowed: false, 
          reason: `Insufficient cashier balance. Available: ZMW ${currentBalance.toLocaleString()}` 
        };
      }

      const currentDailyTransferred = parseFloat(wallet.dailyTransferred || '0');
      const dailyTransferLimit = 2000000; // ZMW 2,000,000 daily transfer limit for cashiers

      if (currentDailyTransferred + amount > dailyTransferLimit) {
        const remaining = Math.max(dailyTransferLimit - currentDailyTransferred, 0);
        return { 
          allowed: false, 
          reason: `Daily transfer limit exceeded. Remaining: ZMW ${remaining.toLocaleString()}` 
        };
      }
    }

    // For merchants - check their daily collection limit
    if (user?.role === 'merchant') {
      const currentDailyCollected = parseFloat(wallet.dailyCollected || '0');
      const dailyCollectionLimit = 1000000; // ZMW 1,000,000 daily collection limit for merchants

      if (currentDailyCollected + amount > dailyCollectionLimit) {
        const remaining = Math.max(dailyCollectionLimit - currentDailyCollected, 0);
        return { 
          allowed: false, 
          reason: `Daily collection limit exceeded. Remaining: ZMW ${remaining.toLocaleString()}` 
        };
      }
    }

    return { allowed: true };
  }

  async updateDailyTransactionAmounts(userId: string, amount: number, role: string, transactionType?: string): Promise<void> {
    // For merchants - track ALL types of digital money received
    // This includes: QR code payments, RTP (Request to Pay), direct transfers, settlements, etc.
    if (role === 'merchant') {
      const wallet = await this.getOrCreateWallet(userId);
      const currentDailyCollected = Math.round(parseFloat(wallet.dailyCollected || '0'));
      const newDailyCollected = currentDailyCollected + Math.round(amount);

      await db
        .update(wallets)
        .set({
          dailyCollected: newDailyCollected.toString(),
          balance: Math.round(parseFloat(wallet.balance || '0') + amount).toString(),
          lastTransactionDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));
    }
    
    // For cashiers - track daily transfers (money sent)
    if (role === 'cashier') {
      const wallet = await this.getOrCreateWallet(userId);
      const currentDailyTransferred = Math.round(parseFloat(wallet.dailyTransferred || '0'));
      const newDailyTransferred = currentDailyTransferred + Math.round(amount);

      await db
        .update(wallets)
        .set({
          dailyTransferred: newDailyTransferred.toString(),
          balance: Math.round(parseFloat(wallet.balance || '0') - amount).toString(),
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
      completed: Math.round(parseFloat(result?.completed || "0")).toString(),
      total: Math.round(parseFloat(result?.total || "0")).toString()
    };
  }

  // Mark expired pending transactions as expired
  async markExpiredTransactions(): Promise<void> {
    const now = new Date();
    
    // First, get the transactions that will be expired, but exclude those with document uploads
    const expiredTransactions = await db
      .select()
      .from(transactions)
      .leftJoin(documents, eq(documents.transactionId, transactions.id))
      .where(
        and(
          eq(transactions.status, 'pending'),
          sql`expires_at IS NOT NULL AND expires_at <= NOW()`,
          isNull(documents.id) // Only expire transactions with no document uploads
        )
      );
    
    if (expiredTransactions.length > 0) {
      console.log(`Expiring ${expiredTransactions.length} transactions (without documents)`);
      
      // Get the transaction IDs to expire
      const transactionIds = expiredTransactions.map(row => row.transactions.id);
      
      await db
        .update(transactions)
        .set({ 
          status: 'rejected',
          rejectionReason: 'timed out',
          updatedAt: now
        })
        .where(
          and(
            inArray(transactions.id, transactionIds),
            eq(transactions.status, 'pending')
          )
        );
    }
  }

  // Transaction operations
  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    // Check for existing pending transactions from the same user
    const fromUserId = transactionData.fromUserId;
    if (fromUserId) {
      const existingPendingTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.fromUserId, fromUserId),
            eq(transactions.status, 'pending'),
            sql`(expires_at IS NULL OR expires_at > NOW())`
          )
        );

      if (existingPendingTransactions.length > 0) {
        throw new Error('PENDING_TRANSACTION_EXISTS');
      }
    }

    // Generate unique transaction ID with LUS-XXXXXX format
    let transactionId: string;
    let isUnique = false;
    
    // Ensure the transaction ID is unique
    while (!isUnique) {
      transactionId = generateTransactionId();
      const existing = await db
        .select()
        .from(transactions)
        .where(eq(transactions.transactionId, transactionId))
        .limit(1);
      
      isUnique = existing.length === 0;
    }
    
    const [transaction] = await db
      .insert(transactions)
      .values({
        ...transactionData,
        transactionId: transactionId!
      })
      .returning();
    return transaction;
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        and(
          sql`(from_user_id = ${userId} OR to_user_id = ${userId} OR processed_by = ${userId})`,
          sql`(status != 'pending' OR expires_at IS NULL OR expires_at > NOW())`
        )
      )
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactionsByCashier(userId: string): Promise<Transaction[]> {
    // Cashiers see ALL transactions they've been involved with, including rejected/timed-out ones
    return await db
      .select()
      .from(transactions)
      .where(
        sql`(from_user_id = ${userId} OR to_user_id = ${userId} OR processed_by = ${userId})`
      )
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        sql`(status != 'pending' OR expires_at IS NULL OR expires_at > NOW())`
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

  async updateTransactionStatus(id: number, status: string, rejectionReason?: string): Promise<void> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id));
  }

  async updateTransactionProcessor(id: number, processorId: string): Promise<void> {
    await db
      .update(transactions)
      .set({ 
        processedBy: processorId,
        updatedAt: new Date()
      })
      .where(eq(transactions.id, id));
  }

  async getAllPendingTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.status, 'pending'),
          sql`(expires_at IS NULL OR expires_at > NOW())`
        )
      )
      .orderBy(desc(transactions.createdAt));
  }

  async getQRVerificationTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.status, 'qr_verification'))
      .orderBy(desc(transactions.createdAt));
  }

  async getPendingTransactionsByReceiver(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.toUserId, userId),
          eq(transactions.status, "pending"),
          sql`(expires_at IS NULL OR expires_at > NOW())`
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
