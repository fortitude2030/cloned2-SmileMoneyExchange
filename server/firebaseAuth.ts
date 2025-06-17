import admin from 'firebase-admin';
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
}

export async function setupFirebaseAuth(app: Express) {
  // Firebase token verification endpoint
  app.post('/api/auth/firebase-verify', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Check if user exists in our system, if not create them
      let user = await storage.getUser(firebaseUid);
      
      if (!user) {
        // Create new user with default role (they'll need admin approval for role assignment)
        user = await storage.upsertUser({
          id: firebaseUid,
          email: email,
          firstName: decodedToken.name?.split(' ')[0] || 'User',
          lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
          role: 'pending', // New users start as pending until admin assigns role
          profileImageUrl: decodedToken.picture || null,
        });
      }

      // Set session
      if (req.session) {
        (req.session as any).user = {
          claims: {
            sub: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role
          }
        };
      }

      res.json(user);
    } catch (error) {
      console.error('Firebase auth verification error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.json({ message: 'Logged out successfully' });
    }
  });
}

// Firebase authentication middleware
export const isFirebaseAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.session.user.claims.sub;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role === 'pending') {
      return res.status(403).json({ message: "Account pending approval" });
    }

    req.user = req.session.user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};