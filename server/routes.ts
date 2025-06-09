import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { jsPDF } from "jspdf";
import { storage } from "./storage";
import { setupDevAuth, isAuthenticated } from "./devAuth";
import {
  insertOrganizationSchema,
  insertBranchSchema,
  insertTransactionSchema,
  insertDocumentSchema,
  insertSettlementRequestSchema,
} from "@shared/schema";

// Convert image to PDF function using base64 encoding
async function convertImageToPDF(imagePath: string, outputPath: string): Promise<void> {
  try {
    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
    
    // Create PDF document
    const pdf = new jsPDF();
    
    // Add image to PDF (auto-sizing to fit page)
    pdf.addImage(`data:image/${mimeType.toLowerCase()};base64,${base64Image}`, mimeType, 10, 10, 180, 240);
    
    // Save PDF
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    fs.writeFileSync(outputPath, pdfBuffer);
    
  } catch (error) {
    console.error('Error converting image to PDF:', error);
    throw error;
  }
}

// File upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

      const branchData = insertBranchSchema.parse({
        ...req.body,
        organizationId,
      });
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

  // Wallet routes
  app.get('/api/wallet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallet = await storage.getOrCreateWallet(userId);
      
      // Get today's transaction totals
      const todayTotals = await storage.getTodayTransactionTotals(userId);
      
      res.json({
        ...wallet,
        todayCompleted: todayTotals.completed,
        todayTotal: todayTotals.total
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

  // Transaction routes
  app.post('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Auto-approve RTP transactions (cash_digitization) - no pending status
      let finalStatus = req.body.status;
      if (req.body.type === 'cash_digitization' && req.body.status === 'pending') {
        finalStatus = 'completed';
      }
      
      // Set expiration time only for QR transactions that remain pending
      const expiresAt = (req.body.status === 'pending' && req.body.type === 'qr_code_payment') 
        ? new Date(Date.now() + 60 * 1000) 
        : null;
      
      // Round the amount to ensure no decimals
      const roundedAmount = Math.round(parseFloat(req.body.amount || "0"));
      
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        status: finalStatus,
        amount: roundedAmount.toString(),
        fromUserId: req.body.fromUserId || userId,
        expiresAt,
      });
      
      const amount = roundedAmount;
      
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
      res.status(400).json({ message: "Failed to create transaction" });
    }
  });

  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getTransactionsByUserId(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
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

      // For QR code transactions, set the cashier as the processor
      if (transaction.type === 'qr_code_payment' && status === 'completed') {
        await storage.updateTransactionProcessor(transactionId, cashierId);
      }

      // Update transaction status with rejection reason if provided
      await storage.updateTransactionStatus(transactionId, status, rejectionReason);
      
      // If approved, update wallet balances
      if (status === 'completed' && transaction.toUserId) {
        const wallet = await storage.getOrCreateWallet(transaction.toUserId);
        const newBalance = (parseFloat(wallet.balance || "0") + parseFloat(transaction.amount)).toString();
        await storage.updateWalletBalance(transaction.toUserId, newBalance);
      }

      res.json({ message: "Transaction status updated" });
    } catch (error) {
      console.error("Error updating transaction status:", error);
      res.status(500).json({ message: "Failed to update transaction status" });
    }
  });

  // Document upload routes
  app.post('/api/documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      let finalFilename = req.file.filename;
      let finalMimeType = req.file.mimetype;
      let finalSize = req.file.size;
      
      // If uploaded file is an image, convert to PDF and delete original
      const isImage = req.file.mimetype.startsWith('image/');
      if (isImage) {
        const originalPath = req.file.path;
        const pdfFilename = `${req.file.filename}.pdf`;
        const pdfPath = path.join('uploads', pdfFilename);
        
        try {
          // Convert image to PDF
          await convertImageToPDF(originalPath, pdfPath);
          
          // Delete original image file for security
          fs.unlinkSync(originalPath);
          
          // Update file info to PDF
          finalFilename = pdfFilename;
          finalMimeType = 'application/pdf';
          finalSize = fs.statSync(pdfPath).size;
          
        } catch (conversionError) {
          console.error('PDF conversion failed:', conversionError);
          // Clean up files on error
          if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
          if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
          return res.status(500).json({ message: "Failed to process image file" });
        }
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

      const requestData = insertSettlementRequestSchema.parse({
        ...req.body,
        userId,
        organizationId: user.organizationId,
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
        // Admins see all pending requests
        const requests = await storage.getPendingSettlementRequests();
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
