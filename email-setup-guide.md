# Smile Money Email System Setup Guide

## Environment Variables Required

Add these environment variables to your Replit deployment or `.env` file:

```env
# SMTP Configuration for Email Service
SMTP_HOST=mail.smilemoney.co.zm
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@smilemoney.co.zm
SMTP_PASS=your_email_password_here
SMTP_FROM=Smile Money <noreply@smilemoney.co.zm>

# Production Domain
PRODUCTION_DOMAIN=smilemoney.co.zm
CORS_ORIGIN=https://smilemoney.co.zm
```

## Email System Features

### Automated Email Templates
- **Welcome Emails**: Sent to new users upon account creation
- **Transaction Notifications**: Real-time alerts for financial transactions
- **KYC Status Updates**: Verification status changes with detailed feedback
- **AML Compliance Alerts**: High-priority security notifications
- **Report Delivery**: Scheduled financial reports with attachments

### Email Endpoints Available
- `POST /api/notifications/send-welcome` - Welcome new users
- `POST /api/notifications/send-transaction-alert` - Transaction notifications
- `POST /api/notifications/send-aml-alert` - AML compliance alerts
- `POST /api/notifications/send-kyc-update` - KYC status notifications
- `POST /api/notifications/test-email` - Test email system connectivity

### Report Email Integration
- All report generation now includes email delivery options
- Automated scheduling with attachment support
- Bulk email delivery with rate limiting
- Professional HTML templates with Smile Money branding

## SMTP Provider Configuration

### For cPanel/Hosting Provider
```
Host: mail.yourdomain.com
Port: 587 (STARTTLS) or 465 (SSL)
Security: STARTTLS or SSL/TLS
Username: your-email@yourdomain.com
Password: your-email-password
```

### Testing Email Setup
1. Configure environment variables
2. Use the admin dashboard email test function
3. Check SMTP connection and send test email
4. Verify delivery and formatting

## Email Security Features
- TLS encryption for secure transmission
- Rate limiting to prevent spam
- Professional email templates
- Attachment support for reports
- Bounce handling and error logging