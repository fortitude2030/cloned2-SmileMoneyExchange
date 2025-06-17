# Firebase Authentication Test Accounts - Testco E-Money Platform

## Ready-to-Use Test Credentials

### 1. Admin User ✅
- **Email**: `admin@testco.com`
- **Password**: `TestAdmin123!`
- **Role**: Admin
- **Dashboard**: Admin Dashboard with KYC review capabilities
- **Features**: User management, organization oversight, document approval

### 2. Finance Officer ✅
- **Email**: `finance@testco.com`
- **Password**: `TestFinance123!`
- **Role**: Finance
- **Organization**: Testco Financial Services
- **Dashboard**: Finance Portal with settlement management
- **Features**: Settlement requests, compliance reporting, transaction oversight

### 3. Merchant User ✅
- **Email**: `merchant@testco.com`
- **Password**: `TestMerchant123!`
- **Role**: Merchant
- **Organization**: Testco Financial Services
- **Dashboard**: Merchant Dashboard with payment processing
- **Features**: Transaction management, payment requests, settlement requests

### 4. Cashier User ✅
- **Email**: `cashier@testco.com`
- **Password**: `TestCashier123!`
- **Role**: Cashier
- **Organization**: Testco Financial Services
- **Dashboard**: Cashier Dashboard with transaction processing
- **Features**: Cash-in/cash-out operations, QR code scanning, daily limits

## Test Organization
- **Name**: Testco Financial Services
- **Type**: Financial Institution
- **Description**: Licensed e-money issuer for testing KYC workflows

## KYC Testing Documents Required
- Selfie photo
- NRC Side 1 & 2
- Passport face page
- PACRA certificate
- ZRA TPIN certificate

## How to Test Firebase Authentication

### Step 1: Access the Login Screen
- Open the application and you'll see the Firebase login screen
- Choose between "Sign In" and "Create Account" options
- Password reset functionality is available via "Forgot password?" link

### Step 2: Login with Test Credentials
Use any of the credentials above to test different user roles:
```
Admin: admin@testco.com / TestAdmin123!
Finance: finance@testco.com / TestFinance123!
Merchant: merchant@testco.com / TestMerchant123!
Cashier: cashier@testco.com / TestCashier123!
```

### Step 3: Test KYC Document Upload
- New users are automatically redirected to organization setup
- Upload 6 required documents: Selfie, NRC sides, Passport, PACRA, ZRA TPIN
- Documents are compressed to <2MB and stored as PDFs
- File naming: `kyc-[org]-[firstname]-[lastname]-[doctype].pdf`

### Step 4: Admin KYC Review
- Login as admin to review pending KYC documents
- Approve or reject submissions with reasons
- Organization status updates automatically

### Step 5: Role-Based Dashboard Access
- Each role redirects to appropriate dashboard
- Role-based permissions enforce access control
- Real-time updates via WebSocket connections

## Database Setup Complete
- Test organization "Testco Financial Services" created
- All user accounts configured with proper roles
- Wallets initialized with appropriate limits
- Main branch established with 1M ZMW balance

## Next Phase: AML Monitoring & Regulatory Compliance
The authentication and KYC systems are fully operational. Ready to proceed with the final phase implementing AML monitoring, configurable thresholds, and automated regulatory reporting.