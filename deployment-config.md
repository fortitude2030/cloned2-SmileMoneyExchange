# Smile Money Production Deployment Configuration

## Domain Setup Instructions

### 1. DNS Configuration
Point your domain to Replit:
```
Type: A Record
Name: @ (or your subdomain)
Value: [Replit will provide IP after deployment]
TTL: 300 (5 minutes)
```

### 2. SSL Certificate
Replit automatically provisions SSL certificates for custom domains via Let's Encrypt.

### 3. Environment Variables for Production
Update these environment variables for your custom domain:
- `PRODUCTION_DOMAIN=cash.smilemoney.africa`
- `CORS_ORIGIN=https://cash.smilemoney.africa`

### 4. Firebase Configuration Updates Required
After domain setup, update Firebase console:

#### Authentication Settings
1. Go to Firebase Console > Authentication > Settings > Authorized domains
2. Add your production domain: `cash.smilemoney.africa`
3. Keep the existing Replit domain for development

#### OAuth Provider Settings
If using Google OAuth:
1. Go to Google Cloud Console
2. Update authorized JavaScript origins
3. Add: `https://cash.smilemoney.africa`

### 5. CORS Configuration
The app will automatically detect production domain and update CORS settings.

### 6. Security Headers
Production deployment includes:
- HSTS (HTTP Strict Transport Security)
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options

## Deployment Checklist
- [ ] DNS A record configured
- [ ] Firebase authorized domains updated
- [ ] OAuth providers updated
- [ ] Environment variables set
- [ ] SSL certificate provisioned
- [ ] CORS settings verified