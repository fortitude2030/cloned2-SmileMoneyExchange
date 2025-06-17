import type { Express, RequestHandler } from "express";
import { nanoid } from "nanoid";
import { storage } from "./storage";

// Simple token-based authentication for development
const activeTokens = new Map<string, { userId: string, expiresAt: number }>();

export async function setupDevAuth(app: Express) {
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

      // Generate authentication token
      const token = nanoid(32);
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      activeTokens.set(token, { userId: user.id, expiresAt });

      res.json({ user, token, message: "Logged in successfully" });
    } catch (error) {
      console.error("Dev login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Development logout endpoint
  app.post('/api/dev-logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      activeTokens.delete(token);
    }
    res.json({ message: "Logged out successfully" });
  });

  // Get current user endpoint
  app.get('/api/auth/user', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const tokenData = activeTokens.get(token);
      
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        if (tokenData) activeTokens.delete(token);
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(tokenData.userId);
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
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const tokenData = activeTokens.get(token);
    
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      if (tokenData) activeTokens.delete(token);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(tokenData.userId);
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