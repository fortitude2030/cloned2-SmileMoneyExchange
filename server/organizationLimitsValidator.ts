import { storage } from './storage';
import { Request, Response, NextFunction } from 'express';

export interface OrganizationLimitsValidation {
  isValid: boolean;
  reason?: string;
  organizationUsage?: {
    dailyUsed: number;
    monthlyUsed: number;
    dailyLimit: number;
    monthlyLimit: number;
    singleLimit: number;
  };
}

/**
 * Validate transaction against organization limits and status
 */
export async function validateOrganizationLimits(
  userId: string,
  amount: number,
  transactionType: string = 'payment'
): Promise<OrganizationLimitsValidation> {
  try {
    // Get user and organization
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      return {
        isValid: false,
        reason: "User must belong to an approved organization"
      };
    }

    const organization = await storage.getOrganizationById(user.organizationId);
    if (!organization) {
      return {
        isValid: false,
        reason: "Organization not found"
      };
    }

    // Check organization status
    if (organization.status !== 'approved') {
      return {
        isValid: false,
        reason: `Organization status is ${organization.status}. Only approved organizations can process transactions.`
      };
    }

    if (!organization.isActive) {
      return {
        isValid: false,
        reason: "Organization is not active"
      };
    }

    // Check organization KYC status
    if (organization.kycStatus !== 'verified') {
      return {
        isValid: false,
        reason: `Organization KYC status is ${organization.kycStatus}. KYC must be verified for transactions.`
      };
    }

    // Get organization limits
    const dailyLimit = parseFloat(organization.dailyTransactionLimit || '5000000');
    const monthlyLimit = parseFloat(organization.monthlyTransactionLimit || '50000000');
    const singleLimit = parseFloat(organization.singleTransactionLimit || '500000');

    // Check single transaction limit
    if (amount > singleLimit) {
      return {
        isValid: false,
        reason: `Transaction amount ${amount} ZMW exceeds organization single transaction limit of ${singleLimit} ZMW`
      };
    }

    // Get organization usage for today and this month
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const dailyUsage = await storage.getOrganizationTransactionVolume(
      user.organizationId,
      startOfDay,
      new Date()
    );

    const monthlyUsage = await storage.getOrganizationTransactionVolume(
      user.organizationId,
      startOfMonth,
      new Date()
    );

    // Check daily limit
    if (dailyUsage + amount > dailyLimit) {
      return {
        isValid: false,
        reason: `Transaction would exceed organization daily limit. Used: ${dailyUsage} ZMW, Limit: ${dailyLimit} ZMW`,
        organizationUsage: {
          dailyUsed: dailyUsage,
          monthlyUsed: monthlyUsage,
          dailyLimit,
          monthlyLimit,
          singleLimit
        }
      };
    }

    // Check monthly limit
    if (monthlyUsage + amount > monthlyLimit) {
      return {
        isValid: false,
        reason: `Transaction would exceed organization monthly limit. Used: ${monthlyUsage} ZMW, Limit: ${monthlyLimit} ZMW`,
        organizationUsage: {
          dailyUsed: dailyUsage,
          monthlyUsed: monthlyUsage,
          dailyLimit,
          monthlyLimit,
          singleLimit
        }
      };
    }

    return {
      isValid: true,
      organizationUsage: {
        dailyUsed: dailyUsage,
        monthlyUsed: monthlyUsage,
        dailyLimit,
        monthlyLimit,
        singleLimit
      }
    };

  } catch (error) {
    console.error('Error validating organization limits:', error);
    return {
      isValid: false,
      reason: "Failed to validate organization limits"
    };
  }
}

/**
 * Express middleware for organization limits validation
 */
export function requireOrganizationLimitsValidation(req: any, res: Response, next: NextFunction) {
  return async (amount: number, transactionType?: string) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const validation = await validateOrganizationLimits(userId, amount, transactionType);
      
      if (!validation.isValid) {
        return res.status(400).json({ 
          message: validation.reason,
          organizationUsage: validation.organizationUsage 
        });
      }

      // Attach organization usage info to request for logging
      req.organizationUsage = validation.organizationUsage;
      next();
    } catch (error) {
      console.error('Organization limits validation middleware error:', error);
      res.status(500).json({ message: "Failed to validate organization limits" });
    }
  };
}

/**
 * Inherit organization AML settings for user
 */
export async function getInheritedAmlSettings(userId: string) {
  try {
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      return null;
    }

    const organization = await storage.getOrganizationById(user.organizationId);
    if (!organization) {
      return null;
    }

    return {
      riskRating: organization.amlRiskRating || 'medium',
      enabledChecks: organization.enabledAmlChecks || ['velocity', 'threshold', 'pattern'],
      organizationId: organization.id,
      organizationName: organization.name
    };
  } catch (error) {
    console.error('Error getting inherited AML settings:', error);
    return null;
  }
}