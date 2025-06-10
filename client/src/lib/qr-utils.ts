/**
 * QR Code generation utilities for payment requests
 * Uses a CDN-based QR code generator for client-side generation
 */

export interface PaymentQRData {
  amount: number;
  type: string;
  timestamp: number;
  merchantId?: string;
  description?: string;
}

/**
 * Generate a QR code URL for the given data
 * @param data - The data to encode in the QR code
 * @param size - The size of the QR code (default: 200)
 * @returns Promise<string> - The QR code image URL
 */
export async function generateQRCode(data: string, size: number = 200): Promise<string> {
  try {
    // Using QR Server API for QR code generation
    const encodedData = encodeURIComponent(data);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&format=png&margin=10`;
    
    // Return URL directly without verification to avoid CORS issues
    return qrUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    // Return a fallback QR code URL instead of throwing
    const fallbackData = encodeURIComponent('QR_GENERATION_ERROR');
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${fallbackData}&format=png&margin=10`;
  }
}

/**
 * Generate a QR code for a payment request
 * @param paymentData - The payment data to encode
 * @param size - The size of the QR code (default: 200)
 * @returns Promise<string> - The QR code image URL
 */
export async function generatePaymentQR(paymentData: PaymentQRData, size: number = 200): Promise<string> {
  try {
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
    
    // Validate required fields
    if (
      typeof parsed.amount !== 'number' ||
      typeof parsed.type !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      console.error('Invalid QR code format - missing required fields');
      return null;
    }
    
    // Check if QR code is not too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const age = Date.now() - parsed.timestamp;
    if (age > maxAge) {
      const hoursOld = Math.floor(age / (60 * 60 * 1000));
      console.error(`QR code expired (${hoursOld} hours old). Please generate a new QR code.`);
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
    
    // Validate required fields
    if (
      typeof parsed.amount !== 'number' ||
      typeof parsed.type !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return 'Invalid QR code format - missing required fields';
    }
    
    // Check if QR code is not too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const age = Date.now() - parsed.timestamp;
    if (age > maxAge) {
      const hoursOld = Math.floor(age / (60 * 60 * 1000));
      return `QR code expired (${hoursOld} hours old). Please generate a new QR code.`;
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
    // Amount validation
    if (paymentData.amount <= 0 || paymentData.amount > 1000000) {
      return false;
    }
    
    // Type validation
    const validTypes = ['cash_digitization', 'transfer', 'settlement'];
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
  paymentData: PaymentQRData, 
  merchantName?: string
): Promise<{ qrUrl: string; shareText: string }> {
  try {
    const qrUrl = await generatePaymentQR(paymentData);
    const shareText = `Payment Request${merchantName ? ` from ${merchantName}` : ''}: ZMW ${paymentData.amount.toLocaleString()}`;
    
    return { qrUrl, shareText };
  } catch (error) {
    console.error('Error creating shareable QR code:', error);
    throw new Error('Failed to create shareable QR code. Please try again.');
  }
}
