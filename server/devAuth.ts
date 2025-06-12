import type { Express, RequestHandler } from "express";
import session from "express-session";
import { storage } from "./storage";

// Simple development authentication for testing
export async function setupDevAuth(app: Express) {
  // Setup session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: true, // Enable for auto-login
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Auto-login middleware for development - creates admin session if none exists
  app.use(async (req, res, next) => {
    const session = req.session as any;
    
    // Skip auto-login for login/logout endpoints
    if (req.path.includes('/api/dev-login') || req.path.includes('/api/dev-logout')) {
      return next();
    }
    
    // If not authenticated, auto-login as admin for development
    if (!session.authenticated) {
      try {
        const testUserId = 'test-admin-user';
        const testEmail = 'admin@testco.com';
        
        let user = await storage.getUser(testUserId);
        if (!user) {
          user = await storage.upsertUser({
            id: testUserId,
            email: testEmail,
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            profileImageUrl: null,
          });
        }
        
        session.userId = user.id;
        session.authenticated = true;
        
        // Save session explicitly
        session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
          }
          next();
        });
      } catch (error) {
        console.error("Auto-login error:", error);
        next();
      }
    } else {
      next();
    }
  });
  // Development login endpoint
  app.post('/api/dev-login', async (req, res) => {
    try {
      const { role } = req.body;
      
      if (!role || !['merchant', 'cashier', 'finance', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Use fixed test user IDs for each role to avoid duplicates
      const testUserId = `test-${role}-user`;
      const testEmail = `${role}@testco.com`;
      
      // Try to get existing user first
      let user = await storage.getUser(testUserId);
      
      if (!user) {
        // Create new test user
        user = await storage.upsertUser({
          id: testUserId,
          email: testEmail,
          firstName: role.charAt(0).toUpperCase() + role.slice(1),
          lastName: "User",
          role: role,
          profileImageUrl: null,
        });
      }

      // Set session
      if (!req.session) {
        return res.status(500).json({ message: "Session not available" });
      }
      
      (req.session as any).userId = user.id;
      (req.session as any).authenticated = true;

      res.json({ user, message: "Logged in successfully" });
    } catch (error) {
      console.error("Dev login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Development logout endpoint
  app.post('/api/dev-logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user endpoint
  app.get('/api/auth/user', async (req, res) => {
    try {
      const session = req.session as any;
      
      if (!session.authenticated || !session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });
}

// Simple authentication middleware for development
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const session = req.session as any;
    
    if (!session.authenticated || !session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user to request for downstream use
    (req as any).user = { claims: { sub: user.id } };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};