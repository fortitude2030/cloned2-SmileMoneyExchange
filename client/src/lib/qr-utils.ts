/**
 * QR Code generation utilities for payment requests
 * Uses client-side QR code generation for better reliability
 */
import QRCode from 'qrcode';

export interface PaymentQRData {
  transactionId: string;
  amount: string;
  currency: string;
  type: string;
  nonce: string;
  timestamp: number;
  expiresAt: number;
}

/**
 * Generate a cryptographically secure nonce
 */
function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a QR code data URL for the given data
 * @param data - The data to encode in the QR code
 * @param size - The size of the QR code (default: 256)
 * @returns Promise<string> - The QR code data URL
 */
export async function generateQRCode(data: string, size: number = 256): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a QR code for a payment request with automatic expiration
 * @param transactionId - The transaction ID
 * @param amount - The payment amount
 * @param type - The transaction type
 * @param size - The size of the QR code (default: 256)
 * @returns Promise<string> - The QR code data URL
 */
export async function generatePaymentQR(
  transactionId: string,
  amount: string,
  type: string = 'cash_digitization',
  size: number = 256
): Promise<string> {
  try {
    const now = Date.now();
    const expiresAt = now + (2 * 60 * 1000); // 2 minutes expiration
    
    const paymentData: PaymentQRData = {
      transactionId,
      amount,
      currency: 'ZMW',
      type,
      nonce: generateNonce(),
      timestamp: now,
      expiresAt
    };
    
    const dataString = JSON.stringify(paymentData);
    return await generateQRCode(dataString, size);
  } catch (error) {
    console.error('Error generating payment QR code:', error);
    throw new Error('Failed to generate payment QR code. Please try again.');
  }
}

/**
 * Parse QR code data for payment processing
 * @param qrData - The scanned QR code data string
 * @returns PaymentQRData | null - Parsed payment data or null if invalid
 */
export function parsePaymentQR(qrData: string): PaymentQRData | null {
  try {
    const parsed = JSON.parse(qrData);
    
    // Validate required fields for new format
    if (
      typeof parsed.transactionId !== 'string' ||
      typeof parsed.amount !== 'string' ||
      typeof parsed.currency !== 'string' ||
      typeof parsed.type !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.timestamp !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      console.error('Invalid QR code format - missing required fields');
      return null;
    }
    
    // Check if QR code is expired using expiresAt field
    const now = Date.now();
    if (now > parsed.expiresAt) {
      const secondsExpired = Math.floor((now - parsed.expiresAt) / 1000);
      console.error(`QR code expired ${secondsExpired} seconds ago`);
      return null;
    }
    
    return parsed as PaymentQRData;
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return null;
  }
}

/**
 * Get detailed error message for QR code parsing
 * @param qrData - The scanned QR code data string
 * @returns string - Detailed error message
 */
export function getQRParseError(qrData: string): string {
  try {
    const parsed = JSON.parse(qrData);
    
    // Validate required fields - handle both string and number amounts
    const hasValidAmount = (typeof parsed.amount === 'number' && !isNaN(parsed.amount)) ||
                          (typeof parsed.amount === 'string' && !isNaN(parseFloat(parsed.amount)));
    
    if (
      !hasValidAmount ||
      typeof parsed.type !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return 'Invalid QR code format - missing required fields';
    }
    
    // Check if QR code has expired using expiresAt field if available
    if (parsed.expiresAt && typeof parsed.expiresAt === 'number') {
      const now = Date.now();
      if (now > parsed.expiresAt) {
        const secondsExpired = Math.floor((now - parsed.expiresAt) / 1000);
        return `QR code expired ${secondsExpired} seconds ago. Please generate a new QR code.`;
      }
    } else {
      // Fallback to 24-hour check for older QR codes
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const age = Date.now() - parsed.timestamp;
      if (age > maxAge) {
        const hoursOld = Math.floor(age / (60 * 60 * 1000));
        return `QR code expired (${hoursOld} hours old). Please generate a new QR code.`;
      }
    }
    
    return 'QR code validation failed';
  } catch (error) {
    if (error instanceof SyntaxError) {
      return 'Invalid QR code - not a valid payment QR code';
    }
    return 'Failed to process QR code';
  }
}

/**
 * Validate QR code data for security
 * @param paymentData - The payment data to validate
 * @returns boolean - True if valid, false otherwise
 */
export function validatePaymentQR(paymentData: PaymentQRData): boolean {
  try {
    // Amount validation (handle both string and number)
    const amount = typeof paymentData.amount === 'string' ? 
      parseFloat(paymentData.amount) : paymentData.amount;
    if (isNaN(amount) || amount <= 0 || amount > 1000000) {
      return false;
    }
    
    // Type validation - include QR payment types
    const validTypes = ['cash_digitization', 'transfer', 'settlement', 'qr_code_payment'];
    if (!validTypes.includes(paymentData.type)) {
      return false;
    }
    
    // Timestamp validation (not in future, not older than 24 hours)
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (paymentData.timestamp > now || (now - paymentData.timestamp) > maxAge) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating QR code:', error);
    return false;
  }
}

/**
 * Create a shareable QR code with additional metadata
 * @param paymentData - The payment data
 * @param merchantName - The merchant name for display
 * @returns Promise<{ qrUrl: string; shareText: string }> - QR code URL and share text
 */
export async function createShareablePaymentQR(
  transactionId: string,
  amount: string,
  type: string = 'cash_digitization',
  merchantName?: string
): Promise<{ qrUrl: string; shareText: string }> {
  try {
    const qrUrl = await generatePaymentQR(transactionId, amount, type);
    const numericAmount = parseFloat(amount);
    const shareText = `Payment Request${merchantName ? ` from ${merchantName}` : ''}: ZMW ${numericAmount.toLocaleString()}`;
    
    return { qrUrl, shareText };
  } catch (error) {
    console.error('Error creating shareable QR code:', error);
    throw new Error('Failed to create shareable QR code. Please try again.');
  }
}
