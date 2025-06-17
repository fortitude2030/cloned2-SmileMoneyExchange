import {
  users,
  organizations,
  branches,
  wallets,
  transactions,
  documents,
  settlementRequests,
  qrCodes,
  notifications,
  kycDocuments,
  amlConfiguration,
  amlAlerts,
  complianceReports,
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
  type QrCode,
  type InsertQrCode,
  type Notification,
  type InsertNotification,
  type KycDocument,
  type InsertKycDocument,
  type AmlConfiguration,
  type InsertAmlConfiguration,
  type AmlAlert,
  type InsertAmlAlert,
  type ComplianceReport,
  type InsertComplianceReport,
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
  updateOrganization(organizationId: number, data: Partial<InsertOrganization>): Promise<Organization>;
  
  // Branch operations
  createBranch(branch: InsertBranch): Promise<Branch>;
  getBranchesByOrganization(organizationId: number): Promise<Branch[]>;
  updateBranch(branchId: number, data: Partial<InsertBranch>): Promise<Branch>;
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
  updateTransactionPriority(id: number, priority: string): Promise<void>;
  getPendingTransactionsByReceiver(userId: string): Promise<Transaction[]>;
  getAllPendingTransactions(): Promise<Transaction[]>;
  getQRVerificationTransactions(): Promise<Transaction[]>;
  markExpiredTransactions(): Promise<void>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByTransactionId(transactionId: number): Promise<Document[]>;
  
  // Settlement operations
  createSettlementRequest(request: InsertSettlementRequest): Promise<SettlementRequest>;
  getSettlementRequestsByOrganization(organizationId: number): Promise<SettlementRequest[]>;
  getPendingSettlementRequests(): Promise<SettlementRequest[]>;
  getAllSettlementRequests(): Promise<SettlementRequest[]>;
  updateSettlementRequestStatus(id: number, status: string, reviewedBy?: string, holdReason?: string, rejectReason?: string, reasonComment?: string): Promise<void>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
  
  // Finance operations
  getMerchantWalletsByOrganization(organizationId: number): Promise<(Wallet & { user: User })[]>;
  getPendingSettlementsTotal(organizationId: number): Promise<number>;
  getTodaysSettlementUsage(organizationId: number): Promise<number>;
  getSettlementBreakdown(organizationId: number): Promise<{ status: string; total: number; count: number }[]>;
  getMonthlySettlementBreakdown(organizationId: number, period: 'weekly' | 'monthly' | 'yearly'): Promise<{ approved: number; rejected: number; pending: number; approvedCount: number; rejectedCount: number; pendingCount: number }>;
  getTodaysCollectionsByOrganization(organizationId: number): Promise<number>;
  
  // QR Code operations
  createQrCode(qrCodeData: InsertQrCode): Promise<QrCode>;
  getQrCodeByHash(hash: string): Promise<QrCode | undefined>;
  markQrCodeAsUsed(id: number): Promise<void>;
  expungeExpiredQrCodes(): Promise<void>;
  getActiveQrCodeByTransactionId(transactionId: number): Promise<QrCode | undefined>;
  
  // KYC Document operations
  createKycDocument(document: InsertKycDocument): Promise<KycDocument>;
  getKycDocumentsByOrganization(organizationId: number): Promise<KycDocument[]>;
  updateKycDocumentStatus(id: number, status: string, reviewedBy?: string, rejectReason?: string): Promise<void>;
  getAllPendingKycDocuments(): Promise<(KycDocument & { organization: Organization })[]>;
  updateOrganizationKycStatus(organizationId: number, status: string, reviewedBy?: string, rejectReason?: string): Promise<void>;
  
  // AML Configuration operations
  createAmlConfiguration(config: InsertAmlConfiguration): Promise<AmlConfiguration>;
  getAmlConfigurations(): Promise<AmlConfiguration[]>;
  updateAmlConfiguration(id: number, config: Partial<InsertAmlConfiguration>): Promise<void>;
  deleteAmlConfiguration(id: number): Promise<void>;
  
  // AML Alert operations
  createAmlAlert(alert: InsertAmlAlert): Promise<AmlAlert>;
  getAmlAlerts(): Promise<AmlAlert[]>;
  getAmlAlertsByUser(userId: string): Promise<AmlAlert[]>;
  updateAmlAlertStatus(id: number, status: string, reviewedBy?: string, reviewNotes?: string): Promise<void>;
  getPendingAmlAlerts(): Promise<AmlAlert[]>;
  
  // Compliance Report operations
  createComplianceReport(report: InsertComplianceReport): Promise<ComplianceReport>;
  getComplianceReports(): Promise<ComplianceReport[]>;
  getComplianceReportsByType(reportType: string): Promise<ComplianceReport[]>;
  updateComplianceReportStatus(id: number, status: string, submittedAt?: Date): Promise<void>;
  
  // AML Monitoring operations
  checkTransactionForAmlViolations(userId: string, amount: number, transactionId?: number): Promise<AmlAlert[]>;
  getDailyTransactionTotal(userId: string, date: Date): Promise<number>;
  getWeeklyTransactionTotal(userId: string, startDate: Date): Promise<number>;
  generateDailyComplianceReport(date: Date): Promise<ComplianceReport>;
  generateWeeklyComplianceReport(startDate: Date): Promise<ComplianceReport>;
  generateMonthlyRegulatoryReport(month: number, year: number): Promise<ComplianceReport>;
  
  // Admin operations
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getAllOrganizations(): Promise<Organization[]>;
  getApprovedOrganizations(): Promise<Organization[]>;
  toggleUserStatus(userId: string, isActive: boolean): Promise<void>;
  createUserByAdmin(userData: UpsertUser & { phoneNumber?: string; tempPassword?: string }): Promise<User>;
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

  async updateOrganization(organizationId: number, data: Partial<InsertOrganization>): Promise<Organization> {
    // Handle optional fields - convert empty strings to null
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };
    
    if (data.description !== undefined) {
      updateData.description = data.description === "" ? null : data.description;
    }

    const [updatedOrganization] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, organizationId))
      .returning();
    
    if (!updatedOrganization) {
      throw new Error("Organization not found");
    }
    
    return updatedOrganization;
  }

  // Branch operations
  async createBranch(branchData: InsertBranch): Promise<Branch> {
    const branchWithIdentifier = {
      ...branchData,
      identifier: branchData.identifier || `BR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    } as const;
    
    const [branch] = await db
      .insert(branches)
      .values(branchWithIdentifier)
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

  async updateBranch(branchId: number, data: Partial<InsertBranch>): Promise<Branch> {
    // Convert empty strings to null for optional fields
    const updateData: any = {
      ...data,
      updatedAt: new Date()
    };
    
    // Handle optional fields - convert empty strings to null
    if (data.address !== undefined) {
      updateData.address = data.address === "" ? null : data.address;
    }
    if (data.contactPhone !== undefined) {
      updateData.contactPhone = data.contactPhone === "" ? null : data.contactPhone;
    }
    if (data.managerName !== undefined) {
      updateData.managerName = data.managerName === "" ? null : data.managerName;
    }

    const [updatedBranch] = await db
      .update(branches)
      .set(updateData)
      .where(eq(branches.id, branchId))
      .returning();
    
    if (!updatedBranch) {
      throw new Error("Branch not found");
    }
    
    return updatedBranch;
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
    
    // Check if it's a new day (after midnight) - using local date comparison
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastResetDateOnly = new Date(lastReset.getFullYear(), lastReset.getMonth(), lastReset.getDate());
    const isNewDay = nowDateOnly.getTime() !== lastResetDateOnly.getTime();
    
    if (isNewDay) {
      const user = await this.getUser(wallet.userId);
      
      // Reset daily amounts for all users at midnight
      if (user?.role === 'merchant') {
        await db
          .update(wallets)
          .set({
            dailyCollected: "0",
            balance: "0", // Reset display-only balance since actual funds are in finance master wallet
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
    // Use Math.floor to truncate decimals without rounding (183.97 becomes 183, not 184)
    const truncatedBalance = Math.floor(parseFloat(balance)).toString();
    await db
      .update(wallets)
      .set({ balance: truncatedBalance, updatedAt: new Date() })
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
      const merchantUser = await this.getUser(userId);
      const wallet = await this.getOrCreateWallet(userId);
      const currentDailyCollected = parseFloat(wallet.dailyCollected || '0');
      const newDailyCollected = currentDailyCollected + amount;

      // Update merchant wallet (for tracking daily collections - balance is display-only)
      await db
        .update(wallets)
        .set({
          dailyCollected: Math.floor(newDailyCollected).toString(),
          balance: Math.floor(parseFloat(wallet.balance || '0') + amount).toString(), // Display-only tracking
          lastTransactionDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      // Real-time finance aggregation: Transfer to finance master wallet immediately
      if (merchantUser?.organizationId) {
        // Find finance user for this organization
        const [financeUser] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.organizationId, merchantUser.organizationId),
              eq(users.role, 'finance')
            )
          )
          .limit(1);

        if (financeUser) {
          const financeWallet = await this.getOrCreateWallet(financeUser.id);
          const newFinanceBalance = Math.floor(parseFloat(financeWallet.balance || '0') + amount);

          // Add to finance master wallet
          await db
            .update(wallets)
            .set({
              balance: newFinanceBalance.toString(),
              lastTransactionDate: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(wallets.userId, financeUser.id));
        }
      }
    }
    
    // For cashiers - track daily transfers (money sent)
    if (role === 'cashier') {
      const wallet = await this.getOrCreateWallet(userId);
      const currentDailyTransferred = parseFloat(wallet.dailyTransferred || '0');
      const newDailyTransferred = currentDailyTransferred + amount;

      await db
        .update(wallets)
        .set({
          dailyTransferred: Math.floor(newDailyTransferred).toString(),
          balance: Math.floor(parseFloat(wallet.balance || '0') - amount).toString(),
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
      completed: Math.floor(parseFloat(result?.completed || "0")).toString(),
      total: Math.floor(parseFloat(result?.total || "0")).toString()
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

  async updateTransactionPriority(id: number, priority: string): Promise<void> {
    await db
      .update(transactions)
      .set({ 
        priority,
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

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
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

  async getAllSettlementRequests(): Promise<SettlementRequest[]> {
    return await db
      .select()
      .from(settlementRequests)
      .orderBy(desc(settlementRequests.createdAt))
      .limit(50); // Show last 50 requests to avoid overwhelming the admin
  }

  async updateSettlementRequestStatus(id: number, status: string, reviewedBy?: string, holdReason?: string, rejectReason?: string, reasonComment?: string): Promise<void> {
    // Get the settlement request details before updating
    const [settlementRequest] = await db
      .select()
      .from(settlementRequests)
      .where(eq(settlementRequests.id, id))
      .limit(1);

    if (!settlementRequest) {
      throw new Error("Settlement request not found");
    }

    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
      updateData.reviewedAt = new Date();
    }

    if (holdReason) {
      updateData.holdReason = holdReason;
      if (reasonComment) {
        updateData.reasonComment = reasonComment;
      }
    }

    if (rejectReason) {
      updateData.rejectReason = rejectReason;
      if (reasonComment) {
        updateData.reasonComment = reasonComment;
      }
    }

    // Update settlement request status
    await db
      .update(settlementRequests)
      .set(updateData)
      .where(eq(settlementRequests.id, id));

    // Create notification for status change
    await this.createNotification({
      userId: settlementRequest.userId,
      type: "settlement_status_change",
      title: `Settlement Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: this.getSettlementStatusMessage(status, holdReason, rejectReason, reasonComment),
      relatedEntityType: "settlement_request",
      relatedEntityId: id,
    });

    // If settlement is approved or completed, deduct from finance master wallet
    if ((status === 'approved' || status === 'completed') && settlementRequest.status === 'pending') {
      // Find finance user for this organization
      const [financeUser] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.organizationId, settlementRequest.organizationId),
            eq(users.role, 'finance')
          )
        )
        .limit(1);

      if (financeUser) {
        const financeWallet = await this.getOrCreateWallet(financeUser.id);
        const currentBalance = Math.floor(parseFloat(financeWallet.balance || '0'));
        const settlementAmount = Math.floor(parseFloat(settlementRequest.amount));
        
        // Validate sufficient funds
        if (currentBalance < settlementAmount) {
          throw new Error(`Insufficient funds: Available ZMW ${currentBalance}, Requested ZMW ${settlementAmount}`);
        }

        const newBalance = currentBalance - settlementAmount;

        // Deduct settlement amount from finance master wallet
        await db
          .update(wallets)
          .set({
            balance: newBalance.toString(),
            lastTransactionDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, financeUser.id));
      }
    }
  }

  // QR Code operations
  async createQrCode(qrCodeData: InsertQrCode): Promise<QrCode> {
    const [qrCode] = await db
      .insert(qrCodes)
      .values(qrCodeData)
      .returning();
    return qrCode;
  }

  async getQrCodeByHash(hash: string): Promise<QrCode | undefined> {
    const [qrCode] = await db
      .select()
      .from(qrCodes)
      .where(and(
        eq(qrCodes.qrCodeHash, hash),
        eq(qrCodes.isUsed, false),
        gt(qrCodes.expiresAt, new Date())
      ));
    return qrCode;
  }

  async markQrCodeAsUsed(id: number): Promise<void> {
    await db
      .update(qrCodes)
      .set({ 
        isUsed: true, 
        usedAt: new Date() 
      })
      .where(eq(qrCodes.id, id));
  }

  async expungeExpiredQrCodes(): Promise<void> {
    // Delete all expired or used QR codes from the database
    await db
      .delete(qrCodes)
      .where(or(
        eq(qrCodes.isUsed, true),
        lt(qrCodes.expiresAt, new Date())
      ));
  }

  async getActiveQrCodeByTransactionId(transactionId: number): Promise<QrCode | undefined> {
    const [qrCode] = await db
      .select()
      .from(qrCodes)
      .where(and(
        eq(qrCodes.transactionId, transactionId),
        eq(qrCodes.isUsed, false),
        gt(qrCodes.expiresAt, new Date())
      ));
    return qrCode;
  }

  async getMerchantWalletsByOrganization(organizationId: number): Promise<(Wallet & { user: User })[]> {
    const merchantWallets = await db
      .select({
        id: wallets.id,
        userId: wallets.userId,
        balance: wallets.balance,
        dailyLimit: wallets.dailyLimit,
        dailyCollected: wallets.dailyCollected,
        dailyTransferred: wallets.dailyTransferred,
        lastResetDate: wallets.lastResetDate,
        lastTransactionDate: wallets.lastTransactionDate,
        isActive: wallets.isActive,
        createdAt: wallets.createdAt,
        updatedAt: wallets.updatedAt,
        user: users
      })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'merchant')
        )
      );

    return merchantWallets;
  }

  async getPendingSettlementsTotal(organizationId: number): Promise<number> {
    const processingRequests = await db
      .select({
        amount: settlementRequests.amount
      })
      .from(settlementRequests)
      .where(
        and(
          eq(settlementRequests.organizationId, organizationId),
          or(
            eq(settlementRequests.status, 'pending'),
            eq(settlementRequests.status, 'hold')
          )
        )
      );

    const total = processingRequests.reduce((sum, request) => 
      sum + Math.floor(parseFloat(request.amount || '0')), 0);
    
    return total;
  }

  async getTodaysSettlementUsage(organizationId: number): Promise<number> {
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all settlements from today (pending, hold, and approved)
    const todaysRequests = await db
      .select({
        amount: settlementRequests.amount
      })
      .from(settlementRequests)
      .where(
        and(
          eq(settlementRequests.organizationId, organizationId),
          gte(settlementRequests.createdAt, today),
          or(
            eq(settlementRequests.status, 'pending'),
            eq(settlementRequests.status, 'hold'),
            eq(settlementRequests.status, 'approved')
          )
        )
      );

    const total = todaysRequests.reduce((sum, request) => 
      sum + Math.floor(parseFloat(request.amount || '0')), 0);
    
    return total;
  }

  async getSettlementBreakdown(organizationId: number): Promise<{ status: string; total: number; count: number }[]> {
    // Calculate start of current month for filtering
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get all requests for non-monthly statuses (pending, hold, completed)
    const allTimeRequests = await db
      .select({
        status: settlementRequests.status,
        amount: settlementRequests.amount,
        createdAt: settlementRequests.createdAt
      })
      .from(settlementRequests)
      .where(
        and(
          eq(settlementRequests.organizationId, organizationId),
          not(inArray(settlementRequests.status, ['approved', 'rejected']))
        )
      );

    // Get current month requests for approved and rejected
    const monthlyRequests = await db
      .select({
        status: settlementRequests.status,
        amount: settlementRequests.amount,
        createdAt: settlementRequests.createdAt
      })
      .from(settlementRequests)
      .where(
        and(
          eq(settlementRequests.organizationId, organizationId),
          inArray(settlementRequests.status, ['approved', 'rejected']),
          gte(settlementRequests.createdAt, startOfMonth)
        )
      );

    // Combine both datasets
    const combinedRequests = [...allTimeRequests, ...monthlyRequests];

    // Group by status and calculate totals
    const breakdown = combinedRequests.reduce((acc, request) => {
      const status = request.status;
      const amount = Math.floor(parseFloat(request.amount || '0'));
      
      if (!acc[status]) {
        acc[status] = { status, total: 0, count: 0 };
      }
      
      acc[status].total += amount;
      acc[status].count += 1;
      
      return acc;
    }, {} as Record<string, { status: string; total: number; count: number }>);

    return Object.values(breakdown);
  }

  async getMonthlySettlementBreakdown(organizationId: number, period: 'weekly' | 'monthly' | 'yearly'): Promise<{ approved: number; rejected: number; pending: number; approvedCount: number; rejectedCount: number; pendingCount: number }> {
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get settlement requests within the period
    const requests = await db
      .select({
        status: settlementRequests.status,
        amount: settlementRequests.amount,
      })
      .from(settlementRequests)
      .where(
        and(
          eq(settlementRequests.organizationId, organizationId),
          gte(settlementRequests.createdAt, startDate)
        )
      );

    // Calculate totals by status
    const breakdown = {
      approved: 0,
      rejected: 0,
      pending: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
    };

    requests.forEach(request => {
      const amount = Math.floor(parseFloat(request.amount || '0'));
      
      switch (request.status) {
        case 'approved':
          breakdown.approved += amount;
          breakdown.approvedCount++;
          break;
        case 'rejected':
          breakdown.rejected += amount;
          breakdown.rejectedCount++;
          break;
        case 'pending':
        case 'hold':
          breakdown.pending += amount;
          breakdown.pendingCount++;
          break;
      }
    });

    return breakdown;
  }

  async getTodaysCollectionsByOrganization(organizationId: number): Promise<number> {
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all merchant wallets for this organization
    const merchantWallets = await db
      .select({
        dailyCollected: wallets.dailyCollected
      })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'merchant')
        )
      );

    // Sum up all daily collections from merchants
    const todaysTotal = merchantWallets.reduce((sum, wallet) => 
      sum + Math.floor(parseFloat(wallet.dailyCollected || '0')), 0);
    
    return todaysTotal;
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  // KYC Document operations
  async createKycDocument(documentData: InsertKycDocument): Promise<KycDocument> {
    const [document] = await db
      .insert(kycDocuments)
      .values(documentData)
      .returning();
    return document;
  }

  async getKycDocumentsByOrganization(organizationId: number): Promise<KycDocument[]> {
    return await db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.organizationId, organizationId))
      .orderBy(kycDocuments.createdAt);
  }

  async updateKycDocumentStatus(id: number, status: string, reviewedBy?: string, rejectReason?: string): Promise<void> {
    const updateData: any = {
      status,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    };

    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
    }

    if (rejectReason) {
      updateData.rejectReason = rejectReason;
    }

    await db
      .update(kycDocuments)
      .set(updateData)
      .where(eq(kycDocuments.id, id));
  }

  async getAllPendingKycDocuments(): Promise<(KycDocument & { organization: Organization })[]> {
    return await db
      .select({
        id: kycDocuments.id,
        organizationId: kycDocuments.organizationId,
        documentType: kycDocuments.documentType,
        fileName: kycDocuments.fileName,
        filePath: kycDocuments.filePath,
        fileSize: kycDocuments.fileSize,
        uploadedBy: kycDocuments.uploadedBy,
        status: kycDocuments.status,
        reviewedBy: kycDocuments.reviewedBy,
        reviewedAt: kycDocuments.reviewedAt,
        rejectReason: kycDocuments.rejectReason,
        createdAt: kycDocuments.createdAt,
        updatedAt: kycDocuments.updatedAt,
        organization: organizations,
      })
      .from(kycDocuments)
      .innerJoin(organizations, eq(kycDocuments.organizationId, organizations.id))
      .where(eq(kycDocuments.status, 'pending'))
      .orderBy(kycDocuments.createdAt);
  }

  async updateOrganizationKycStatus(organizationId: number, status: string, reviewedBy?: string, rejectReason?: string): Promise<void> {
    const updateData: any = {
      kycStatus: status,
      updatedAt: new Date(),
    };

    if (status === 'approved') {
      updateData.kycCompletedAt = new Date();
    }

    if (reviewedBy) {
      updateData.kycReviewedBy = reviewedBy;
    }

    if (rejectReason) {
      updateData.kycRejectReason = rejectReason;
    }

    await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, organizationId));
  }

  // Admin operations
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user || undefined;
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber))
      .limit(1);
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db
      .select()
      .from(organizations)
      .orderBy(desc(organizations.createdAt));
  }

  async getApprovedOrganizations(): Promise<Organization[]> {
    return await db
      .select()
      .from(organizations)
      .where(eq(organizations.kycStatus, 'approved'))
      .orderBy(organizations.name);
  }

  async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
    await db
      .update(users)
      .set({ 
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async createUserByAdmin(userData: UpsertUser & { phoneNumber?: string; tempPassword?: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  // AML Configuration operations
  async createAmlConfiguration(configData: InsertAmlConfiguration): Promise<AmlConfiguration> {
    const [config] = await db
      .insert(amlConfiguration)
      .values(configData)
      .returning();
    return config;
  }

  async getAmlConfigurations(): Promise<AmlConfiguration[]> {
    return await db
      .select()
      .from(amlConfiguration)
      .where(eq(amlConfiguration.isActive, true))
      .orderBy(amlConfiguration.configType);
  }

  async updateAmlConfiguration(id: number, configData: Partial<InsertAmlConfiguration>): Promise<void> {
    await db
      .update(amlConfiguration)
      .set({ ...configData, updatedAt: new Date() })
      .where(eq(amlConfiguration.id, id));
  }

  async deleteAmlConfiguration(id: number): Promise<void> {
    await db
      .update(amlConfiguration)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(amlConfiguration.id, id));
  }

  // AML Alert operations
  async createAmlAlert(alertData: InsertAmlAlert): Promise<AmlAlert> {
    const [alert] = await db
      .insert(amlAlerts)
      .values(alertData)
      .returning();
    return alert;
  }

  async getAmlAlerts(): Promise<AmlAlert[]> {
    return await db
      .select()
      .from(amlAlerts)
      .orderBy(desc(amlAlerts.flaggedAt))
      .limit(100);
  }

  async getAmlAlertsByUser(userId: string): Promise<AmlAlert[]> {
    return await db
      .select()
      .from(amlAlerts)
      .where(eq(amlAlerts.userId, userId))
      .orderBy(desc(amlAlerts.flaggedAt));
  }

  async updateAmlAlertStatus(id: number, status: string, reviewedBy?: string, reviewNotes?: string): Promise<void> {
    const updateData: any = { status };
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
      updateData.reviewedAt = new Date();
    }
    
    if (reviewNotes) {
      updateData.reviewNotes = reviewNotes;
    }

    await db
      .update(amlAlerts)
      .set(updateData)
      .where(eq(amlAlerts.id, id));
  }

  async getPendingAmlAlerts(): Promise<AmlAlert[]> {
    return await db
      .select()
      .from(amlAlerts)
      .where(eq(amlAlerts.status, 'pending'))
      .orderBy(desc(amlAlerts.riskScore), desc(amlAlerts.flaggedAt));
  }

  // Compliance Report operations
  async createComplianceReport(reportData: InsertComplianceReport): Promise<ComplianceReport> {
    const [report] = await db
      .insert(complianceReports)
      .values(reportData)
      .returning();
    return report;
  }

  async getComplianceReports(): Promise<ComplianceReport[]> {
    return await db
      .select()
      .from(complianceReports)
      .orderBy(desc(complianceReports.createdAt));
  }

  async getComplianceReportsByType(reportType: string): Promise<ComplianceReport[]> {
    return await db
      .select()
      .from(complianceReports)
      .where(eq(complianceReports.reportType, reportType))
      .orderBy(desc(complianceReports.createdAt));
  }

  async updateComplianceReportStatus(id: number, status: string, submittedAt?: Date): Promise<void> {
    const updateData: any = { status };
    
    if (submittedAt) {
      updateData.submittedAt = submittedAt;
    }

    await db
      .update(complianceReports)
      .set(updateData)
      .where(eq(complianceReports.id, id));
  }

  // AML Monitoring operations
  async checkTransactionForAmlViolations(userId: string, amount: number, transactionId?: number): Promise<AmlAlert[]> {
    const alerts: AmlAlert[] = [];
    const configs = await this.getAmlConfigurations();
    
    for (const config of configs) {
      const threshold = parseFloat(config.thresholdAmount);
      
      if (config.configType === 'single_transaction' && amount > threshold) {
        const alert = await this.createAmlAlert({
          userId,
          transactionId,
          alertType: 'threshold_exceeded',
          riskScore: Math.min(100, Math.floor((amount / threshold) * 50)),
          triggerAmount: amount.toString(),
          thresholdAmount: config.thresholdAmount,
          description: `Single transaction amount (${amount} ZMW) exceeds threshold (${threshold} ZMW)`,
        });
        alerts.push(alert);
      }
      
      if (config.configType === 'daily_total') {
        const today = new Date();
        const dailyTotal = await this.getDailyTransactionTotal(userId, today);
        
        if (dailyTotal + amount > threshold) {
          const alert = await this.createAmlAlert({
            userId,
            transactionId,
            alertType: 'threshold_exceeded',
            riskScore: Math.min(100, Math.floor(((dailyTotal + amount) / threshold) * 40)),
            triggerAmount: (dailyTotal + amount).toString(),
            thresholdAmount: config.thresholdAmount,
            description: `Daily transaction total (${dailyTotal + amount} ZMW) exceeds threshold (${threshold} ZMW)`,
          });
          alerts.push(alert);
        }
      }
      
      if (config.configType === 'weekly_volume') {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weeklyTotal = await this.getWeeklyTransactionTotal(userId, weekStart);
        
        if (weeklyTotal + amount > threshold) {
          const alert = await this.createAmlAlert({
            userId,
            transactionId,
            alertType: 'threshold_exceeded',
            riskScore: Math.min(100, Math.floor(((weeklyTotal + amount) / threshold) * 30)),
            triggerAmount: (weeklyTotal + amount).toString(),
            thresholdAmount: config.thresholdAmount,
            description: `Weekly transaction volume (${weeklyTotal + amount} ZMW) exceeds threshold (${threshold} ZMW)`,
          });
          alerts.push(alert);
        }
      }
    }
    
    return alerts;
  }

  async getDailyTransactionTotal(userId: string, date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.fromUserId, userId),
          eq(transactions.status, 'completed'),
          gte(transactions.createdAt, startOfDay),
          lte(transactions.createdAt, endOfDay)
        )
      );

    return parseFloat(result[0]?.total || '0');
  }

  async getWeeklyTransactionTotal(userId: string, startDate: Date): Promise<number> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.fromUserId, userId),
          eq(transactions.status, 'completed'),
          gte(transactions.createdAt, startDate),
          lt(transactions.createdAt, endDate)
        )
      );

    return parseFloat(result[0]?.total || '0');
  }

  async generateDailyComplianceReport(date: Date): Promise<ComplianceReport> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get transaction summary
    const transactionStats = await db
      .select({
        count: sql<string>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`,
        avgAmount: sql<string>`COALESCE(AVG(CAST(${transactions.amount} AS DECIMAL)), 0)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.status, 'completed'),
          gte(transactions.createdAt, startOfDay),
          lte(transactions.createdAt, endOfDay)
        )
      );

    // Get alerts generated today
    const alertStats = await db
      .select({
        count: sql<string>`COUNT(*)`,
        highRisk: sql<string>`COUNT(CASE WHEN ${amlAlerts.riskScore} >= 70 THEN 1 END)`,
        mediumRisk: sql<string>`COUNT(CASE WHEN ${amlAlerts.riskScore} BETWEEN 40 AND 69 THEN 1 END)`,
        lowRisk: sql<string>`COUNT(CASE WHEN ${amlAlerts.riskScore} < 40 THEN 1 END)`
      })
      .from(amlAlerts)
      .where(
        and(
          gte(amlAlerts.flaggedAt, startOfDay),
          lte(amlAlerts.flaggedAt, endOfDay)
        )
      );

    const reportData = {
      date: date.toISOString().split('T')[0],
      transactions: {
        count: parseInt(transactionStats[0]?.count || '0'),
        totalAmount: parseFloat(transactionStats[0]?.total || '0'),
        averageAmount: parseFloat(transactionStats[0]?.avgAmount || '0')
      },
      alerts: {
        total: parseInt(alertStats[0]?.count || '0'),
        highRisk: parseInt(alertStats[0]?.highRisk || '0'),
        mediumRisk: parseInt(alertStats[0]?.mediumRisk || '0'),
        lowRisk: parseInt(alertStats[0]?.lowRisk || '0')
      }
    };

    return await this.createComplianceReport({
      reportType: 'daily_summary',
      reportPeriod: date.toISOString().split('T')[0],
      generatedBy: 'system',
      reportData
    });
  }

  async generateWeeklyComplianceReport(startDate: Date): Promise<ComplianceReport> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    // Get high-risk alerts for the week
    const highRiskAlerts = await db
      .select()
      .from(amlAlerts)
      .where(
        and(
          gte(amlAlerts.flaggedAt, startDate),
          lt(amlAlerts.flaggedAt, endDate),
          gte(amlAlerts.riskScore, 70)
        )
      );

    // Get transaction volume by type
    const transactionTypes = await db
      .select({
        type: transactions.type,
        count: sql<string>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.status, 'completed'),
          gte(transactions.createdAt, startDate),
          lt(transactions.createdAt, endDate)
        )
      )
      .groupBy(transactions.type);

    const reportData = {
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      highRiskAlerts: highRiskAlerts.length,
      transactionBreakdown: transactionTypes.map(t => ({
        type: t.type,
        count: parseInt(t.count),
        totalAmount: parseFloat(t.total)
      })),
      suspiciousPatterns: highRiskAlerts.map(alert => ({
        userId: alert.userId,
        alertType: alert.alertType,
        riskScore: alert.riskScore,
        amount: alert.triggerAmount
      }))
    };

    return await this.createComplianceReport({
      reportType: 'weekly_compliance',
      reportPeriod: `${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}`,
      generatedBy: 'system',
      reportData
    });
  }

  async generateMonthlyRegulatoryReport(month: number, year: number): Promise<ComplianceReport> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get comprehensive statistics for Bank of Zambia
    const monthlyStats = await db
      .select({
        totalTransactions: sql<string>`COUNT(*)`,
        totalVolume: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS DECIMAL)), 0)`,
        uniqueUsers: sql<string>`COUNT(DISTINCT ${transactions.fromUserId})`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.status, 'completed'),
          gte(transactions.createdAt, startDate),
          lte(transactions.createdAt, endDate)
        )
      );

    // Get all alerts flagged during the month
    const monthlyAlerts = await db
      .select({
        total: sql<string>`COUNT(*)`,
        resolved: sql<string>`COUNT(CASE WHEN ${amlAlerts.status} = 'cleared' THEN 1 END)`,
        escalated: sql<string>`COUNT(CASE WHEN ${amlAlerts.status} = 'escalated' THEN 1 END)`
      })
      .from(amlAlerts)
      .where(
        and(
          gte(amlAlerts.flaggedAt, startDate),
          lte(amlAlerts.flaggedAt, endDate)
        )
      );

    const reportData = {
      month,
      year,
      periodStart: startDate.toISOString().split('T')[0],
      periodEnd: endDate.toISOString().split('T')[0],
      transactionVolume: {
        count: parseInt(monthlyStats[0]?.totalTransactions || '0'),
        totalAmount: parseFloat(monthlyStats[0]?.totalVolume || '0'),
        uniqueUsers: parseInt(monthlyStats[0]?.uniqueUsers || '0')
      },
      amlCompliance: {
        alertsGenerated: parseInt(monthlyAlerts[0]?.total || '0'),
        alertsResolved: parseInt(monthlyAlerts[0]?.resolved || '0'),
        alertsEscalated: parseInt(monthlyAlerts[0]?.escalated || '0')
      },
      regulatoryStatus: 'compliant'
    };

    return await this.createComplianceReport({
      reportType: 'monthly_regulatory',
      reportPeriod: `${year}-${month.toString().padStart(2, '0')}`,
      generatedBy: 'system',
      reportData
    });
  }

  private getSettlementStatusMessage(status: string, holdReason?: string, rejectReason?: string, reasonComment?: string): string {
    switch (status) {
      case "approved":
        return "Your settlement request has been approved and will be processed soon.";
      case "hold":
        const displayReason = holdReason === "settlement_cover" ? "Approved - In Queue" : this.formatReason(holdReason);
        return `Your settlement request is on hold: ${displayReason}${reasonComment ? ` - ${reasonComment}` : ""}`;
      case "rejected":
        return `Your settlement request has been rejected: ${this.formatReason(rejectReason)}${reasonComment ? ` - ${reasonComment}` : ""}`;
      case "completed":
        return "Your settlement request has been completed and funds have been transferred.";
      default:
        return `Your settlement request status has been updated to ${status}.`;
    }
  }

  private formatReason(reason?: string): string {
    if (!reason) return "";
    return reason.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }
}

export const storage = new DatabaseStorage();
