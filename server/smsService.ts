/**
 * SMS Service for Zamtel API Integration
 * Handles SMS notifications for Smile Money platform
 */

export interface SMSConfig {
  provider: string;
  apiUrl: string;
  username: string;
  password: string;
  senderId: string;
  enabled: boolean;
}

export interface SMSTemplate {
  subject: string;
  message: string;
}

export class SMSService {
  private config: SMSConfig;

  constructor(config: SMSConfig) {
    this.config = config;
  }

  /**
   * Send SMS via Zamtel API
   */
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('SMS service disabled, skipping SMS send');
      return false;
    }

    try {
      // Format phone number for Zambian networks
      const formattedNumber = this.formatZambianPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        console.error('Invalid phone number format:', phoneNumber);
        return false;
      }

      // Zamtel API integration
      const smsData = {
        username: this.config.username,
        password: this.config.password,
        msisdn: formattedNumber,
        message: message,
        sender_id: this.config.senderId
      };

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(smsData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('SMS sent successfully:', result);
        return true;
      } else {
        console.error('SMS send failed:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('SMS service error:', error);
      return false;
    }
  }

  /**
   * Send bulk SMS with rate limiting
   */
  async sendBulkSMS(recipients: string[], message: string, delay: number = 1000): Promise<{
    successful: number;
    failed: number;
    results: Array<{ phoneNumber: string; success: boolean; error?: string }>;
  }> {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const phoneNumber of recipients) {
      try {
        const success = await this.sendSMS(phoneNumber, message);
        results.push({ phoneNumber, success });
        
        if (success) {
          successful++;
        } else {
          failed++;
        }
        
        // Rate limiting delay
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error: any) {
        results.push({ 
          phoneNumber, 
          success: false, 
          error: error.message || 'Unknown error' 
        });
        failed++;
      }
    }

    return { successful, failed, results };
  }

  /**
   * Format phone number for Zambian networks
   */
  private formatZambianPhoneNumber(phoneNumber: string): string | null {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
      // Local format: 9XXXXXXXX -> 2609XXXXXXXX
      return '260' + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('260')) {
      // International format: 2609XXXXXXXX
      return cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('2609')) {
      // Already formatted correctly
      return cleaned;
    }
    
    return null; // Invalid format
  }

  /**
   * Test SMS connection and configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      // Send a test ping to check API availability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(this.config.apiUrl, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      return response.status < 500; // API is reachable
    } catch (error) {
      console.error('SMS connection test failed:', error);
      return false;
    }
  }
}

/**
 * SMS Template generators for Smile Money
 */
export class SMSTemplates {
  static transactionConfirmation(amount: string, transactionId: string, recipientName: string): SMSTemplate {
    return {
      subject: 'Transaction Confirmed',
      message: `Smile Money: Transaction confirmed. ZMW ${amount} sent successfully. ID: ${transactionId}. Thank you, ${recipientName}!`
    };
  }

  static settlementStatus(status: string, amount: string, requestId: string): SMSTemplate {
    const statusMap: { [key: string]: string } = {
      'approved': 'APPROVED',
      'rejected': 'REJECTED', 
      'hold': 'ON HOLD',
      'completed': 'COMPLETED'
    };

    return {
      subject: 'Settlement Update',
      message: `Smile Money: Settlement request ${statusMap[status] || status}. Amount: ZMW ${amount}. Ref: ${requestId}. Check dashboard for details.`
    };
  }

  static otpVerification(otp: string, expiryMinutes: number = 5): SMSTemplate {
    return {
      subject: 'OTP Verification',
      message: `Smile Money: Your verification code is ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code.`
    };
  }

  static amlAlert(alertType: string, organizationName: string): SMSTemplate {
    return {
      subject: 'Security Alert',
      message: `Smile Money ALERT: ${alertType} detected for ${organizationName}. Immediate review required. Contact support: +260-XXX-XXXX`
    };
  }

  static welcomeMessage(userName: string): SMSTemplate {
    return {
      subject: 'Welcome to Smile Money',
      message: `Welcome to Smile Money, ${userName}! Your account is ready. Complete KYC verification to start using our services. Visit cash.smilemoney.africa`
    };
  }

  static kycStatusUpdate(status: string, userName: string): SMSTemplate {
    const statusMap: { [key: string]: string } = {
      'approved': 'APPROVED - You can now use all services',
      'rejected': 'REQUIRES UPDATE - Please resubmit documents',
      'in_review': 'UNDER REVIEW - We will notify you soon'
    };

    return {
      subject: 'KYC Status Update',
      message: `Smile Money: KYC ${statusMap[status] || status}. ${userName}, check your dashboard for details.`
    };
  }
}

// Default SMS configuration
const getSMSConfig = (): SMSConfig => {
  return {
    provider: process.env.SMS_PROVIDER || 'zamtel',
    apiUrl: process.env.SMS_API_URL || 'https://api.zamtel.co.zm/v1/sms/send',
    username: process.env.SMS_USERNAME || '',
    password: process.env.SMS_PASSWORD || '',
    senderId: process.env.SMS_SENDER_ID || 'SMILE_MONEY',
    enabled: process.env.SMS_ENABLED !== 'false'
  };
};

export const smsService = new SMSService(getSMSConfig());