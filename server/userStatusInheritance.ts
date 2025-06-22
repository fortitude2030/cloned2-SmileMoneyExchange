import { storage } from './storage';

/**
 * User Status Inheritance from Organization
 * Ensures users inherit organization compliance status
 */

export interface UserStatusValidation {
  isValid: boolean;
  reason?: string;
  organizationStatus?: {
    status: string;
    kycStatus: string;
    isActive: boolean;
  };
}

/**
 * Validate user can operate based on organization status
 */
export async function validateUserOrganizationStatus(userId: string): Promise<UserStatusValidation> {
  try {
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      return {
        isValid: false,
        reason: "User must belong to an organization to operate"
      };
    }

    const organization = await storage.getOrganizationById(user.organizationId);
    if (!organization) {
      return {
        isValid: false,
        reason: "User's organization not found"
      };
    }

    // Organization must be approved
    if (organization.status !== 'approved') {
      return {
        isValid: false,
        reason: `Organization status is ${organization.status}. Users cannot operate until organization is approved.`,
        organizationStatus: {
          status: organization.status,
          kycStatus: organization.kycStatus,
          isActive: organization.isActive
        }
      };
    }

    // Organization must be active
    if (!organization.isActive) {
      return {
        isValid: false,
        reason: "Organization is suspended. All user operations are disabled.",
        organizationStatus: {
          status: organization.status,
          kycStatus: organization.kycStatus,
          isActive: organization.isActive
        }
      };
    }

    // Organization KYC must be verified for financial operations
    if (organization.kycStatus !== 'verified' && user.role !== 'admin') {
      return {
        isValid: false,
        reason: `Organization KYC status is ${organization.kycStatus}. Financial operations require verified KYC.`,
        organizationStatus: {
          status: organization.status,
          kycStatus: organization.kycStatus,
          isActive: organization.isActive
        }
      };
    }

    return {
      isValid: true,
      organizationStatus: {
        status: organization.status,
        kycStatus: organization.kycStatus,
        isActive: organization.isActive
      }
    };

  } catch (error) {
    console.error('Error validating user organization status:', error);
    return {
      isValid: false,
      reason: "Failed to validate user organization status"
    };
  }
}

/**
 * Get effective transaction limits (most restrictive between user and organization)
 */
export async function getEffectiveTransactionLimits(userId: string) {
  try {
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      return null;
    }

    const organization = await storage.getOrganizationById(user.organizationId);
    if (!organization) {
      return null;
    }

    // Get user limits from wallet
    const wallet = await storage.getWalletByUserId(user.id);
    const userDailyLimit = parseFloat(wallet?.dailyLimit || '50000');
    const userMonthlyLimit = parseFloat(wallet?.monthlyLimit || '500000');
    const userSingleLimit = parseFloat(wallet?.singleTransactionLimit || '10000');

    // Get organization limits
    const orgDailyLimit = parseFloat(organization.dailyTransactionLimit || '5000000');
    const orgMonthlyLimit = parseFloat(organization.monthlyTransactionLimit || '50000000');
    const orgSingleLimit = parseFloat(organization.singleTransactionLimit || '500000');

    // Return most restrictive limits
    return {
      dailyLimit: Math.min(userDailyLimit, orgDailyLimit),
      monthlyLimit: Math.min(userMonthlyLimit, orgMonthlyLimit),
      singleTransactionLimit: Math.min(userSingleLimit, orgSingleLimit),
      source: {
        user: { dailyLimit: userDailyLimit, monthlyLimit: userMonthlyLimit, singleLimit: userSingleLimit },
        organization: { dailyLimit: orgDailyLimit, monthlyLimit: orgMonthlyLimit, singleLimit: orgSingleLimit }
      }
    };

  } catch (error) {
    console.error('Error getting effective transaction limits:', error);
    return null;
  }
}

/**
 * Middleware to validate user organization status before operations
 */
export async function requireValidOrganizationStatus(userId: string) {
  const validation = await validateUserOrganizationStatus(userId);
  
  if (!validation.isValid) {
    throw new Error(validation.reason || "Organization status validation failed");
  }
  
  return validation.organizationStatus;
}