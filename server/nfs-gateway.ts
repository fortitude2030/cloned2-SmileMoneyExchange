/**
 * NFS (National Financial Switch) Gateway
 * Handles ISO 8583 message processing for ATM/POS transactions
 */

export interface ISO8583Message {
  mti: string; // Message Type Indicator (0200, 0210, etc)
  bitmap: string;
  fields: Record<number, string>;
}

export interface NFSRequest {
  messageType: string;
  stan: string; // System Trace Audit Number
  rrn: string; // Retrieval Reference Number
  terminalId?: string;
  merchantId?: string;
  cardNumber?: string;
  amount?: string;
  processingCode?: string;
  authCode?: string;
}

export interface NFSResponse {
  responseCode: string;
  responseMessage: string;
  authCode?: string;
  rrn: string;
  stan: string;
}

export class NFSGateway {
  private readonly RESPONSE_CODES = {
    APPROVED: '00',
    INSUFFICIENT_FUNDS: '51',
    EXPIRED_CARD: '54',
    INVALID_CARD: '14',
    SYSTEM_ERROR: '96',
    TIMEOUT: '68',
    FORMAT_ERROR: '30'
  };

  /**
   * Process incoming NFS transaction request
   */
  async processNFSRequest(request: NFSRequest): Promise<NFSResponse> {
    try {
      // Validate request format
      if (!this.validateNFSRequest(request)) {
        return this.createErrorResponse(request, this.RESPONSE_CODES.FORMAT_ERROR, 'Invalid request format');
      }

      // Process based on message type
      switch (request.messageType) {
        case '0200': // Authorization Request
          return await this.processAuthorizationRequest(request);
        case '0420': // Reversal Request
          return await this.processReversalRequest(request);
        default:
          return this.createErrorResponse(request, this.RESPONSE_CODES.FORMAT_ERROR, 'Unsupported message type');
      }
    } catch (error) {
      console.error('NFS Gateway error:', error);
      return this.createErrorResponse(request, this.RESPONSE_CODES.SYSTEM_ERROR, 'System error');
    }
  }

  /**
   * Process authorization request (0200)
   */
  private async processAuthorizationRequest(request: NFSRequest): Promise<NFSResponse> {
    // Simulate account lookup and balance check
    const account = await this.lookupAccount(request.cardNumber);
    
    if (!account) {
      return this.createErrorResponse(request, this.RESPONSE_CODES.INVALID_CARD, 'Invalid card');
    }

    const amount = parseFloat(request.amount || '0');
    
    if (account.balance < amount) {
      return this.createErrorResponse(request, this.RESPONSE_CODES.INSUFFICIENT_FUNDS, 'Insufficient funds');
    }

    // Generate authorization code
    const authCode = this.generateAuthCode();

    return {
      responseCode: this.RESPONSE_CODES.APPROVED,
      responseMessage: 'Approved',
      authCode,
      rrn: request.rrn,
      stan: request.stan
    };
  }

  /**
   * Process reversal request (0420)
   */
  private async processReversalRequest(request: NFSRequest): Promise<NFSResponse> {
    // Find original transaction and reverse it
    const originalTransaction = await this.findOriginalTransaction(request.rrn);
    
    if (!originalTransaction) {
      return this.createErrorResponse(request, this.RESPONSE_CODES.FORMAT_ERROR, 'Original transaction not found');
    }

    // Process reversal
    await this.reverseTransaction(originalTransaction);

    return {
      responseCode: this.RESPONSE_CODES.APPROVED,
      responseMessage: 'Reversal approved',
      rrn: request.rrn,
      stan: request.stan
    };
  }

  /**
   * Validate NFS request format
   */
  private validateNFSRequest(request: NFSRequest): boolean {
    return !!(request.messageType && request.stan && request.rrn);
  }

  /**
   * Create error response
   */
  private createErrorResponse(request: NFSRequest, code: string, message: string): NFSResponse {
    return {
      responseCode: code,
      responseMessage: message,
      rrn: request.rrn,
      stan: request.stan
    };
  }

  /**
   * Lookup account by card number (placeholder)
   */
  private async lookupAccount(cardNumber?: string): Promise<{ balance: number } | null> {
    // This would integrate with your account lookup system
    if (!cardNumber) return null;
    
    // Simulate account lookup
    return { balance: 50000 }; // ZMW 50,000
  }

  /**
   * Find original transaction for reversal
   */
  private async findOriginalTransaction(rrn: string): Promise<any> {
    // This would query your transaction database
    return { id: 1, rrn, amount: 1000 };
  }

  /**
   * Reverse a transaction
   */
  private async reverseTransaction(transaction: any): Promise<void> {
    // This would process the reversal in your core banking system
    console.log('Reversing transaction:', transaction.id);
  }

  /**
   * Generate authorization code
   */
  private generateAuthCode(): string {
    return Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  }

  /**
   * Parse ISO 8583 message
   */
  parseISO8583(message: string): ISO8583Message {
    // Basic ISO 8583 parsing implementation
    const mti = message.substring(0, 4);
    const bitmap = message.substring(4, 20);
    
    // Parse fields based on bitmap
    const fields: Record<number, string> = {};
    // Implementation would parse each field based on the bitmap
    
    return { mti, bitmap, fields };
  }

  /**
   * Build ISO 8583 response message
   */
  buildISO8583Response(response: NFSResponse): string {
    // Build ISO 8583 response message
    // This is a simplified implementation
    return `0210${response.responseCode}${response.stan}${response.rrn}`;
  }
}

export const nfsGateway = new NFSGateway();