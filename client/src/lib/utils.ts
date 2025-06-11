import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency amount using floor truncation (no rounding)
 * ZMW 183.97 becomes ZMW 183, not ZMW 184
 */
export function formatCurrency(amount: string | number): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return 'ZMW 0';
  
  // Use Math.floor to truncate decimals without rounding
  const truncatedAmount = Math.floor(numericAmount);
  return `ZMW ${truncatedAmount.toLocaleString()}`;
}

/**
 * Parse and truncate amount to whole number without rounding
 */
export function truncateAmount(amount: string | number): number {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return 0;
  return Math.floor(numericAmount);
}
