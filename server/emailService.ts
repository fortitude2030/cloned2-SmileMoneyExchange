import nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export class EmailService {
  private transporter: any;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  /**
   * Send a single email
   */
  async sendEmail(
    to: string | string[],
    template: EmailTemplate,
    attachments?: EmailAttachment[]
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.config.from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        }))
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}:`, result.messageId);
      return true;
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Send bulk emails with rate limiting
   */
  async sendBulkEmails(
    recipients: string[],
    template: EmailTemplate,
    attachments?: EmailAttachment[],
    delayMs: number = 1000
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const success = await this.sendEmail(recipient, template, attachments);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      
      // Rate limiting delay
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { sent, failed };
  }

  /**
   * Test email connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return false;
    }
  }
}

/**
 * Email template generators
 */
export class EmailTemplates {
  private static baseTemplate(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #007bff; margin: 0; font-size: 28px; }
        .content { color: #333; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }
        .btn { display: inline-block; padding: 12px 25px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .alert { padding: 15px; margin: 20px 0; border-radius: 5px; }
        .alert-info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .alert-warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Smile Money</h1>
            <p>Secure Financial Services Platform</p>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; 2025 Smile Money. All rights reserved.</p>
            <p>Licensed Financial Services Provider - Bank of Zambia</p>
        </div>
    </div>
</body>
</html>`;
  }

  static welcomeEmail(userName: string, organizationName?: string): EmailTemplate {
    const content = `
        <h2>Welcome to Smile Money!</h2>
        <p>Dear ${userName},</p>
        <p>Welcome to Smile Money, Zambia's trusted mobile money platform. Your account has been successfully created${organizationName ? ` for ${organizationName}` : ''}.</p>
        
        <div class="alert alert-info">
            <strong>Getting Started:</strong>
            <ul>
                <li>Complete your KYC verification</li>
                <li>Set up your wallet security</li>
                <li>Explore our transaction services</li>
            </ul>
        </div>
        
        <p>Our platform provides secure peer-to-peer transfers, merchant payments, and comprehensive financial services with full regulatory compliance.</p>
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Best regards,<br>The Smile Money Team</p>
    `;

    return {
      subject: `Welcome to Smile Money - Account Created Successfully`,
      html: this.baseTemplate('Welcome to Smile Money', content),
      text: `Welcome to Smile Money! Your account has been created successfully. Please complete your KYC verification to get started.`
    };
  }

  static transactionNotification(amount: string, type: string, transactionId: string): EmailTemplate {
    const content = `
        <h2>Transaction Notification</h2>
        <p>A transaction has been processed on your Smile Money account:</p>
        
        <div class="alert alert-info">
            <strong>Transaction Details:</strong><br>
            Amount: ZMW ${amount}<br>
            Type: ${type}<br>
            Transaction ID: ${transactionId}<br>
            Date: ${new Date().toLocaleString()}
        </div>
        
        <p>If you did not authorize this transaction, please contact us immediately.</p>
        
        <p>Thank you for using Smile Money.</p>
    `;

    return {
      subject: `Transaction Alert - ZMW ${amount}`,
      html: this.baseTemplate('Transaction Notification', content),
      text: `Transaction processed: ZMW ${amount}, Type: ${type}, ID: ${transactionId}`
    };
  }

  static reportDelivery(reportType: string, period: string): EmailTemplate {
    const content = `
        <h2>Scheduled Report Delivery</h2>
        <p>Your requested ${reportType} report for ${period} is attached to this email.</p>
        
        <div class="alert alert-info">
            <strong>Report Details:</strong><br>
            Type: ${reportType}<br>
            Period: ${period}<br>
            Generated: ${new Date().toLocaleString()}<br>
            Format: PDF/Excel
        </div>
        
        <p>This report contains confidential financial information. Please handle securely.</p>
        
        <p>Automated delivery from Smile Money Financial System.</p>
    `;

    return {
      subject: `${reportType} Report - ${period}`,
      html: this.baseTemplate('Report Delivery', content),
      text: `Your ${reportType} report for ${period} is attached. Generated: ${new Date().toLocaleString()}`
    };
  }

  static amlAlert(alertType: string, details: string): EmailTemplate {
    const content = `
        <h2>AML Compliance Alert</h2>
        
        <div class="alert alert-warning">
            <strong>Alert Type:</strong> ${alertType}<br>
            <strong>Time:</strong> ${new Date().toLocaleString()}<br>
            <strong>Details:</strong> ${details}
        </div>
        
        <p>This alert requires immediate attention from the compliance team.</p>
        
        <p>Please review the transaction details in the admin dashboard and take appropriate action.</p>
        
        <p>Automated alert from Smile Money AML Monitoring System.</p>
    `;

    return {
      subject: `AML Alert - ${alertType} - Immediate Action Required`,
      html: this.baseTemplate('AML Compliance Alert', content),
      text: `AML Alert: ${alertType} - ${details}. Requires immediate attention.`
    };
  }

  static kycStatusUpdate(status: string, userName: string, comments?: string): EmailTemplate {
    const content = `
        <h2>KYC Verification Update</h2>
        <p>Dear ${userName},</p>
        
        <p>Your KYC verification status has been updated:</p>
        
        <div class="alert ${status === 'approved' ? 'alert-info' : 'alert-warning'}">
            <strong>Status:</strong> ${status.toUpperCase()}<br>
            <strong>Updated:</strong> ${new Date().toLocaleString()}
            ${comments ? `<br><strong>Comments:</strong> ${comments}` : ''}
        </div>
        
        ${status === 'approved' ? 
          '<p>Congratulations! Your account is now fully verified and you can access all platform features.</p>' :
          '<p>Additional documentation may be required. Please check your account dashboard for details.</p>'
        }
        
        <p>Thank you for using Smile Money.</p>
    `;

    return {
      subject: `KYC Verification ${status === 'approved' ? 'Approved' : 'Update Required'}`,
      html: this.baseTemplate('KYC Status Update', content),
      text: `KYC Status Update: ${status}. ${comments || 'Please check your account dashboard.'}`
    };
  }
}

// Default email configuration - will be overridden by environment variables
const getEmailConfig = (): EmailConfig => {
  return {
    host: process.env.SMTP_HOST || 'mail.smilemoney.co.zm',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || 'noreply@smilemoney.co.zm',
      pass: process.env.SMTP_PASS || ''
    },
    from: process.env.SMTP_FROM || 'Smile Money <noreply@smilemoney.co.zm>'
  };
};

export const emailService = new EmailService(getEmailConfig());