/**
 * RTGS (Real-Time Gross Settlement) Gateway
 * Handles integration with Bank of Zambia RTGS system
 */

export interface RTGSPayment {
  messageType: string; // MT103, MT202
  senderBank: string;
  receiverBank: string;
  amount: string;
  currency: string;
  beneficiaryAccount: string;
  senderAccount: string;
  paymentPurpose: string;
  valueDate: string;
}

export interface RTGSResponse {
  status: 'accepted' | 'rejected' | 'pending';
  rtgsRef: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

export class RTGSGateway {
  private readonly BOZ_BANK_CODE = '01'; // Bank of Zambia routing code
  private readonly INSTITUTION_CODE = 'LUS001'; // Your EMI code with BoZ

  /**
   * Submit payment to RTGS system
   */
  async submitRTGSPayment(payment: RTGSPayment): Promise<RTGSResponse> {
    try {
      // Validate payment
      const validation = this.validateRTGSPayment(payment);
      if (!validation.isValid) {
        return {
          status: 'rejected',
          rtgsRef: this.generateRTGSRef(),
          errorCode: 'VALIDATION_ERROR',
          errorMessage: validation.error,
          timestamp: new Date()
        };
      }

      // Format SWIFT message
      const swiftMessage = this.formatSWIFTMessage(payment);
      
      // Submit to BoZ RTGS (simulation)
      const response = await this.submitToBoZRTGS(swiftMessage);
      
      return {
        status: response.accepted ? 'accepted' : 'rejected',
        rtgsRef: response.reference,
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('RTGS Gateway error:', error);
      return {
        status: 'rejected',
        rtgsRef: this.generateRTGSRef(),
        errorCode: 'SYSTEM_ERROR',
        errorMessage: 'Internal system error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Check RTGS payment status
   */
  async checkRTGSStatus(rtgsRef: string): Promise<{
    status: 'pending' | 'settled' | 'failed';
    settlementTime?: Date;
    failureReason?: string;
  }> {
    // Query BoZ RTGS system for status
    try {
      const statusResponse = await this.queryBoZStatus(rtgsRef);
      return {
        status: statusResponse.status,
        settlementTime: statusResponse.settlementTime,
        failureReason: statusResponse.failureReason
      };
    } catch (error) {
      console.error('RTGS status check error:', error);
      return { status: 'pending' };
    }
  }

  /**
   * Validate RTGS payment
   */
  private validateRTGSPayment(payment: RTGSPayment): { isValid: boolean; error?: string } {
    // Check minimum amount (ZMW 10,000 for RTGS)
    const amount = parseFloat(payment.amount);
    if (amount < 10000) {
      return { isValid: false, error: 'Minimum RTGS amount is ZMW 10,000' };
    }

    // Validate bank codes
    if (!this.isValidBankCode(payment.senderBank) || !this.isValidBankCode(payment.receiverBank)) {
      return { isValid: false, error: 'Invalid bank code' };
    }

    // Validate account numbers
    if (!this.isValidAccountNumber(payment.beneficiaryAccount)) {
      return { isValid: false, error: 'Invalid beneficiary account number' };
    }

    // Check business hours (RTGS operates 8 AM - 5 PM, Monday-Friday)
    if (!this.isWithinBusinessHours()) {
      return { isValid: false, error: 'RTGS system is closed. Operating hours: 8 AM - 5 PM, Monday-Friday' };
    }

    return { isValid: true };
  }

  /**
   * Format SWIFT MT103 message for customer credit transfer
   */
  private formatSWIFTMessage(payment: RTGSPayment): string {
    const mt103 = [
      '{1:F01' + this.INSTITUTION_CODE + '0000000000}',
      '{2:O1030000' + this.formatDate() + this.INSTITUTION_CODE + '0000000000}',
      '{3:{108:' + this.generateMessageRef() + '}}',
      '{4:',
      ':20:' + this.generateTransactionRef(),
      ':23B:CRED',
      ':32A:' + this.formatValueDate() + payment.currency + payment.amount,
      ':50K:/' + payment.senderAccount,
      ':59:/' + payment.beneficiaryAccount,
      ':70:' + payment.paymentPurpose,
      ':71A:BEN',
      '-}'
    ].join('\n');

    return mt103;
  }

  /**
   * Submit to Bank of Zambia RTGS system (simulation)
   */
  private async submitToBoZRTGS(swiftMessage: string): Promise<{
    accepted: boolean;
    reference: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    // Simulate RTGS submission
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate various response scenarios
    const random = Math.random();
    
    if (random > 0.95) {
      // 5% rejection rate
      return {
        accepted: false,
        reference: this.generateRTGSRef(),
        errorCode: 'INSUFFICIENT_LIQUIDITY',
        errorMessage: 'Insufficient liquidity in sender account'
      };
    }

    return {
      accepted: true,
      reference: this.generateRTGSRef()
    };
  }

  /**
   * Query BoZ RTGS system for payment status
   */
  private async queryBoZStatus(rtgsRef: string): Promise<{
    status: 'pending' | 'settled' | 'failed';
    settlementTime?: Date;
    failureReason?: string;
  }> {
    // Simulate status query
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate settlement (90% success rate)
    const random = Math.random();
    
    if (random > 0.9) {
      return {
        status: 'failed',
        failureReason: 'Beneficiary account closed'
      };
    }

    if (random > 0.3) {
      return {
        status: 'settled',
        settlementTime: new Date()
      };
    }

    return { status: 'pending' };
  }

  /**
   * Check if within RTGS business hours
   */
  private isWithinBusinessHours(): boolean {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();

    // Monday to Friday (1-5), 8 AM to 5 PM (17:00)
    return day >= 1 && day <= 5 && hour >= 8 && hour < 17;
  }

  /**
   * Validate Zambian bank code
   */
  private isValidBankCode(bankCode: string): boolean {
    // Zambian bank codes are typically 2-3 digits
    const validBankCodes = [
      '01', // Bank of Zambia
      '02', // Zanaco
      '03', // Standard Chartered
      '04', // Barclays (Absa)
      '05', // FNB
      '06', // Stanbic
      '07', // Indo Zambia
      '08', // Investrust
      '09', // Access Bank
      '10'  // Atlas Mara
    ];
    
    return validBankCodes.includes(bankCode);
  }

  /**
   * Validate account number format
   */
  private isValidAccountNumber(accountNumber: string): boolean {
    // Basic validation - account numbers are typically 10-16 digits
    return /^\d{10,16}$/.test(accountNumber);
  }

  /**
   * Generate unique RTGS reference
   */
  private generateRTGSRef(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RTGS${timestamp}${random}`;
  }

  /**
   * Generate transaction reference for SWIFT
   */
  private generateTransactionRef(): string {
    return `TXN${Date.now()}`;
  }

  /**
   * Generate message reference for SWIFT
   */
  private generateMessageRef(): string {
    return Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
  }

  /**
   * Format date for SWIFT message
   */
  private formatDate(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return year + month + day;
  }

  /**
   * Format value date (today)
   */
  private formatValueDate(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return year + month + day;
  }
}

export const rtgsGateway = new RTGSGateway();