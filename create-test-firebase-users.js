// Script to create test users in our database for Firebase authentication
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

// Test Firebase UIDs (will need to be replaced with real ones after Firebase user creation)
const testUsers = [
  {
    id: 'firebase_admin_uid_12345',
    email: 'admin@testco.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    phone: '+260971234567',
    isActive: true,
    profileImageUrl: null,
    organizationId: null
  },
  {
    id: 'firebase_finance_uid_12345',
    email: 'finance@testco.com',
    firstName: 'Finance',
    lastName: 'User',
    role: 'finance',
    phone: '+260971234568',
    isActive: true,
    profileImageUrl: null,
    organizationId: 1
  },
  {
    id: 'firebase_merchant_uid_12345',
    email: 'merchant@testco.com',
    firstName: 'Merchant',
    lastName: 'User',
    role: 'merchant',
    phone: '+260971234569',
    isActive: true,
    profileImageUrl: null,
    organizationId: 1
  },
  {
    id: 'firebase_cashier_uid_12345',
    email: 'cashier@testco.com',
    firstName: 'Cashier',
    lastName: 'User',
    role: 'cashier',
    phone: '+260971234570',
    isActive: true,
    profileImageUrl: null,
    organizationId: 1
  }
];

async function createTestUsers() {
  console.log('Creating test users in database...');
  
  for (const user of testUsers) {
    try {
      const result = await db.execute(`
        INSERT INTO users (id, email, first_name, last_name, role, phone, is_active, profile_image_url, organization_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          phone = EXCLUDED.phone,
          is_active = EXCLUDED.is_active,
          profile_image_url = EXCLUDED.profile_image_url,
          organization_id = EXCLUDED.organization_id
        RETURNING id, email, role
      `, [
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.role,
        user.phone,
        user.isActive,
        user.profileImageUrl,
        user.organizationId
      ]);
      
      console.log(`✓ Created/updated user: ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`✗ Error creating user ${user.email}:`, error.message);
    }
  }
  
  console.log('\nTest users created in database!');
  console.log('\nTest credentials (need Firebase setup):');
  testUsers.forEach(user => {
    console.log(`${user.role}: ${user.email} (Firebase UID: ${user.id})`);
  });
  
  await pool.end();
}

createTestUsers().catch(console.error);