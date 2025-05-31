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
import { eq, desc, and } from "drizzle-orm";

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
  updateSpendingLimits(userId: string, amount: number): Promise<void>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUserId(userId: string): Promise<Transaction[]>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  updateTransactionStatus(id: number, status: string): Promise<void>;
  getPendingTransactionsByReceiver(userId: string): Promise<Transaction[]>;
  getAllPendingTransactions(): Promise<Transaction[]>;
  
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
      return existingWallet;
    }

    const [wallet] = await db
      .insert(wallets)
      .values({ userId })
      .returning();
    return wallet;
  }

  async updateWalletBalance(userId: string, balance: string): Promise<void> {
    await db
      .update(wallets)
      .set({ balance, updatedAt: new Date() })
      .where(eq(wallets.userId, userId));
  }

  async checkTransferLimits(userId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    const wallet = await this.getOrCreateWallet(userId);
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Check if wallet is active
    if (!wallet.isActive) {
      return { allowed: false, reason: "Wallet is inactive" };
    }

    // Reset daily spending if it's a new day
    const lastTransaction = wallet.lastTransactionDate;
    const isNewDay = !lastTransaction || 
      lastTransaction.getDate() !== today.getDate() ||
      lastTransaction.getMonth() !== currentMonth ||
      lastTransaction.getFullYear() !== currentYear;

    // Reset monthly spending if it's a new month
    const isNewMonth = !lastTransaction ||
      lastTransaction.getMonth() !== currentMonth ||
      lastTransaction.getFullYear() !== currentYear;

    const currentDailySpent = isNewDay ? 0 : parseFloat(wallet.dailySpent);
    const currentMonthlySpent = isNewMonth ? 0 : parseFloat(wallet.monthlySpent);
    
    const dailyLimit = parseFloat(wallet.dailyLimit);
    const monthlyLimit = parseFloat(wallet.monthlyLimit);

    // Check daily limit
    if (currentDailySpent + amount > dailyLimit) {
      return { 
        allowed: false, 
        reason: `Daily limit exceeded. Limit: ZMW ${dailyLimit.toFixed(2)}, Spent: ZMW ${currentDailySpent.toFixed(2)}` 
      };
    }

    // Check monthly limit
    if (currentMonthlySpent + amount > monthlyLimit) {
      return { 
        allowed: false, 
        reason: `Monthly limit exceeded. Limit: ZMW ${monthlyLimit.toFixed(2)}, Spent: ZMW ${currentMonthlySpent.toFixed(2)}` 
      };
    }

    return { allowed: true };
  }

  async updateSpendingLimits(userId: string, amount: number): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const lastTransaction = wallet.lastTransactionDate;
    const isNewDay = !lastTransaction || 
      lastTransaction.getDate() !== today.getDate() ||
      lastTransaction.getMonth() !== currentMonth ||
      lastTransaction.getFullYear() !== currentYear;

    const isNewMonth = !lastTransaction ||
      lastTransaction.getMonth() !== currentMonth ||
      lastTransaction.getFullYear() !== currentYear;

    const newDailySpent = isNewDay ? amount : parseFloat(wallet.dailySpent) + amount;
    const newMonthlySpent = isNewMonth ? amount : parseFloat(wallet.monthlySpent) + amount;

    await db
      .update(wallets)
      .set({
        dailySpent: newDailySpent.toString(),
        monthlySpent: newMonthlySpent.toString(),
        lastTransactionDate: today,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId));
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
          eq(transactions.toUserId, userId)
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
