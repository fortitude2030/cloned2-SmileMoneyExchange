import admin from 'firebase-admin';

// Test Firebase Authentication and User Management System
async function testSystemWide() {
  console.log('🔧 Starting comprehensive system test...\n');

  // Initialize Firebase Admin
  if (!admin.apps.length) {
    const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey)
    });
  }

  const auth = admin.auth();

  // Test 1: Verify Firebase Authentication Service
  console.log('1. Testing Firebase Authentication Service...');
  try {
    const listUsers = await auth.listUsers(1);
    console.log('   ✓ Firebase Admin SDK connected successfully');
    console.log(`   ✓ Found ${listUsers.users.length > 0 ? listUsers.users.length : 'no'} user(s) in Firebase`);
  } catch (error) {
    console.log('   ✗ Firebase connection failed:', error.message);
    return;
  }

  // Test 2: Test token generation for existing users
  console.log('\n2. Testing token generation for system users...');
  try {
    const testUsers = [
      'FSb5tS4S94aQQ2cACrYcMP8wPTl2', // admin
      'Rf8hK2Lm9XcVwE3nT6pQ1sA4bD7j', // finance
      'Yp2kN8sR5tFv9mL3qX6hB1cW4nE7', // merchant
      'Qw9rT5yU8iO3pA6sD2fG7hJ4kL1z'  // cashier
    ];

    for (const uid of testUsers) {
      try {
        const customToken = await auth.createCustomToken(uid);
        console.log(`   ✓ Generated token for user ${uid.substring(0, 8)}...`);
        
        // Verify user exists
        const userRecord = await auth.getUser(uid);
        console.log(`   ✓ User verified: ${userRecord.email || 'No email'}`);
      } catch (error) {
        console.log(`   ✗ Failed for user ${uid.substring(0, 8)}...: ${error.message}`);
      }
    }
  } catch (error) {
    console.log('   ✗ Token generation test failed:', error.message);
  }

  // Test 3: Database connectivity
  console.log('\n3. Testing database connectivity...');
  try {
    const response = await fetch('http://localhost:5000/api/health');
    if (response.ok) {
      console.log('   ✓ Server health check passed');
    } else {
      console.log('   ✗ Server health check failed');
    }
  } catch (error) {
    console.log('   ✗ Database connection test failed:', error.message);
  }

  // Test 4: API endpoint testing
  console.log('\n4. Testing API endpoints...');
  const endpoints = [
    '/api/auth/user',
    '/api/admin/users',
    '/api/admin/organizations',
    '/api/admin/transactions',
    '/api/settlement-requests',
    '/api/aml/alerts',
    '/api/aml/configuration'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`);
      console.log(`   ${response.status === 401 ? '✓' : '?'} ${endpoint} - Status: ${response.status} ${response.status === 401 ? '(Expected - requires auth)' : ''}`);
    } catch (error) {
      console.log(`   ✗ ${endpoint} - Error: ${error.message}`);
    }
  }

  // Test 5: Environment variables
  console.log('\n5. Testing environment configuration...');
  const requiredEnvVars = [
    'DATABASE_URL',
    'FIREBASE_SERVICE_ACCOUNT_KEY',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  for (const envVar of requiredEnvVars) {
    const exists = !!process.env[envVar];
    console.log(`   ${exists ? '✓' : '✗'} ${envVar}: ${exists ? 'Present' : 'Missing'}`);
  }

  console.log('\n🎯 System test completed!');
  console.log('\nNext steps for manual testing:');
  console.log('1. Open the application in browser');
  console.log('2. Test login with each user role');
  console.log('3. Verify dashboard functionality');
  console.log('4. Test user management features');
  console.log('5. Verify AML monitoring systems');
}

// Run the test
testSystemWide().catch(console.error);