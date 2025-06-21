// Direct email test script
import { EmailService, EmailTemplates } from './server/emailService.js';

// Configure SMTP with the provided settings
const emailConfig = {
  host: 'cash.smilemoney.africa',
  port: 465,
  secure: true, // SSL for port 465
  auth: {
    user: 'test@cash.smilemoney.africa',
    pass: process.env.SMTP_PASS || 'email-password-needed'
  },
  from: 'Smile Money <test@cash.smilemoney.africa>'
};

const testEmailService = new EmailService(emailConfig);

async function testEmail() {
  console.log('Testing email system...');
  
  try {
    // Test connection first
    console.log('Testing SMTP connection...');
    const isConnected = await testEmailService.testConnection();
    console.log('SMTP Connection:', isConnected ? 'SUCCESS' : 'FAILED');
    
    if (isConnected) {
      // Send test email
      console.log('Sending test email to test@cash.smilemoney.africa...');
      
      const testTemplate = {
        subject: "Smile Money Email System Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Email System Test</h2>
            <p>This is a test email from Smile Money's email system.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>Test Details:</strong><br>
              • Sent at: ${new Date().toISOString()}<br>
              • SMTP Host: mail.cash.smilemoney.africa<br>
              • From: noreply@cash.smilemoney.africa<br>
              • To: test@cash.smilemoney.africa
            </div>
            <p>✅ Email system is working correctly!</p>
            <hr style="margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              © 2025 Smile Money. Licensed Financial Services Provider - Bank of Zambia
            </p>
          </div>
        `,
        text: `Email System Test - Sent at ${new Date().toISOString()}`
      };
      
      const success = await testEmailService.sendEmail('test@cash.smilemoney.africa', testTemplate);
      console.log('Email Send Result:', success ? 'SUCCESS' : 'FAILED');
      
      if (success) {
        console.log('\n✅ Email test completed successfully!');
        console.log('Check the inbox for test@cash.smilemoney.africa');
      } else {
        console.log('\n❌ Email sending failed');
      }
    } else {
      console.log('\n❌ SMTP connection failed - check credentials');
    }
    
  } catch (error) {
    console.error('Email test error:', error.message);
  }
}

testEmail();