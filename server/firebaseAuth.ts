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

      // Set session using express-session structure
      if (req.session) {
        (req.session as any).user = {
          claims: {
            sub: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role
          }
        };
        await new Promise<void>((resolve, reject) => {
          req.session!.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      res.json(user);
    } catch (error) {
      console.error('Firebase auth verification error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  });

  // Get current user endpoint
  app.get('/api/auth/user', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let firebaseUid: string;
      
      // For testing with mock tokens during development
      if (idToken.startsWith('mock_firebase_token_')) {
        firebaseUid = idToken.replace('mock_firebase_token_', '');
      } else {
        // Verify the actual Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        firebaseUid = decodedToken.uid;
      }

      // Get user from our database
      const user = await storage.getUser(firebaseUid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        isActive: user.isActive
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
  });
}

// Firebase authentication middleware
export const isFirebaseAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let firebaseUid: string;
    
    // For testing with mock tokens during development
    if (idToken.startsWith('mock_firebase_token_')) {
      firebaseUid = idToken.replace('mock_firebase_token_', '');
    } else {
      // Verify the actual Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      firebaseUid = decodedToken.uid;
    }

    // Get user from our system
    const user = await storage.getUser(firebaseUid);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user has been assigned a role
    if (user.role === 'pending') {
      return res.status(403).json({ message: 'Account pending admin approval' });
    }

    // Attach user to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Firebase authentication error:', error);
    res.status(401).json({ message: 'Unauthorized' });
  }
};