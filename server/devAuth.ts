import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Simple development authentication for testing
export async function setupDevAuth(app: Express) {
  // Development login endpoint
  app.post('/api/dev-login', async (req, res) => {
    try {
      const { role } = req.body;
      
      if (!role || !['merchant', 'cashier', 'finance', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Create or get test user for the role
      const testUserId = `test-${role}-${Date.now()}`;
      const user = await storage.upsertUser({
        id: testUserId,
        email: `${role}@testco.com`,
        firstName: role.charAt(0).toUpperCase() + role.slice(1),
        lastName: "User",
        role: role,
        profileImageUrl: null,
      });

      // Set session
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