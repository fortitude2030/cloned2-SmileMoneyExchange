/**
 * Generate a unique transaction ID in LUS-{VMF}-XXXXXX format
 * @param vmfNumber - The VMF number to include in the transaction ID
 * @returns string - Transaction ID like "LUS-ABC123-456789"
 */
export function generateTransactionId(vmfNumber: string): string {
  // Generate 6 random digits
  const randomNumbers = Math.floor(100000 + Math.random() * 900000);
  return `LUS-${vmfNumber}-${randomNumbers}`;
}

/**
 * Validate transaction ID format
 * @param transactionId - The transaction ID to validate
 * @returns boolean - True if valid format
 */
export function isValidTransactionId(transactionId: string): boolean {
  return /^LUS-.+-\d{6}$/.test(transactionId);
}