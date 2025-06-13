import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupDevAuth, isAuthenticated } from "./devAuth";
import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  insertOrganizationSchema,
  insertBranchSchema,
  insertTransactionSchema,
  insertDocumentSchema,
  insertSettlementRequestSchema,
  insertQrCodeSchema,
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
      cb(new Error('Only camera images are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupDevAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Organization routes
  app.post('/api/organizations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.get('/api/organizations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const organizations = await storage.getOrganizationsByUserId(userId);
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  // Branch routes
  app.post('/api/branches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.get('/api/branches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Fetch merchant wallets for finance portal
  app.get('/api/merchant-wallets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.get('/api/settlement-breakdown', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance' || !user.organizationId) {
        return res.status(403).json({ message: "Only finance officers can access settlement data" });
      }

      const breakdown = await storage.getSettlementBreakdown(user.organizationId);
      const pendingTotal = await storage.getPendingSettlementsTotal(user.organizationId);
      
      res.json({
        breakdown,
        pendingTotal
      });
    } catch (error) {
      console.error("Error fetching settlement breakdown:", error);
      res.status(500).json({ message: "Failed to fetch settlement breakdown" });
    }
  });

  // Wallet routes
  app.get('/api/wallet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post('/api/wallet/reset-daily', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post('/api/admin/force-daily-reset', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post('/api/wallet/force-reset', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post('/api/transactions', isAuthenticated, async (req: any, res) => {
    console.log("POST /api/transactions - Request received");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User:", req.user?.claims?.sub);
    
    const userId = req.user.claims.sub;
    
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

  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      let transactions;
      if (user?.role === 'cashier') {
        // Cashiers see all transactions they've processed, including timed-out/rejected ones
        transactions = await storage.getAllTransactionsByCashier(userId);
      } else {
        // Other users see transactions with standard filtering
        transactions = await storage.getTransactionsByUserId(userId);
      }
      
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin endpoint to view all transactions
  app.get('/api/admin/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admin users can view all transactions" });
      }
      
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching admin transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/transactions/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.get('/api/transactions/qr-verification', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.patch('/api/transactions/:id/priority', isAuthenticated, async (req: any, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const { priority } = req.body;
      const userId = req.user.claims.sub;
      
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

  app.patch('/api/transactions/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const { status, rejectionReason, verifiedAmount, verifiedVmfNumber } = req.body;
      const cashierId = req.user.claims.sub;
      
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
  app.post('/api/documents', isAuthenticated, (req: any, res, next) => {
    upload.single('file')(req, res, (err) => {
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
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      let finalFilename = req.file.filename;
      let finalMimeType = req.file.mimetype;
      let finalSize = req.file.size;
      
      // Optimized processing - keep original format for faster uploads
      const isImage = req.file.mimetype.startsWith('image/');
      if (isImage) {
        // Just keep the image as-is for faster processing
        // No PDF conversion to eliminate processing bottleneck
        finalFilename = req.file.filename;
        finalMimeType = req.file.mimetype;
        finalSize = req.file.size;
      }

      const documentData = insertDocumentSchema.parse({
        userId,
        transactionId: req.body.transactionId ? parseInt(req.body.transactionId) : null,
        filename: finalFilename,
        originalName: req.file.originalname,
        mimeType: finalMimeType,
        size: finalSize,
        type: req.body.type || 'vmf_document',
      });

      const document = await storage.createDocument(documentData);
      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(400).json({ message: "Failed to upload document" });
    }
  });

  // Settlement request routes
  app.post('/api/settlement-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'finance' || !user.organizationId) {
        return res.status(403).json({ message: "Only finance officers with organizations can create settlement requests" });
      }

      // Calculate settlement capacity based on today's collections for finance users
      const todaysCollections = await storage.getTodaysCollectionsByOrganization(user.organizationId);
      const pendingTotal = await storage.getPendingSettlementsTotal(user.organizationId);
      const settlementCapacity = Math.max(0, todaysCollections - pendingTotal);
      
      const requestAmount = Math.floor(parseFloat(req.body.amount || '0'));
      
      // Validate against settlement capacity
      if (requestAmount > settlementCapacity) {
        return res.status(400).json({ 
          message: `Insufficient settlement capacity. Available: ZMW ${settlementCapacity.toLocaleString()}, Requested: ZMW ${requestAmount.toLocaleString()}`,
          todaysCollections,
          pendingTotal,
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

  app.get('/api/settlement-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.patch('/api/settlement-requests/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post('/api/qr-codes/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { transactionId } = req.body;
      const userId = req.user.claims.sub;
      
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

  app.post('/api/qr-codes/verify', isAuthenticated, async (req: any, res) => {
    try {
      const { qrData } = req.body;
      const userId = req.user.claims.sub;
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
  app.patch('/api/admin/settlement-requests/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
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

  app.patch('/api/admin/settlement-requests/:id/release', isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
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

  app.patch('/api/admin/settlement-requests/:id/hold', isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const { holdReason, reasonComment } = req.body;
      const userId = req.user.claims.sub;
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

  app.patch('/api/admin/settlement-requests/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      const { rejectReason, reasonComment } = req.body;
      const userId = req.user.claims.sub;
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
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getNotificationsByUserId(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Development endpoint to create test settlement requests
  app.post('/api/dev/settlement-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
