/**
 * Generate a unique transaction ID in LUS-XXXXXX format
 * @returns string - Transaction ID like "LUS-123456"
 */
export function generateTransactionId(): string {
  // Generate 6 random digits
  const randomNumbers = Math.floor(100000 + Math.random() * 900000);
  return `LUS-${randomNumbers}`;
}

/**
 * Validate transaction ID format
 * @param transactionId - The transaction ID to validate
 * @returns boolean - True if valid format
 */
export function isValidTransactionId(transactionId: string): boolean {
  return /^LUS-\d{6}$/.test(transactionId);
}