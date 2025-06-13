/**
 * Compliance Engine for AML/CFT and Regulatory Compliance
 * Handles transaction monitoring, sanctions screening, and reporting
 */

export interface ComplianceAlert {
  type: 'aml' | 'sanctions' | 'kyc' | 'pep' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  riskScore: number;
  triggeredRules: string[];
}

export interface TransactionScreeningResult {
  approved: boolean;
  riskScore: number;
  alerts: ComplianceAlert[];
  requiresManualReview: boolean;
}

export interface CustomerRiskProfile {
  userId: string;
  riskLevel: 'low' | 'medium' | 'high';
  kycLevel: 'basic' | 'enhanced' | 'full';
  isPEP: boolean;
  sanctionsMatch: boolean;
  lastReview: Date;
}

export class ComplianceEngine {
  private readonly AML_THRESHOLDS = {
    SINGLE_TRANSACTION: 50000, // ZMW 50,000
    DAILY_CUMULATIVE: 100000,  // ZMW 100,000
    MONTHLY_CUMULATIVE: 500000, // ZMW 500,000
    CASH_INTENSIVE: 200000     // ZMW 200,000 in cash per month
  };

  private readonly HIGH_RISK_COUNTRIES = [
    'AF', 'BY', 'MM', 'CF', 'CD', 'CU', 'ET', 'GN', 'HT', 'IR', 
    'IQ', 'LB', 'LR', 'LY', 'ML', 'NI', 'KP', 'SO', 'SD', 'SY', 'VE', 'YE', 'ZW'
  ];

  private readonly SANCTIONED_ENTITIES = [
    // This would be loaded from official sanctions lists
    // OFAC, UN, EU sanctions lists
  ];

  /**
   * Screen transaction for compliance violations
   */
  async screenTransaction(transaction: {
    userId: string;
    amount: number;
    currency: string;
    type: string;
    beneficiaryName?: string;
    beneficiaryCountry?: string;
  }): Promise<TransactionScreeningResult> {
    const alerts: ComplianceAlert[] = [];
    let riskScore = 0;

    // Get customer risk profile
    const customerProfile = await this.getCustomerRiskProfile(transaction.userId);

    // 1. Amount-based screening
    const amountAlerts = this.checkAmountThresholds(transaction.amount, transaction.type);
    alerts.push(...amountAlerts);
    riskScore += amountAlerts.reduce((sum, alert) => sum + alert.riskScore, 0);

    // 2. Sanctions screening
    const sanctionsAlerts = await this.checkSanctionsLists(transaction);
    alerts.push(...sanctionsAlerts);
    riskScore += sanctionsAlerts.reduce((sum, alert) => sum + alert.riskScore, 0);

    // 3. PEP screening
    if (customerProfile.isPEP) {
      alerts.push({
        type: 'pep',
        severity: 'medium',
        description: 'Transaction involves Politically Exposed Person',
        riskScore: 15,
        triggeredRules: ['PEP_MONITORING']
      });
      riskScore += 15;
    }

    // 4. Geographic risk
    const geoAlerts = this.checkGeographicRisk(transaction.beneficiaryCountry);
    alerts.push(...geoAlerts);
    riskScore += geoAlerts.reduce((sum, alert) => sum + alert.riskScore, 0);

    // 5. Pattern analysis
    const patternAlerts = await this.analyzeTransactionPatterns(transaction.userId, transaction);
    alerts.push(...patternAlerts);
    riskScore += patternAlerts.reduce((sum, alert) => sum + alert.riskScore, 0);

    // Determine if manual review is required
    const requiresManualReview = riskScore >= 50 || 
                                alerts.some(alert => alert.severity === 'critical');

    // Auto-approve low risk transactions
    const approved = riskScore < 30 && !requiresManualReview;

    return {
      approved,
      riskScore,
      alerts,
      requiresManualReview
    };
  }

  /**
   * Check amount-based thresholds
   */
  private checkAmountThresholds(amount: number, transactionType: string): ComplianceAlert[] {
    const alerts: ComplianceAlert[] = [];

    // Single transaction threshold
    if (amount >= this.AML_THRESHOLDS.SINGLE_TRANSACTION) {
      alerts.push({
        type: 'aml',
        severity: amount >= 100000 ? 'high' : 'medium',
        description: `Large transaction amount: ZMW ${amount.toLocaleString()}`,
        riskScore: amount >= 100000 ? 25 : 15,
        triggeredRules: ['LARGE_TRANSACTION_MONITORING']
      });
    }

    // Cash transaction monitoring
    if (transactionType === 'cash_deposit' && amount >= 100000) {
      alerts.push({
        type: 'aml',
        severity: 'high',
        description: `Large cash transaction: ZMW ${amount.toLocaleString()}`,
        riskScore: 30,
        triggeredRules: ['CASH_TRANSACTION_MONITORING']
      });
    }

    return alerts;
  }

  /**
   * Check sanctions lists
   */
  private async checkSanctionsLists(transaction: {
    beneficiaryName?: string;
    beneficiaryCountry?: string;
  }): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];

    // Check beneficiary name against sanctions lists
    if (transaction.beneficiaryName) {
      const sanctionsMatch = await this.checkNameAgainstSanctions(transaction.beneficiaryName);
      if (sanctionsMatch.isMatch) {
        alerts.push({
          type: 'sanctions',
          severity: 'critical',
          description: `Potential sanctions match: ${sanctionsMatch.matchedName}`,
          riskScore: 100,
          triggeredRules: ['SANCTIONS_SCREENING']
        });
      }
    }

    return alerts;
  }

  /**
   * Check geographic risk
   */
  private checkGeographicRisk(country?: string): ComplianceAlert[] {
    const alerts: ComplianceAlert[] = [];

    if (country && this.HIGH_RISK_COUNTRIES.includes(country)) {
      alerts.push({
        type: 'aml',
        severity: 'high',
        description: `Transaction to/from high-risk jurisdiction: ${country}`,
        riskScore: 35,
        triggeredRules: ['GEOGRAPHIC_RISK_MONITORING']
      });
    }

    return alerts;
  }

  /**
   * Analyze transaction patterns for unusual activity
   */
  private async analyzeTransactionPatterns(userId: string, currentTransaction: {
    amount: number;
    type: string;
  }): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];

    // Get recent transaction history
    const recentTransactions = await this.getRecentTransactions(userId, 30); // Last 30 days

    // Check for unusual frequency
    const todayTransactions = recentTransactions.filter(tx => 
      this.isToday(tx.createdAt)
    );

    if (todayTransactions.length > 10) {
      alerts.push({
        type: 'unusual_activity',
        severity: 'medium',
        description: `Unusual transaction frequency: ${todayTransactions.length} transactions today`,
        riskScore: 20,
        triggeredRules: ['FREQUENCY_MONITORING']
      });
    }

    // Check for round number patterns
    if (this.isRoundNumber(currentTransaction.amount) && currentTransaction.amount >= 50000) {
      alerts.push({
        type: 'unusual_activity',
        severity: 'low',
        description: 'Round number transaction pattern detected',
        riskScore: 10,
        triggeredRules: ['PATTERN_ANALYSIS']
      });
    }

    // Check for structuring (amounts just below reporting threshold)
    const structuringPattern = this.detectStructuring(recentTransactions, currentTransaction.amount);
    if (structuringPattern) {
      alerts.push({
        type: 'aml',
        severity: 'high',
        description: 'Potential structuring detected - transactions designed to avoid reporting thresholds',
        riskScore: 40,
        triggeredRules: ['STRUCTURING_DETECTION']
      });
    }

    return alerts;
  }

  /**
   * Generate Suspicious Transaction Report (STR) for FIC
   */
  async generateSTR(userId: string, transactionId: number, alerts: ComplianceAlert[]): Promise<{
    strRef: string;
    reportData: any;
  }> {
    const strRef = `STR${Date.now()}`;
    
    const customer = await this.getCustomerDetails(userId);
    const transaction = await this.getTransactionDetails(transactionId);

    const reportData = {
      reportingInstitution: {
        name: 'LUS Electronic Money Institution',
        licenseNumber: 'EMI-001-2024',
        address: 'Lusaka, Zambia'
      },
      suspiciousActivity: {
        type: 'UNUSUAL_TRANSACTION_PATTERN',
        description: alerts.map(a => a.description).join('; '),
        amount: transaction.amount,
        currency: transaction.currency,
        date: transaction.createdAt
      },
      customer: {
        name: `${customer.firstName} ${customer.lastName}`,
        idType: 'NRC',
        idNumber: customer.nrcNumber,
        address: customer.address,
        phoneNumber: customer.phoneNumber
      },
      narrative: this.buildSTRNarrative(alerts, transaction, customer),
      submissionDate: new Date().toISOString()
    };

    // Store STR in database
    await this.storeSTR(strRef, reportData);

    return { strRef, reportData };
  }

  /**
   * Generate regulatory reports for BoZ
   */
  async generateBoZReport(reportType: 'weekly' | 'monthly', period: string): Promise<{
    reportRef: string;
    filePath: string;
  }> {
    const reportRef = `BOZ_${reportType.toUpperCase()}_${period}`;
    
    let reportData;
    
    if (reportType === 'weekly') {
      reportData = await this.generateWeeklyBoZReport(period);
    } else {
      reportData = await this.generateMonthlyBoZReport(period);
    }

    // Generate CSV file
    const filePath = await this.generateCSVReport(reportRef, reportData);

    return { reportRef, filePath };
  }

  // Helper methods
  private async getCustomerRiskProfile(userId: string): Promise<CustomerRiskProfile> {
    // This would query your customer database
    return {
      userId,
      riskLevel: 'low',
      kycLevel: 'basic',
      isPEP: false,
      sanctionsMatch: false,
      lastReview: new Date()
    };
  }

  private async checkNameAgainstSanctions(name: string): Promise<{
    isMatch: boolean;
    matchedName?: string;
    confidence?: number;
  }> {
    // This would check against OFAC, UN, EU sanctions lists
    // Using fuzzy matching algorithms
    return { isMatch: false };
  }

  private async getRecentTransactions(userId: string, days: number): Promise<any[]> {
    // Query recent transactions from database
    return [];
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private isRoundNumber(amount: number): boolean {
    return amount % 10000 === 0; // Multiples of 10,000
  }

  private detectStructuring(recentTransactions: any[], currentAmount: number): boolean {
    // Check if multiple transactions just below threshold
    const threshold = this.AML_THRESHOLDS.SINGLE_TRANSACTION;
    const nearThresholdTransactions = recentTransactions.filter(tx => 
      tx.amount >= threshold * 0.8 && tx.amount < threshold
    );
    
    return nearThresholdTransactions.length >= 3;
  }

  private buildSTRNarrative(alerts: ComplianceAlert[], transaction: any, customer: any): string {
    return `Suspicious activity detected for customer ${customer.firstName} ${customer.lastName}. ` +
           `Alerts: ${alerts.map(a => a.description).join(', ')}. ` +
           `Transaction amount: ${transaction.currency} ${transaction.amount}. ` +
           `Further investigation recommended.`;
  }

  private async getCustomerDetails(userId: string): Promise<any> {
    // Get customer details from database
    return {
      firstName: 'John',
      lastName: 'Doe',
      nrcNumber: '123456/78/9',
      address: 'Lusaka, Zambia',
      phoneNumber: '+260123456789'
    };
  }

  private async getTransactionDetails(transactionId: number): Promise<any> {
    // Get transaction details from database
    return {
      amount: 100000,
      currency: 'ZMW',
      createdAt: new Date()
    };
  }

  private async storeSTR(strRef: string, reportData: any): Promise<void> {
    // Store STR in regulatory reports table
    console.log('Storing STR:', strRef);
  }

  private async generateWeeklyBoZReport(period: string): Promise<any[]> {
    // Generate weekly transaction report for BoZ
    return [];
  }

  private async generateMonthlyBoZReport(period: string): Promise<any[]> {
    // Generate monthly prudential return for BoZ
    return [];
  }

  private async generateCSVReport(reportRef: string, data: any[]): Promise<string> {
    // Generate CSV file and return file path
    return `/reports/${reportRef}.csv`;
  }
}

export const complianceEngine = new ComplianceEngine();