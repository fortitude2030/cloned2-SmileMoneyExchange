# Smile Money E-Money Platform

A comprehensive licensed e-money platform for Zambia's financial services sector, providing secure B2B cash management solutions with full regulatory compliance and advanced accounting capabilities.

## 🌟 Key Features

### Core Platform
- **Multi-Role Authentication**: Secure role-based access (Admin, Finance, Merchant, Cashier)
- **QR Code Payments**: Generate and scan QR codes for instant transactions
- **Real-time Monitoring**: Live transaction tracking and balance updates
- **Mobile-First Design**: Responsive interface optimized for mobile devices
- **Firebase Integration**: Secure authentication and real-time data sync
- **ZMW Currency Support**: Native Zambian Kwacha transaction processing

### Financial Management
- **Double-Entry Accounting**: Complete chart of accounts with automated journal entries
- **Float Reconciliation**: Real-time balance verification and variance detection
- **Financial Statements**: Balance sheet, income statement, and equity reporting
- **Revenue Tracking**: Automated fee calculation and revenue management
- **System Float Management**: Cash reserves monitoring and adjustment capabilities

### Compliance & Security
- **AML Compliance**: Advanced anti-money laundering monitoring and alerts
- **KYC Documentation**: Know Your Customer verification and document management
- **Audit Trails**: Comprehensive logging for regulatory compliance
- **Bank of Zambia Reporting**: Automated regulatory submission capabilities

### Communications
- **Email Integration**: SMTP-based notifications and report delivery
- **SMS Notifications**: Zamtel API integration for mobile communications
- **Multi-Channel Alerts**: Configurable notification preferences

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Firebase project with authentication enabled

### Installation
```bash
npm install
npm run db:push
npm run dev
```

### Environment Setup
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase admin SDK key

### Default Login
Access the admin dashboard with the default credentials provided during setup.

## 📋 System Architecture

### Technology Stack
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Firebase Auth
- **Deployment**: Replit (Production: cash.smilemoney.africa)

### Key Components
- **Admin Dashboard**: Complete platform management interface
- **Merchant Portal**: Transaction processing and wallet management
- **Cashier Interface**: QR code scanning and settlement processing
- **Float Reconciliation**: Balance verification and variance monitoring
- **Accounting System**: Double-entry bookkeeping with financial reporting

## 💼 Business Features

### Settlement Processing
- Real-time settlement request management
- Multi-tier approval workflows
- RTGS integration for bank transfers
- Automated compliance checking

### Financial Reporting
- Daily, weekly, and monthly financial statements
- Revenue analysis and fee tracking
- Regulatory report generation
- Cash flow monitoring

### Risk Management
- AML transaction monitoring
- Suspicious activity detection
- Account lockdown capabilities
- Audit trail maintenance

## 🔧 Configuration

### Float Management
System float is managed through Cash Reserves account (Account Code: 1100):
- Navigate to Admin Dashboard → Accounting → Float Reconciliation
- Configure daily float allocations
- Monitor variance thresholds (ZMW 1000)
- Track locked accounts and negative balances

### Communications Setup
Configure email and SMS services:
- Email: SMTP settings for notifications
- SMS: Zamtel API credentials for mobile alerts
- Templates: Customizable message templates

## 📊 Monitoring & Analytics

### Key Metrics
- Transaction volume and value
- Settlement success rates
- Float utilization efficiency
- Compliance violation rates

### Real-time Dashboards
- Live transaction monitoring
- Balance reconciliation status
- AML alert notifications
- System performance metrics

## 🛡️ Security Features

### Double-Spending Prevention
- Atomic database transactions
- Idempotency key validation
- Account balance locking
- Transaction state management

### Disaster Recovery
- Automated database backups
- Point-in-time recovery capabilities
- Geographic backup distribution
- Business continuity procedures

## 📈 Future Roadmap

### Priority Features (0-3 months)
- Security Cashier Float Management
- Enhanced Double-Spending Prevention
- Disaster Recovery Implementation
- Real-time AML Monitoring

### Growth Features (3-12 months)
- Mobile Application Development
- Advanced Analytics Dashboard
- Multi-Currency Support
- Merchant POS Integration

For detailed roadmap information, see `FUTURE_FEATURES_ROADMAP.md`.

## 📝 Documentation

- `TECHNICAL_DOCUMENTATION.md`: System architecture and APIs
- `FUTURE_FEATURES_ROADMAP.md`: Development priorities and timelines
- `CHANGELOG.md`: Version history and updates
- `PRODUCTION_DEPLOYMENT_STATUS.md`: Deployment configuration

## 📞 Support

For technical support and business inquiries:
- Platform: Replit Enterprise
- Domain: cash.smilemoney.africa
- Documentation: Available in repository docs folder

## 📄 License

Licensed e-money platform for Zambian financial services operations.
