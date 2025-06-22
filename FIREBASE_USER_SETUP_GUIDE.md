# Firebase User Setup Guide for Smile Money Platform

## Current Authentication Status

### ❌ Current Issue
The database contains placeholder Firebase UIDs that cannot authenticate. Real Firebase users must be created for production login.

### Database Users (Placeholder IDs - Cannot Login)
```
firebase_admin_uid_12345    | admin@testco.com    | admin
firebase_finance_uid_12345  | finance@testco.com  | finance  
firebase_merchant_uid_12345 | merchant@testco.com | merchant
firebase_cashier_uid_12345  | cashier@testco.com  | cashier
```

## 1. ADMIN USER MANAGEMENT INTERFACE ✅

### User Creation Flow (Working)
The admin panel includes a complete user creation interface:

**Location**: Admin Dashboard → Users Tab → Create User button

**Form Fields**:
- Email* (required)
- Phone Number* (required) 
- First Name* (required)
- Last Name* (required)
- Role* (Admin, Finance Officer, Merchant, Cashier)
- Organization (required for non-admin users)

**Backend Process**:
1. Validates all required fields
2. Checks for duplicate email/phone
3. Generates temporary password 
4. Creates database record with placeholder Firebase ID
5. Creates wallet for non-admin users
6. Returns temporary password for Firebase setup

### Current Limitation
The system creates database records but doesn't create actual Firebase accounts. Manual Firebase setup is required.

## 2. FIREBASE USER CREATION SCRIPT

### Automated Setup Script
```javascript
// firebase-user-setup.js
const admin = require('firebase-admin');

// Initialize Firebase Admin (requires service account key)
admin.initializeApp({
  credential: admin.credential.cert(require('./firebase-service-account.json')),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});

const testUsers = [
  {
    email: 'admin@testco.com',
    password: 'SmileAdmin2025!',
    role: 'admin',
    displayName: 'Admin User'
  },
  {
    email: 'finance@testco.com', 
    password: 'SmileFinance2025!',
    role: 'finance',
    displayName: 'Finance User'
  },
  {
    email: 'merchant@testco.com',
    password: 'SmileMerchant2025!', 
    role: 'merchant',
    displayName: 'Merchant User'
  },
  {
    email: 'cashier@testco.com',
    password: 'SmileCashier2025!',
    role: 'cashier', 
    displayName: 'Cashier User'
  }
];

async function createFirebaseUsers() {
  const createdUsers = [];
  
  for (const userData of testUsers) {
    try {
      // Create Firebase user
      const userRecord = await admin.auth().createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        emailVerified: true,
      });

      console.log(`✓ Created Firebase user: ${userData.email} (UID: ${userRecord.uid})`);
      
      createdUsers.push({
        email: userData.email,
        password: userData.password,
        role: userData.role,
        firebaseUid: userRecord.uid
      });
      
    } catch (error) {
      console.error(`✗ Error creating ${userData.email}:`, error.message);
    }
  }
  
  return createdUsers;
}

// Update database with real Firebase UIDs
async function updateDatabaseUIDs(createdUsers) {
  // Database update queries would go here
  console.log('Database UID updates needed:', createdUsers);
}

createFirebaseUsers()
  .then(updateDatabaseUIDs)
  .catch(console.error);
```

### Required Setup
1. Download Firebase service account key from Firebase Console
2. Save as `firebase-service-account.json` 
3. Run: `npm install firebase-admin`
4. Execute: `node firebase-user-setup.js`

## 3. MANUAL FIREBASE CONSOLE PROCESS

### Step-by-Step Manual Setup

#### A. Access Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your Smile Money project
3. Navigate to Authentication → Users

#### B. Create Each User Manually
For each user (admin, finance, merchant, cashier):

1. **Click "Add User"**
2. **Enter Details**:
   - Email: admin@testco.com
   - Password: SmileAdmin2025!
   - Email verified: ✅ Checked
3. **Copy the UID** (e.g., `abc123def456...`)
4. **Update Database**:
   ```sql
   UPDATE users SET id = 'abc123def456...' WHERE email = 'admin@testco.com';
   ```

#### C. Production User Credentials
**Admin User**:
- Email: admin@testco.com
- Password: SmileAdmin2025!
- Role: admin

**Finance User**:
- Email: finance@testco.com  
- Password: SmileFinance2025!
- Role: finance

**Merchant User**:
- Email: merchant@testco.com
- Password: SmileMerchant2025!
- Role: merchant

**Cashier User**:
- Email: cashier@testco.com
- Password: SmileCashier2025!
- Role: cashier

#### D. Verify Setup
1. Use login page at your domain
2. Enter email/password combinations above
3. Confirm role-based access works
4. Test AML configuration access (admin only)

## 4. NEW USER CREATION WORKFLOW

### For Adding New Users After Deployment

#### Admin Process
1. **Admin Dashboard**: Access Users tab
2. **Create User**: Fill out user creation form
3. **Note Details**: System provides temporary password
4. **Firebase Setup**: 
   - Create Firebase account with provided email
   - Use temporary password or set secure password
   - Copy Firebase UID
5. **Update Database**: Replace placeholder UID with real Firebase UID
6. **Send Credentials**: Provide login details to new user

#### Alternative: Direct Firebase Creation
1. **Firebase Console**: Create user directly 
2. **Database Insert**: Add user record with Firebase UID
3. **Assign Organization**: Link to appropriate organization
4. **Create Wallet**: For non-admin users

## 5. PRODUCTION DEPLOYMENT CHECKLIST

### Before Deployment
- [ ] Create Firebase service account key
- [ ] Run Firebase user creation script OR
- [ ] Manually create users in Firebase Console
- [ ] Update database with real Firebase UIDs
- [ ] Test login with all user roles
- [ ] Verify AML access controls
- [ ] Document final credentials securely

### Post-Deployment
- [ ] Test authentication on live domain
- [ ] Verify Firebase domain authorization
- [ ] Confirm role-based access working
- [ ] Update Firebase authorized domains list
- [ ] Secure credential distribution to team

## Security Notes
- Change default passwords immediately after deployment
- Use strong passwords (12+ characters, mixed case, numbers, symbols)
- Enable 2FA for admin accounts when possible
- Regularly rotate credentials
- Monitor Firebase authentication logs