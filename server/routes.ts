import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupFirebaseAuth, isFirebaseAuthenticated } from "./firebaseAuth";
import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  insertOrganizationSchema,
  insertBranchSchema,
  insertTransactionSchema,
  insertDocumentSchema,
  insertSettlementRequestSchema,
  insertQrCodeSchema,
  insertKycDocumentSchema,
  users,
  wallets,
} from "@shared/schema";
import crypto from "crypto";

// Optimized image processing - minimal conversion for faster uploads
async function processImage(imagePath: string, outputPath: string): Promise<void> {
  try {
    // For now, just rename the file to avoid heavy processing
    // This eliminates the PDF conversion bottleneck
    fs.renameSync(imagePath, outputPath);
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

// File upload configuration - optimized for faster processing
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB to match client validation
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      return cb(new Error('Only camera images are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Firebase authentication
  await setupFirebaseAuth(app);

  // Organization routes
  app.post('/api/organizations', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance') {
        return res.status(403).json({ message: "Only finance officers can create organizations" });
      }

      const orgData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(orgData);
      
      // Update user's organization
      await storage.upsertUser({
        ...user,
        organizationId: organization.id,
      });

      res.json(organization);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(400).json({ message: "Failed to create organization" });
    }
  });

  app.get('/api/organizations', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const organizations = await storage.getOrganizationsByUserId(userId);
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.put('/api/organizations/:id', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      const organizationId = parseInt(req.params.id);
      
      if (user?.role !== 'finance') {
        return res.status(403).json({ message: "Only finance officers can update organizations" });
      }

      // Check if user belongs to this organization
      if (user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      const updatedOrganization = await storage.updateOrganization(organizationId, req.body);
      res.json(updatedOrganization);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(400).json({ message: "Failed to update organization" });
    }
  });

  // Branch routes
  app.post('/api/branches', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance') {
        return res.status(403).json({ message: "Only finance officers can create branches" });
      }

      // If user doesn't have an organization, create a default one
      let organizationId = user.organizationId;
      if (!organizationId) {
        const defaultOrg = await storage.createOrganization({
          name: `${user.firstName || 'Finance'} Organization`,
          type: 'financial_institution',
          description: 'Default organization for finance operations',
        });
        
        // Update user with organization
        await storage.upsertUser({
          ...user,
          organizationId: defaultOrg.id,
        });
        
        organizationId = defaultOrg.id;
      }

      const branchData = {
        ...req.body,
        organizationId,
        identifier: `BR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      };
      const branch = await storage.createBranch(branchData);
      res.json(branch);
    } catch (error) {
      console.error("Error creating branch:", error);
      res.status(400).json({ message: "Failed to create branch" });
    }
  });

  app.get('/api/branches', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user?.organizationId) {
        return res.json([]);
      }

      const branches = await storage.getBranchesByOrganization(user.organizationId);
      res.json(branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  app.put('/api/branches/:id', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      const branchId = parseInt(req.params.id);
      
      if (user?.role !== 'finance') {
        return res.status(403).json({ message: "Only finance officers can update branches" });
      }

      if (!user?.organizationId) {
        return res.status(400).json({ message: "User must belong to an organization" });
      }

      // Get the branch to ensure it belongs to the user's organization
      const branches = await storage.getBranchesByOrganization(user.organizationId);
      const branchExists = branches.find(b => b.id === branchId);
      
      if (!branchExists) {
        return res.status(404).json({ message: "Branch not found or access denied" });
      }

      const updatedBranch = await storage.updateBranch(branchId, req.body);
      res.json(updatedBranch);
    } catch (error) {
      console.error("Error updating branch:", error);
      res.status(400).json({ message: "Failed to update branch" });
    }
  });

  // Fetch merchant wallets for finance portal
  app.get('/api/merchant-wallets', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance' || !user.organizationId) {
        return res.status(403).json({ message: "Only finance officers can access merchant wallet data" });
      }

      const merchantWallets = await storage.getMerchantWalletsByOrganization(user.organizationId);
      res.json(merchantWallets);
    } catch (error) {
      console.error("Error fetching merchant wallets:", error);
      res.status(500).json({ message: "Failed to fetch merchant wallets" });
    }
  });

  // Get settlement breakdown for finance portal
  app.get('/api/settlement-breakdown', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance' || !user.organizationId) {
        return res.status(403).json({ message: "Only finance officers can access settlement data" });
      }

      const breakdown = await storage.getSettlementBreakdown(user.organizationId);
      const pendingTotal = await storage.getPendingSettlementsTotal(user.organizationId);
      const todaysUsage = await storage.getTodaysSettlementUsage(user.organizationId);
      
      res.json({
        breakdown,
        pendingTotal,
        todaysUsage
      });
    } catch (error) {
      console.error("Error fetching settlement breakdown:", error);
      res.status(500).json({ message: "Failed to fetch settlement breakdown" });
    }
  });

  // Monthly settlement breakdown with filtering
  app.get('/api/monthly-settlement-breakdown', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance' || !user.organizationId) {
        return res.status(403).json({ message: "Only finance officers can access settlement data" });
      }

      const period = (req.query.period as 'weekly' | 'monthly' | 'yearly') || 'monthly';
      const breakdown = await storage.getMonthlySettlementBreakdown(user.organizationId, period);
      
      res.json({
        ...breakdown,
        period,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching monthly settlement breakdown:", error);
      res.status(500).json({ message: "Failed to fetch monthly settlement breakdown" });
    }
  });

  // Wallet routes
  app.get('/api/wallet', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      const wallet = await storage.getOrCreateWallet(userId);
      
      // Get today's transaction totals
      const todayTotals = await storage.getTodayTransactionTotals(userId);
      
      // For finance users, include organization-wide today's collections
      let todaysCollections = 0;
      if (user?.role === 'finance' && user.organizationId) {
        todaysCollections = await storage.getTodaysCollectionsByOrganization(user.organizationId);
      }
      
      // Disable caching for real-time balance updates
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
      
      res.json({
        ...wallet,
        todayCompleted: todayTotals.completed,
        todayTotal: todayTotals.total,
        todaysCollections, // Organization-wide collections for finance users
        userRole: user?.role,
        timestamp: new Date().getTime() // Force cache busting
      });
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  // Daily reset endpoint for manual testing
  app.post('/api/wallet/reset-daily', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const wallet = await storage.getOrCreateWallet(userId);
      await storage.checkAndResetDailySpending(wallet);
      const updatedWallet = await storage.getOrCreateWallet(userId);
      res.json({ message: "Daily spending reset", wallet: updatedWallet });
    } catch (error) {
      console.error("Error resetting daily spending:", error);
      res.status(500).json({ message: "Failed to reset daily spending" });
    }
  });

  // Force daily reset for all users (admin testing endpoint)
  app.post('/api/admin/force-daily-reset', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      // Force reset all users by updating their lastResetDate to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Get all users and force reset their wallets
      const allUsers = await db.select().from(users);
      
      for (const userRecord of allUsers) {
        const wallet = await storage.getOrCreateWallet(userRecord.id);
        // Force the wallet's lastResetDate to yesterday to trigger reset
        await db
          .update(wallets)
          .set({ lastResetDate: yesterday })
          .where(eq(wallets.userId, userRecord.id));
        
        // Now trigger the reset
        await storage.checkAndResetDailySpending({...wallet, lastResetDate: yesterday});
      }
      
      res.json({ message: `Forced daily reset completed for ${allUsers.length} users` });
    } catch (error) {
      console.error("Error forcing daily reset:", error);
      res.status(500).json({ message: "Failed to force daily reset" });
    }
  });

  // Simple wallet balance reset for testing (any user can reset their own wallet)
  app.post('/api/wallet/force-reset', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Direct wallet reset based on user role
      if (user.role === 'merchant') {
        await db
          .update(wallets)
          .set({
            dailyCollected: "0",
            balance: "0",
            lastResetDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, userId));
      } else if (user.role === 'cashier') {
        await db
          .update(wallets)
          .set({
            dailyTransferred: "0",
            lastResetDate: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, userId));
      }
      
      // Get updated wallet
      const updatedWallet = await storage.getOrCreateWallet(userId);
      
      res.json({ 
        message: "Wallet reset completed",
        wallet: updatedWallet,
        resetType: user.role === 'merchant' ? 'balance and daily collected reset to 0' : 'daily transferred reset to 0'
      });
    } catch (error) {
      console.error("Error forcing wallet reset:", error);
      res.status(500).json({ message: "Failed to force wallet reset" });
    }
  });

  // Transaction routes
  app.post('/api/transactions', isFirebaseAuthenticated, async (req: any, res) => {
    console.log("POST /api/transactions - Request received");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User:", req.user?.claims?.sub);
    
    const userId = req.user.userId;
    
    try {
      // Set proper status for QR transactions
      let finalStatus = req.body.status || 'pending';
      if (req.body.type === 'qr_code_payment') {
        finalStatus = 'pending';
      }
      
      // Set expiration time for all pending transactions (both QR and RTP)
      const expiresAt = (finalStatus === 'pending') 
        ? new Date(Date.now() + 120 * 1000) 
        : null;
      
      // Parse amount as decimal for accurate currency handling
      const parsedAmount = parseFloat(req.body.amount || "0");
      
      // REAL-TIME AML MONITORING: Check transaction against AML thresholds before processing
      const amlAlerts = await storage.checkTransactionForAmlViolations(
        req.body.fromUserId || userId, 
        parsedAmount
      );
      
      // If high-risk alerts are generated, require admin approval
      const highRiskAlerts = amlAlerts.filter(alert => alert.riskScore >= 70);
      if (highRiskAlerts.length > 0 && finalStatus === 'completed') {
        finalStatus = 'pending'; // Force high-risk transactions to pending for review
        console.log(`Transaction flagged for AML review: ${highRiskAlerts.length} high-risk alerts generated`);
      }
      
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        status: finalStatus,
        amount: parsedAmount.toFixed(2),
        fromUserId: req.body.fromUserId || userId,
        toUserId: req.body.toUserId || "system", // Default to system for QR transactions
        expiresAt,
      });
      
      const amount = parsedAmount;
      
      // For completed transactions, check transfer limits and update balances
      if (transactionData.status === 'completed') {
        const fromUser = await storage.getUser(transactionData.fromUserId || userId);
        const toUser = await storage.getUser(transactionData.toUserId);
        
        // Check limits for cashier (sender)
        if (fromUser?.role === 'cashier') {
          const limitCheck = await storage.checkTransferLimits(fromUser.id, amount);
          if (!limitCheck.allowed) {
            return res.status(400).json({ 
              message: "Transfer limit exceeded", 
              reason: limitCheck.reason 
            });
          }
        }
        
        // Check collection limits for merchant (receiver)
        if (toUser?.role === 'merchant') {
          const limitCheck = await storage.checkTransferLimits(toUser.id, amount);
          if (!limitCheck.allowed) {
            return res.status(400).json({ 
              message: "Collection limit exceeded", 
              reason: limitCheck.reason 
            });
          }
        }
      }
      
      // Mark expired transactions before creating new ones
      await storage.markExpiredTransactions();
      
      const transaction = await storage.createTransaction(transactionData);
      
      // Update balances only for completed transactions
      if (transactionData.status === 'completed') {
        const fromUser = await storage.getUser(transactionData.fromUserId || userId);
        const toUser = await storage.getUser(transactionData.toUserId);
        
        if (fromUser) {
          await storage.updateDailyTransactionAmounts(fromUser.id, amount, fromUser.role, transactionData.type);
        }
        if (toUser) {
          await storage.updateDailyTransactionAmounts(toUser.id, amount, toUser.role, transactionData.type);
        }
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      console.error("Request body:", req.body);
      console.error("User ID:", req.user?.claims?.sub);
      
      if (error instanceof Error && error.message === 'PENDING_TRANSACTION_EXISTS') {
        res.status(409).json({ 
          message: "A pending transaction already exists. Please wait for it to be completed or expired before creating a new one.",
          code: "PENDING_TRANSACTION_EXISTS"
        });
      } else {
        res.status(400).json({ 
          message: "Failed to create transaction",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });

  app.get('/api/transactions', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      console.log(`GET /api/transactions - User: ${userId}, Role: ${user?.role}`);
      
      let transactions;
      if (user?.role === 'cashier') {
        // Cashiers see all transactions they've processed, including timed-out/rejected ones
        transactions = await storage.getAllTransactionsByCashier(userId);
        console.log(`Cashier transactions: ${transactions.length}`);
      } else if (user?.role === 'finance') {
        // Finance users see all transactions in their organization
        transactions = await storage.getAllTransactions();
        console.log(`Finance transactions: ${transactions.length}`);
        // Filter by organization if needed (for multi-org support later)
        // For now, return all transactions since we have single org setup
      } else {
        // Other users see transactions with standard filtering
        transactions = await storage.getTransactionsByUserId(userId);
        console.log(`User transactions: ${transactions.length}`);
      }
      
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin endpoint to view all transactions (also accessible by finance users)
  app.get('/api/admin/transactions', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin' && user?.role !== 'finance') {
        return res.status(403).json({ message: "Only admin and finance users can view all transactions" });
      }
      
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching admin transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/transactions/pending', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      // Cashiers see all pending transactions, others see only their own
      let transactions;
      if (user?.role === 'cashier') {
        // Get all pending transactions for cashiers
        transactions = await storage.getAllPendingTransactions();
      } else {
        transactions = await storage.getPendingTransactionsByReceiver(userId);
      }
      
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching pending transactions:", error);
      res.status(500).json({ message: "Failed to fetch pending transactions" });
    }
  });

  app.get('/api/transactions/qr-verification', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      // Only cashiers can access QR verification transactions
      if (user?.role !== 'cashier') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get pending QR transactions only
      const allPending = await storage.getAllPendingTransactions();
      const qrTransactions = allPending.filter((t: any) => t.type === 'qr_code_payment');
      res.json(qrTransactions);
    } catch (error) {
      console.error("Error fetching QR verification transactions:", error);
      res.status(500).json({ message: "Failed to fetch QR verification transactions" });
    }
  });

  // Admin-only endpoint to update transaction priority
  app.patch('/api/transactions/:id/priority', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const { priority } = req.body;
      const userId = req.user.userId;
      
      // Check if user is admin
      const user = await storage.getUser(userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }
      
      if (!['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({ message: "Invalid priority. Must be low, medium, or high." });
      }

      const transaction = await storage.getTransactionById(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      await storage.updateTransactionPriority(transactionId, priority);
      res.json({ message: "Transaction priority updated successfully" });
    } catch (error) {
      console.error("Error updating transaction priority:", error);
      res.status(500).json({ message: "Failed to update transaction priority" });
    }
  });

  app.patch('/api/transactions/:id/status', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const { status, rejectionReason, verifiedAmount, verifiedVmfNumber } = req.body;
      const cashierId = req.user.userId;
      
      if (!['pending', 'approved', 'completed', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const transaction = await storage.getTransactionById(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Set the cashier as the processor for completed and rejected transactions
      if (status === 'completed' || status === 'rejected') {
        await storage.updateTransactionProcessor(transactionId, cashierId);
      }

      // Update transaction status with rejection reason if provided
      await storage.updateTransactionStatus(transactionId, status, rejectionReason);
      
      // If approved, update wallet balances and daily tracking
      if (status === 'completed' && transaction.toUserId) {
        const fromUser = transaction.fromUserId ? await storage.getUser(transaction.fromUserId) : null;
        const toUser = await storage.getUser(transaction.toUserId);
        const amount = parseFloat(transaction.amount);
        
        // Update daily amounts for both users if applicable
        if (fromUser && fromUser.id !== toUser?.id) {
          await storage.updateDailyTransactionAmounts(fromUser.id, amount, fromUser.role, transaction.type);
        }
        if (toUser) {
          await storage.updateDailyTransactionAmounts(toUser.id, amount, toUser.role, transaction.type);
        }
      }

      res.json({ message: "Transaction status updated" });
    } catch (error) {
      console.error("Error updating transaction status:", error);
      res.status(500).json({ message: "Failed to update transaction status" });
    }
  });

  // Document upload routes with error handling
  app.post('/api/documents', isFirebaseAuthenticated, (req: any, res, next) => {
    const uploadHandler = upload.single('file');
    uploadHandler(req, res, (err: any) => {
      if (err) {
        console.error('Multer upload error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
        }
        if (err.message === 'Only camera images are allowed') {
          return res.status(400).json({ message: "Only JPEG and PNG images are allowed." });
        }
        return res.status(400).json({ message: "File upload error: " + err.message });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      console.log('Document upload request received:', {
        file: req.file ? {
          filename: req.file.filename,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : 'No file',
        body: req.body,
        userId: req.user?.claims?.sub
      });

      if (!req.file) {
        console.error('No file uploaded in request');
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.userId;
      if (!userId) {
        console.error('No user ID found in request');
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        console.error('Invalid file type:', req.file.mimetype);
        return res.status(400).json({ message: "Only JPEG and PNG images are allowed" });
      }

      // Validate file size
      if (req.file.size > 10 * 1024 * 1024) {
        console.error('File too large:', req.file.size);
        return res.status(400).json({ message: "File too large. Maximum size is 10MB" });
      }

      if (req.file.size < 1000) {
        console.error('File too small:', req.file.size);
        return res.status(400).json({ message: "File too small. Please capture a valid photo" });
      }

      const documentData = insertDocumentSchema.parse({
        userId,
        transactionId: req.body.transactionId ? parseInt(req.body.transactionId) : null,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        type: req.body.type || 'vmf_document',
      });

      console.log('Creating document with data:', documentData);
      const document = await storage.createDocument(documentData);
      console.log('Document created successfully:', document.id);
      
      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        file: req.file ? {
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        } : 'No file'
      });
      res.status(400).json({ 
        message: "Failed to upload document",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Settlement request routes
  app.post('/api/settlement-requests', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance' || !user.organizationId) {
        return res.status(403).json({ message: "Only finance officers with organizations can create settlement requests" });
      }

      // Calculate settlement capacity based on today's collections for finance users
      const todaysCollections = await storage.getTodaysCollectionsByOrganization(user.organizationId);
      const todaysUsage = await storage.getTodaysSettlementUsage(user.organizationId);
      const settlementCapacity = Math.max(0, todaysCollections - todaysUsage);
      
      const requestAmount = Math.floor(parseFloat(req.body.amount || '0'));
      
      // Validate against settlement capacity
      if (requestAmount > settlementCapacity) {
        return res.status(400).json({ 
          message: `Insufficient settlement capacity. Available: ZMW ${settlementCapacity.toLocaleString()}, Requested: ZMW ${requestAmount.toLocaleString()}`,
          todaysCollections,
          todaysUsage,
          settlementCapacity,
          requestAmount
        });
      }

      const requestData = insertSettlementRequestSchema.parse({
        ...req.body,
        userId,
        organizationId: user.organizationId,
        status: "pending", // Default status for new settlement requests
        priority: "medium", // Default priority for finance portal requests
      });
      
      const request = await storage.createSettlementRequest(requestData);
      res.json(request);
    } catch (error) {
      console.error("Error creating settlement request:", error);
      res.status(400).json({ message: "Failed to create settlement request" });
    }
  });

  app.get('/api/settlement-requests', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role === 'admin') {
        // Admins see all recent requests (pending, approved, hold, rejected, completed)
        const requests = await storage.getAllSettlementRequests();
        res.json(requests);
      } else if (user?.organizationId) {
        // Finance officers see their organization's requests
        const requests = await storage.getSettlementRequestsByOrganization(user.organizationId);
        res.json(requests);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching settlement requests:", error);
      res.status(500).json({ message: "Failed to fetch settlement requests" });
    }
  });

  app.patch('/api/settlement-requests/:id/status', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update settlement request status" });
      }

      const requestId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await storage.updateSettlementRequestStatus(requestId, status, userId);
      res.json({ message: "Settlement request status updated" });
    } catch (error) {
      console.error("Error updating settlement request status:", error);
      res.status(500).json({ message: "Failed to update settlement request status" });
    }
  });

  // QR Code generation and management endpoints
  app.post('/api/qr-codes/generate', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const { transactionId } = req.body;
      const userId = req.user.userId;
      
      if (!transactionId) {
        return res.status(400).json({ message: "Transaction ID is required" });
      }

      // Verify transaction exists and belongs to user
      const transaction = await storage.getTransactionById(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.fromUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if active QR code already exists for this transaction
      const existingQR = await storage.getActiveQrCodeByTransactionId(transactionId);
      if (existingQR) {
        return res.status(409).json({ message: "Active QR code already exists for this transaction" });
      }

      // Generate unique QR data with strong cryptographic security
      const qrPayload = {
        transactionId: transaction.transactionId,
        amount: Math.floor(parseFloat(transaction.amount)),
        type: "qr_code_payment",
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex'),
        userId: userId
      };

      const qrDataString = JSON.stringify(qrPayload);
      const qrCodeHash = crypto.createHash('sha256').update(qrDataString).digest('hex');
      
      // Set expiration to 2 minutes from now
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

      // Store QR code in database
      const qrCode = await storage.createQrCode({
        transactionId: transaction.id,
        qrCodeHash,
        qrData: qrDataString,
        expiresAt
      });

      // Generate QR code image URL
      const encodedData = encodeURIComponent(qrDataString);
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}&format=png&margin=10`;

      res.json({
        qrId: qrCode.id,
        qrImageUrl,
        expiresAt: qrCode.expiresAt,
        transactionId: transaction.transactionId
      });

    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post('/api/qr-codes/verify', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const { qrData } = req.body;
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      // Only cashiers can verify QR codes
      if (user?.role !== 'cashier') {
        return res.status(403).json({ message: "Only cashiers can verify QR codes" });
      }

      if (!qrData) {
        return res.status(400).json({ message: "QR data is required" });
      }

      // Parse and validate QR data
      let parsedQR;
      try {
        parsedQR = JSON.parse(qrData);
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid QR code format" });
      }

      // Check if this is a new client-side generated QR code (has nonce and expiresAt)
      if (parsedQR.nonce && parsedQR.expiresAt && parsedQR.transactionId) {
        // New client-side QR code validation
        
        // Check expiration
        const now = Date.now();
        if (now > parsedQR.expiresAt) {
          const secondsExpired = Math.floor((now - parsedQR.expiresAt) / 1000);
          return res.status(400).json({ 
            message: `QR code expired ${secondsExpired} seconds ago. Please generate a new QR code.` 
          });
        }

        // Validate required fields
        if (
          typeof parsedQR.transactionId !== 'string' ||
          typeof parsedQR.amount !== 'string' ||
          typeof parsedQR.currency !== 'string' ||
          typeof parsedQR.type !== 'string' ||
          typeof parsedQR.nonce !== 'string' ||
          typeof parsedQR.timestamp !== 'number'
        ) {
          return res.status(400).json({ message: "Invalid QR code format - missing required fields" });
        }

        // Find transaction by transactionId
        const allTransactions = await storage.getAllTransactions();
        const transaction = allTransactions.find(t => t.transactionId === parsedQR.transactionId);
        
        if (!transaction || transaction.status !== 'pending') {
          return res.status(400).json({ message: "Transaction is no longer valid or not found" });
        }

        // Verify amount matches
        const qrAmount = parseFloat(parsedQR.amount);
        const transactionAmount = parseFloat(transaction.amount);
        if (Math.abs(qrAmount - transactionAmount) > 0.01) {
          return res.status(400).json({ message: "QR code amount does not match transaction" });
        }

        // Return successful verification for client-side QR
        return res.json({
          valid: true,
          transaction: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            amount: transaction.amount,
            vmfNumber: transaction.vmfNumber,
            type: transaction.type
          }
        });
      }

      // Legacy database-stored QR code validation
      const qrCodeHash = crypto.createHash('sha256').update(qrData).digest('hex');
      const qrCode = await storage.getQrCodeByHash(qrCodeHash);

      if (!qrCode) {
        return res.status(404).json({ message: "QR code not found, expired, or already used" });
      }

      // Verify transaction exists and is still pending
      const transaction = await storage.getTransactionById(qrCode.transactionId);
      if (!transaction || transaction.status !== 'pending') {
        return res.status(400).json({ message: "Transaction is no longer valid" });
      }

      // Mark QR code as used immediately to prevent reuse
      await storage.markQrCodeAsUsed(qrCode.id);

      res.json({
        valid: true,
        transaction: {
          id: transaction.id,
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          vmfNumber: transaction.vmfNumber,
          type: transaction.type
        }
      });

    } catch (error) {
      console.error("Error verifying QR code:", error);
      res.status(500).json({ message: "Failed to verify QR code" });
    }
  });

  // Admin settlement approval routes for maker-checker workflow
  app.patch('/api/admin/settlement-requests/:id/approve', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admin users can approve settlements" });
      }

      await storage.updateSettlementRequestStatus(settlementId, 'approved', userId);
      res.json({ message: "Settlement request approved successfully" });
    } catch (error) {
      console.error("Error approving settlement:", error);
      res.status(500).json({ message: "Failed to approve settlement request" });
    }
  });

  app.patch('/api/admin/settlement-requests/:id/release', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admin users can release settlements" });
      }

      await storage.updateSettlementRequestStatus(settlementId, 'approved', userId);
      res.json({ message: "Settlement request released and approved successfully" });
    } catch (error) {
      console.error("Error releasing settlement:", error);
      res.status(500).json({ message: "Failed to release settlement request" });
    }
  });

  app.patch('/api/admin/settlement-requests/:id/hold', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const { holdReason, reasonComment } = req.body;
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admin users can hold settlements" });
      }

      if (!holdReason) {
        return res.status(400).json({ message: "Hold reason is required" });
      }

      if (holdReason === 'other' && !reasonComment) {
        return res.status(400).json({ message: "Comment is required when selecting 'other' reason" });
      }

      if (reasonComment && reasonComment.length > 125) {
        return res.status(400).json({ message: "Comment must be 125 characters or less" });
      }

      await storage.updateSettlementRequestStatus(settlementId, 'hold', userId, holdReason, undefined, reasonComment);
      res.json({ message: "Settlement request placed on hold" });
    } catch (error) {
      console.error("Error holding settlement:", error);
      res.status(500).json({ message: "Failed to hold settlement request" });
    }
  });

  app.patch('/api/admin/settlement-requests/:id/reject', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const { rejectReason, reasonComment } = req.body;
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admin users can reject settlements" });
      }

      if (!rejectReason) {
        return res.status(400).json({ message: "Reject reason is required" });
      }

      if (rejectReason === 'other' && !reasonComment) {
        return res.status(400).json({ message: "Comment is required when selecting 'other' reason" });
      }

      if (reasonComment && reasonComment.length > 125) {
        return res.status(400).json({ message: "Comment must be 125 characters or less" });
      }

      await storage.updateSettlementRequestStatus(settlementId, 'rejected', userId, undefined, rejectReason, reasonComment);
      res.json({ message: "Settlement request rejected" });
    } catch (error) {
      console.error("Error rejecting settlement:", error);
      res.status(500).json({ message: "Failed to reject settlement request" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const notifications = await storage.getNotificationsByUserId(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/read', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Document viewing endpoint
  app.get("/api/documents/:id/view", isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.user.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get document info
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has permission to view this document
      const transaction = await storage.getTransactionById(document.transactionId!);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Allow access if user is involved in the transaction or is admin/finance
      const user = await storage.getUser(userId);
      const canView = 
        transaction.fromUserId === userId || 
        transaction.toUserId === userId ||
        transaction.processedBy === userId ||
        user?.role === 'admin' ||
        user?.role === 'finance';

      if (!canView) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Serve the file
      const filePath = path.join(__dirname, "../uploads", document.filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', document.mimeType || 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error("Error serving document:", error);
      res.status(500).json({ message: "Failed to serve document" });
    }
  });

  // Get documents by transaction ID
  app.get("/api/documents/transaction/:transactionId", isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const transactionId = parseInt(req.params.transactionId);
      const userId = req.user.userId;
      
      // Check if user has permission to view transaction documents
      const transaction = await storage.getTransactionById(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const user = await storage.getUser(userId);
      const canView = 
        transaction.fromUserId === userId || 
        transaction.toUserId === userId ||
        transaction.processedBy === userId ||
        user?.role === 'admin' ||
        user?.role === 'finance';

      if (!canView) {
        return res.status(403).json({ message: "Access denied" });
      }

      const documents = await storage.getDocumentsByTransactionId(transactionId);
      
      // Return document metadata with view URLs
      const documentsWithUrls = documents.map(doc => ({
        ...doc,
        viewUrl: `/api/documents/${doc.id}/view`,
        thumbnailUrl: `/api/documents/${doc.id}/view` // Could implement thumbnail generation
      }));
      
      res.json(documentsWithUrls);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Development endpoint to create test accounts and organization
  app.post('/api/dev/create-test-accounts', async (req: any, res) => {
    try {
      // Create test organization first
      const testOrg = await storage.createOrganization({
        name: "Testco Financial Services",
        type: "financial_institution",
        description: "Licensed e-money issuer for testing KYC workflows",
        kycStatus: "approved"
      });

      // Test user data with Firebase UIDs (these would be created in Firebase first)
      const testUsers = [
        {
          id: "test-admin-uid-12345",
          email: "admin@testco.com",
          firstName: "Admin",
          lastName: "User",
          role: "admin",
          organizationId: null // Admins don't belong to specific organizations
        },
        {
          id: "test-finance-uid-12346", 
          email: "finance@testco.com",
          firstName: "Finance",
          lastName: "Officer",
          role: "finance",
          organizationId: testOrg.id
        },
        {
          id: "test-merchant-uid-12347",
          email: "merchant@testco.com", 
          firstName: "Merchant",
          lastName: "User",
          role: "merchant",
          organizationId: testOrg.id
        },
        {
          id: "test-cashier-uid-12348",
          email: "cashier@testco.com",
          firstName: "Cashier", 
          lastName: "User",
          role: "cashier",
          organizationId: testOrg.id
        }
      ];

      // Create users in database
      const createdUsers = [];
      for (const userData of testUsers) {
        const user = await storage.upsertUser(userData);
        createdUsers.push(user);
        
        // Create wallets for non-admin users
        if (userData.role !== 'admin') {
          await storage.getOrCreateWallet(userData.id);
        }
      }

      // Create test branch for the organization
      await storage.createBranch({
        organizationId: testOrg.id,
        name: "Main Branch",
        location: "Lusaka, Zambia",
        balance: "1000000" // 1M ZMW starting balance
      });

      res.json({
        message: "Test accounts created successfully",
        organization: testOrg,
        users: createdUsers.map(u => ({
          email: u.email,
          role: u.role,
          name: `${u.firstName} ${u.lastName}`
        })),
        instructions: {
          note: "Create these accounts in Firebase Console with the following credentials:",
          accounts: [
            { email: "admin@testco.com", password: "TestAdmin123!" },
            { email: "finance@testco.com", password: "TestFinance123!" },
            { email: "merchant@testco.com", password: "TestMerchant123!" },
            { email: "cashier@testco.com", password: "TestCashier123!" }
          ]
        }
      });
    } catch (error) {
      console.error("Error creating test accounts:", error);
      res.status(500).json({ message: "Failed to create test accounts", error: (error as Error).message });
    }
  });

  // Development endpoint to create test settlement requests
  app.post('/api/dev/settlement-requests', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const testRequests = [
        {
          organizationId: 1,
          userId: userId,
          amount: "25000",
          bankName: "Standard Chartered Bank Zambia",
          accountNumber: "0123456789",
          priority: "high",
          status: "pending",
          description: "Monthly cash settlement - Branch 001"
        },
        {
          organizationId: 1,
          userId: userId,
          amount: "15000",
          bankName: "Barclays Bank Zambia",
          accountNumber: "9876543210",
          priority: "medium",
          status: "pending",
          description: "Weekly cash settlement - Branch 002"
        },
        {
          organizationId: 1,
          userId: userId,
          amount: "50000",
          bankName: "Zanaco Bank",
          accountNumber: "5555666677",
          priority: "high",
          status: "approved",
          description: "Emergency settlement request"
        }
      ];

      for (const request of testRequests) {
        await storage.createSettlementRequest(request);
      }

      res.json({ message: "Test settlement requests created", count: testRequests.length });
    } catch (error) {
      console.error("Error creating test settlement requests:", error);
      res.status(500).json({ message: "Failed to create test settlement requests" });
    }
  });

  // KYC Document Upload endpoint
  app.post('/api/kyc/upload', isFirebaseAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { organizationId, documentType } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (!organizationId || !documentType) {
        return res.status(400).json({ message: "Organization ID and document type are required" });
      }

      // Validate document type
      const validTypes = ['selfie', 'nrc_side1', 'nrc_side2', 'passport', 'pacra', 'zra_tpin'];
      if (!validTypes.includes(documentType)) {
        return res.status(400).json({ message: "Invalid document type" });
      }

      // Get organization to create proper directory structure
      const organization = await storage.getOrganizationById(parseInt(organizationId));
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Create KYC directory structure: /uploads/KYC DOCS/[organization-name]/
      const orgName = organization.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const kycDir = path.join('uploads', 'KYC DOCS', orgName);
      
      // Ensure directory exists
      if (!fs.existsSync(kycDir)) {
        fs.mkdirSync(kycDir, { recursive: true });
      }

      // Generate proper filename using the specified convention
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const fileName = `kyc-${orgName}-${user.firstName.toLowerCase()}-${user.lastName.toLowerCase()}-${documentType}.pdf`;
      const finalPath = path.join(kycDir, fileName);

      // Move uploaded file to final location
      fs.renameSync(req.file.path, finalPath);

      // Save document record to database
      const kycDocument = await storage.createKycDocument({
        organizationId: parseInt(organizationId),
        documentType,
        fileName,
        filePath: finalPath,
        fileSize: req.file.size,
        uploadedBy: userId,
      });

      res.json({
        message: "Document uploaded successfully",
        document: kycDocument,
      });

    } catch (error) {
      console.error("Error uploading KYC document:", error);
      
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Complete organization KYC setup
  app.patch('/api/organizations/:id/complete-kyc', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const organizationId = parseInt(req.params.id);
      
      // Check if user has permission to complete KYC for this organization
      const user = await storage.getUser(userId);
      if (!user || user.organizationId !== organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update organization KYC status to in_review
      await storage.updateOrganizationKycStatus(organizationId, 'in_review');

      res.json({ message: "KYC documents submitted for review" });

    } catch (error) {
      console.error("Error completing KYC:", error);
      res.status(500).json({ message: "Failed to complete KYC setup" });
    }
  });

  // Get KYC documents for organization (admin/finance view)
  app.get('/api/organizations/:id/kyc-documents', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const organizationId = parseInt(req.params.id);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admins or finance officers from the same organization can view KYC docs
      if (user.role !== 'admin' && (user.role !== 'finance' || user.organizationId !== organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const documents = await storage.getKycDocumentsByOrganization(organizationId);
      res.json(documents);

    } catch (error) {
      console.error("Error fetching KYC documents:", error);
      res.status(500).json({ message: "Failed to fetch KYC documents" });
    }
  });

  // Admin endpoint to review KYC documents
  app.patch('/api/kyc-documents/:id/review', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const documentId = parseInt(req.params.id);
      const { status, rejectReason } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can review KYC documents" });
      }

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Use 'approved' or 'rejected'" });
      }

      if (status === 'rejected' && !rejectReason) {
        return res.status(400).json({ message: "Rejection reason is required when rejecting documents" });
      }

      await storage.updateKycDocumentStatus(documentId, status, userId, rejectReason);

      res.json({ message: `Document ${status} successfully` });

    } catch (error) {
      console.error("Error reviewing KYC document:", error);
      res.status(500).json({ message: "Failed to review document" });
    }
  });

  // Get all pending KYC documents for admin review
  app.get('/api/admin/kyc-documents/pending', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can view pending KYC documents" });
      }

      const pendingDocuments = await storage.getAllPendingKycDocuments();
      res.json(pendingDocuments);

    } catch (error) {
      console.error("Error fetching pending KYC documents:", error);
      res.status(500).json({ message: "Failed to fetch pending documents" });
    }
  });

  // Admin user management endpoints
  app.get('/api/admin/users', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/admin/users/create', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { email, phoneNumber, firstName, lastName, role, organizationId } = req.body;

      // Validation
      if (!email || !phoneNumber || !firstName || !lastName || !role) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check for duplicates
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already exists" });
      }

      const existingPhone = await storage.getUserByPhone(phoneNumber);
      if (existingPhone) {
        return res.status(409).json({ message: "Phone number already exists" });
      }

      // Generate secure temporary password
      const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "!1";

      let firebaseUserId;
      try {
        // Create Firebase user account using Firebase Admin SDK
        const admin = await import('firebase-admin');
        
        // Initialize Firebase Admin if not already done
        if (!admin.apps.length) {
          const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
          if (serviceAccountKey) {
            const serviceAccount = JSON.parse(serviceAccountKey);
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            });
          } else {
            admin.initializeApp({
              projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            });
          }
        }

        // Create user in Firebase Authentication
        const firebaseUser = await admin.auth().createUser({
          email: email,
          password: tempPassword,
          displayName: `${firstName} ${lastName}`,
          emailVerified: false,
        });

        firebaseUserId = firebaseUser.uid;
        console.log(`✓ Created Firebase user: ${email} (UID: ${firebaseUserId})`);

      } catch (firebaseError) {
        console.error("Firebase user creation failed:", firebaseError);
        
        // Fallback: Create with placeholder ID and instructions for manual creation
        firebaseUserId = `manual-${Date.now()}-${Math.random().toString(36).slice(-6)}`;
        
        return res.json({
          message: "User created with manual Firebase setup required",
          user: {
            email,
            firstName,
            lastName,
            role,
          },
          tempPassword,
          firebaseSetupRequired: true,
          instructions: `Please create Firebase user manually:\n1. Go to Firebase Console\n2. Create user with email: ${email}\n3. Set password: ${tempPassword}\n4. Update database with real Firebase UID`
        });
      }

      // Create user in database with real Firebase UID
      const newUser = await storage.createUserByAdmin({
        id: firebaseUserId,
        email,
        phoneNumber,
        firstName,
        lastName,
        role,
        organizationId: organizationId ? parseInt(organizationId) : undefined,
        tempPassword,
        isEmailVerified: false,
        isActive: true,
      });

      // Create wallet for non-admin users
      if (role !== 'admin' && role !== 'super_admin') {
        await storage.getOrCreateWallet(newUser.id);
      }

      res.json({
        message: "User created successfully with Firebase authentication",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
        tempPassword,
        firebaseUid: firebaseUserId,
        instructions: "User can now login immediately with the provided credentials"
      });

    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch('/api/admin/users/:id/toggle', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUserId = req.params.id;
      const { isActive } = req.body;

      await storage.toggleUserStatus(targetUserId, isActive);
      res.json({ message: "User status updated successfully" });

    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Admin organization management endpoints
  app.get('/api/admin/organizations', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const organizations = await storage.getAllOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get('/api/admin/organizations/approved', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const approvedOrgs = await storage.getApprovedOrganizations();
      res.json(approvedOrgs);
    } catch (error) {
      console.error("Error fetching approved organizations:", error);
      res.status(500).json({ message: "Failed to fetch approved organizations" });
    }
  });

  app.post('/api/admin/organizations/create', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { name, type, description } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ message: "Organization name is required" });
      }

      const organization = await storage.createOrganization({
        name: name.trim(),
        type: type || "financial_institution",
        description: description || "",
        kycStatus: "pending"
      });

      res.json({
        message: "Organization created successfully",
        organization
      });

    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  app.patch('/api/admin/organizations/:id/kyc-status', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const organizationId = parseInt(req.params.id);
      const { status, rejectReason } = req.body;

      if (!['pending', 'in_review', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await storage.updateOrganizationKycStatus(organizationId, status, userId, rejectReason);
      res.json({ message: "KYC status updated successfully" });

    } catch (error) {
      console.error("Error updating KYC status:", error);
      res.status(500).json({ message: "Failed to update KYC status" });
    }
  });

  // AML Configuration Management Routes
  app.get('/api/aml/configurations', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const configurations = await storage.getAmlConfigurations();
      res.json(configurations);
    } catch (error) {
      console.error("Error fetching AML configurations:", error);
      res.status(500).json({ message: "Failed to fetch AML configurations" });
    }
  });

  app.post('/api/aml/configurations', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { configType, thresholdAmount, description } = req.body;

      if (!configType || !thresholdAmount) {
        return res.status(400).json({ message: "Config type and threshold amount are required" });
      }

      const configuration = await storage.createAmlConfiguration({
        configType,
        thresholdAmount: thresholdAmount.toString(),
        description,
        createdBy: userId,
      });

      res.json({ message: "AML configuration created", configuration });
    } catch (error) {
      console.error("Error creating AML configuration:", error);
      res.status(500).json({ message: "Failed to create AML configuration" });
    }
  });

  app.patch('/api/aml/configurations/:id', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { thresholdAmount, description, isActive } = req.body;

      await storage.updateAmlConfiguration(parseInt(id), {
        thresholdAmount: thresholdAmount?.toString(),
        description,
        isActive,
        updatedBy: userId,
      });

      res.json({ message: "AML configuration updated" });
    } catch (error) {
      console.error("Error updating AML configuration:", error);
      res.status(500).json({ message: "Failed to update AML configuration" });
    }
  });

  app.delete('/api/aml/configurations/:id', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteAmlConfiguration(parseInt(id));

      res.json({ message: "AML configuration deleted" });
    } catch (error) {
      console.error("Error deleting AML configuration:", error);
      res.status(500).json({ message: "Failed to delete AML configuration" });
    }
  });

  // AML Alert Management Routes
  app.get('/api/aml/alerts', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const alerts = await storage.getAmlAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching AML alerts:", error);
      res.status(500).json({ message: "Failed to fetch AML alerts" });
    }
  });

  app.get('/api/aml/alerts/pending', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pendingAlerts = await storage.getPendingAmlAlerts();
      res.json(pendingAlerts);
    } catch (error) {
      console.error("Error fetching pending AML alerts:", error);
      res.status(500).json({ message: "Failed to fetch pending AML alerts" });
    }
  });

  app.patch('/api/aml/alerts/:id/review', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { status, reviewNotes } = req.body;

      if (!['cleared', 'escalated', 'under_review'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await storage.updateAmlAlertStatus(parseInt(id), status, userId, reviewNotes);
      res.json({ message: "AML alert reviewed" });
    } catch (error) {
      console.error("Error reviewing AML alert:", error);
      res.status(500).json({ message: "Failed to review AML alert" });
    }
  });

  // Compliance Report Routes
  app.get('/api/compliance/reports', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const reports = await storage.getComplianceReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching compliance reports:", error);
      res.status(500).json({ message: "Failed to fetch compliance reports" });
    }
  });

  app.post('/api/compliance/reports/generate', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { reportType, period } = req.body;

      if (!reportType || !period) {
        return res.status(400).json({ message: "Report type and period are required" });
      }

      let report;
      if (reportType === 'daily_summary') {
        const date = new Date(period);
        report = await storage.generateDailyComplianceReport(date);
      } else if (reportType === 'weekly_compliance') {
        const startDate = new Date(period);
        report = await storage.generateWeeklyComplianceReport(startDate);
      } else if (reportType === 'monthly_regulatory') {
        const [year, month] = period.split('-');
        report = await storage.generateMonthlyRegulatoryReport(parseInt(month), parseInt(year));
      } else {
        return res.status(400).json({ message: "Invalid report type" });
      }

      res.json({ message: "Report generated successfully", report });
    } catch (error) {
      console.error("Error generating compliance report:", error);
      res.status(500).json({ message: "Failed to generate compliance report" });
    }
  });

  // AML Transaction Monitoring (called during transaction processing)
  app.post('/api/aml/check-transaction', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const { userId, amount, transactionId } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ message: "User ID and amount are required" });
      }

      const alerts = await storage.checkTransactionForAmlViolations(userId, parseFloat(amount), transactionId);
      
      res.json({ 
        alertsGenerated: alerts.length,
        alerts: alerts.map(alert => ({
          id: alert.id,
          alertType: alert.alertType,
          riskScore: alert.riskScore,
          description: alert.description
        }))
      });
    } catch (error) {
      console.error("Error checking transaction for AML violations:", error);
      res.status(500).json({ message: "Failed to check transaction for AML violations" });
    }
  });

  // Bank of Zambia Integration Routes
  app.get('/api/boz/reports', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Bank of Zambia access required" });
      }

      // Get all compliance reports for BoZ submission
      const reports = await storage.getComplianceReports();
      const bozReports = reports.filter(r => r.reportType.startsWith('boz_') || 
        ['daily_summary', 'weekly_compliance', 'monthly_regulatory'].includes(r.reportType));
      
      res.json(bozReports);
    } catch (error) {
      console.error("Error fetching BoZ reports:", error);
      res.status(500).json({ message: "Failed to fetch Bank of Zambia reports" });
    }
  });

  app.post('/api/boz/reports/generate', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Bank of Zambia access required" });
      }

      const { reportType, period } = req.body;
      const integrationManager = require('./integrationManager').integrationManager;
      
      const bozReport = await integrationManager.generateBankOfZambiaReport(reportType, period);
      
      res.json({
        message: "Bank of Zambia report generated successfully",
        report: bozReport,
        submissionRequired: bozReport.submissionRequired
      });
    } catch (error) {
      console.error("Error generating BoZ report:", error);
      res.status(500).json({ message: "Failed to generate Bank of Zambia report" });
    }
  });

  // RTGS Settlement Integration
  app.post('/api/rtgs/generate-instruction', isFirebaseAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['admin', 'finance'].includes(user.role)) {
        return res.status(403).json({ message: "Finance or admin access required" });
      }

      const { settlementRequestId } = req.body;
      const settlementRequest = await storage.getAllSettlementRequests();
      const request = settlementRequest.find(r => r.id === settlementRequestId);
      
      if (!request || request.status !== 'approved') {
        return res.status(400).json({ message: "Settlement request not found or not approved" });
      }

      const integrationManager = require('./integrationManager').integrationManager;
      const rtgsInstruction = await integrationManager.generateRTGSInstruction({
        amount: request.amount,
        currency: 'ZMW',
        beneficiaryBank: request.bankName,
        beneficiaryAccount: request.accountNumber,
        beneficiaryName: request.description || 'Merchant Settlement',
        purpose: 'E-MONEY_SETTLEMENT',
        settlementRequestId: request.id,
        organizationId: request.organizationId
      });

      res.json({
        message: "RTGS instruction generated for manual processing",
        instruction: rtgsInstruction,
        processingNote: "Please process this RTGS instruction through your banking portal"
      });
    } catch (error) {
      console.error("Error generating RTGS instruction:", error);
      res.status(500).json({ message: "Failed to generate RTGS instruction" });
    }
  });

  // Setup WebSocket for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log('Received WebSocket message:', data);
        
        // Broadcast to all connected clients except sender
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  return httpServer;
}
