import admin from 'firebase-admin';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Firebase Admin setup - requires service account key
// Download from Firebase Console -> Project Settings -> Service Accounts
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      // Note: In production, use service account key file
      // credential: admin.credential.cert(require('./firebase-service-account.json'))
    });
  } catch (error) {
    console.log('Firebase Admin initialization failed - service account key required');
  }
}

const testUsers = [
  {
    email: 'admin@testco.com',
    password: 'SmileAdmin2025!',
    role: 'admin',
    displayName: 'Admin User',
    oldId: 'firebase_admin_uid_12345'
  },
  {
    email: 'finance@testco.com',
    password: 'SmileFinance2025!',
    role: 'finance',
    displayName: 'Finance User',
    oldId: 'firebase_finance_uid_12345'
  },
  {
    email: 'merchant@testco.com',
    password: 'SmileMerchant2025!',
    role: 'merchant',
    displayName: 'Merchant User',
    oldId: 'firebase_merchant_uid_12345'
  },
  {
    email: 'cashier@testco.com',
    password: 'SmileCashier2025!',
    role: 'cashier',
    displayName: 'Cashier User',
    oldId: 'firebase_cashier_uid_12345'
  }
];

async function createFirebaseUsers() {
  console.log('=== FIREBASE USER CREATION ===\n');
  
  const createdUsers = [];
  
  for (const userData of testUsers) {
    try {
      // Create Firebase user
      const userRecord = await admin.auth().createUser({
        uid: undefined, // Let Firebase generate UID
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        emailVerified: true,
      });

      console.log(`✓ Created Firebase user: ${userData.email}`);
      console.log(`  UID: ${userRecord.uid}`);
      console.log(`  Password: ${userData.password}`);
      
      createdUsers.push({
        email: userData.email,
        password: userData.password,
        role: userData.role,
        firebaseUid: userRecord.uid,
        oldId: userData.oldId
      });
      
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log(`- User ${userData.email} already exists in Firebase`);
        
        // Get existing user
        const existingUser = await admin.auth().getUserByEmail(userData.email);
        createdUsers.push({
          email: userData.email,
          password: userData.password,
          role: userData.role,
          firebaseUid: existingUser.uid,
          oldId: userData.oldId
        });
        
        console.log(`  Existing UID: ${existingUser.uid}`);
      } else {
        console.error(`✗ Error creating ${userData.email}:`, error.message);
      }
    }
  }
  
  return createdUsers;
}

async function updateDatabaseUIDs(createdUsers) {
  console.log('\n=== UPDATING DATABASE UIDS ===\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found');
    return;
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });
  
  for (const user of createdUsers) {
    try {
      // Update user ID from placeholder to real Firebase UID
      const result = await db.execute(`
        UPDATE users SET id = $1 WHERE id = $2 RETURNING email, role
      `, [user.firebaseUid, user.oldId]);
      
      console.log(`✓ Updated database: ${user.email} → ${user.firebaseUid.slice(0, 8)}...`);
      
    } catch (error) {
      console.error(`✗ Database update failed for ${user.email}:`, error.message);
    }
  }
  
  await pool.end();
}

async function displayCredentials(createdUsers) {
  console.log('\n=== PRODUCTION LOGIN CREDENTIALS ===\n');
  
  createdUsers.forEach(user => {
    console.log(`${user.role.toUpperCase()} USER:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${user.password}`);
    console.log(`  Firebase UID: ${user.firebaseUid}`);
    console.log('');
  });
  
  console.log('SECURITY NOTES:');
  console.log('- Change passwords after first login');
  console.log('- Use strong passwords for production');
  console.log('- Enable 2FA where possible');
  console.log('- Store credentials securely');
}

async function main() {
  try {
    const createdUsers = await createFirebaseUsers();
    await updateDatabaseUIDs(createdUsers);
    await displayCredentials(createdUsers);
    
    console.log('\n✓ Firebase user setup complete!');
    console.log('Users can now login at your domain with the credentials above.');
    
  } catch (error) {
    console.error('Setup failed:', error.message);
    console.log('\nManual setup required:');
    console.log('1. Download Firebase service account key');
    console.log('2. Create users manually in Firebase Console');
    console.log('3. Update database UIDs manually');
  }
}

main().catch(console.error);