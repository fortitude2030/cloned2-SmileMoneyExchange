import { storage } from "./storage";
import { fileManager } from "./fileManager";
import path from 'path';

export interface RTGSTransactionRequest {
  amount: string;
  currency: string;
  beneficiaryBank: string;
  beneficiaryAccount: string;
  beneficiaryName: string;
  purpose: string;
  settlementRequestId: number;
  organizationId: number;
}

export interface BankOfZambiaReport {
  reportType: 'daily' | 'weekly' | 'monthly' | 'aml_alert';
  period: string;
  data: any;
  submissionRequired: boolean;
}

export class IntegrationManager {
  
  /**
   * Generate RTGS payment instruction for manual processing
   */
  async generateRTGSInstruction(request: RTGSTransactionRequest): Promise<{
    instructionId: string;
    filePath: string;
    bankingDetails: any;
  }> {
    const instructionId = `RTGS_${Date.now()}_${request.settlementRequestId}`;
    
    // Generate RTGS instruction document
    const instructionData = {
      instructionId,
      timestamp: new Date().toISOString(),
      amount: request.amount,
      currency: request.currency,
      debitAccount: "SMILE_MONEY_MASTER_ACCOUNT", // Platform's main account
      beneficiaryBank: request.beneficiaryBank,
      beneficiaryAccount: request.beneficiaryAccount,
      beneficiaryName: request.beneficiaryName,
      purpose: request.purpose,
      settlementRequestId: request.settlementRequestId,
      organizationId: request.organizationId,
      processingInstructions: {
        priority: "NORMAL",
        valueDate: new Date().toISOString().split('T')[0],
        charges: "OUR" // Originator pays charges
      }
    };

    // Save instruction to secure file system
    const filePath = await this.saveRTGSInstruction(instructionData);
    
    return {
      instructionId,
      filePath,
      bankingDetails: {
        debitAccount: "SMILE_MONEY_MASTER_ACCOUNT",
        amount: request.amount,
        beneficiary: {
          bank: request.beneficiaryBank,
          account: request.beneficiaryAccount,
          name: request.beneficiaryName
        }
      }
    };
  }

  /**
   * Save RTGS instruction to secure file system
   */
  private async saveRTGSInstruction(instructionData: any): Promise<string> {
    const filename = `RTGS_${instructionData.instructionId}.json`;
    const filePath = path.join('uploads', 'RTGS_INSTRUCTIONS', filename);
    
    // Ensure directory exists
    await fileManager.ensureDirectoryExists(path.dirname(filePath));
    
    // Save instruction file
    const fs = require('fs').promises;
    await fs.writeFile(filePath, JSON.stringify(instructionData, null, 2));
    
    // Log file creation for audit
    await fileManager.logFileOperation('upload', filePath, 'system', {
      type: 'rtgs_instruction',
      settlementRequestId: instructionData.settlementRequestId
    });
    
    return filePath;
  }

  /**
   * Generate Bank of Zambia regulatory reports
   */
  async generateBankOfZambiaReport(
    reportType: 'daily' | 'weekly' | 'monthly' | 'aml_alert',
    period: string
  ): Promise<BankOfZambiaReport> {
    let reportData: any;
    let submissionRequired = false;

    switch (reportType) {
      case 'daily':
        reportData = await this.generateDailyTransactionReport(period);
        submissionRequired = reportData.totalVolume > 1000000; // Submit if >1M ZMW daily
        break;
        
      case 'weekly':
        reportData = await this.generateWeeklyComplianceReport(period);
        submissionRequired = true; // Weekly reports always required
        break;
        
      case 'monthly':
        reportData = await this.generateMonthlyRegulatoryReport(period);
        submissionRequired = true; // Monthly reports mandatory
        break;
        
      case 'aml_alert':
        reportData = await this.generateAMLAlertReport(period);
        submissionRequired = reportData.highRiskAlerts > 0; // Submit if high-risk alerts
        break;
    }

    const report: BankOfZambiaReport = {
      reportType,
      period,
      data: reportData,
      submissionRequired
    };

    // Save report to compliance archive
    await this.archiveReport(report);
    
    return report;
  }

  /**
   * Generate daily transaction summary for BoZ
   */
  private async generateDailyTransactionReport(date: string): Promise<any> {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all transactions for the day
    const allTransactions = await storage.getAllTransactions();
    const dayTransactions = allTransactions.filter(t => {
      const transactionDate = new Date(t.createdAt);
      return transactionDate >= startOfDay && transactionDate <= endOfDay && t.status === 'completed';
    });

    const totalVolume = dayTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const transactionCount = dayTransactions.length;
    
    // Group by transaction type
    const typeBreakdown = dayTransactions.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + parseFloat(t.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      date: date,
      totalVolume: totalVolume.toFixed(2),
      transactionCount,
      typeBreakdown,
      largestTransaction: Math.max(...dayTransactions.map(t => parseFloat(t.amount)), 0),
      averageTransaction: transactionCount > 0 ? (totalVolume / transactionCount).toFixed(2) : '0',
      reportGeneratedAt: new Date().toISOString()
    };
  }

  /**
   * Generate weekly compliance summary
   */
  private async generateWeeklyComplianceReport(weekStart: string): Promise<any> {
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    // Get AML alerts for the week
    const amlAlerts = await storage.getAmlAlerts();
    const weeklyAlerts = amlAlerts.filter(alert => {
      const alertDate = new Date(alert.flaggedAt);
      return alertDate >= startDate && alertDate < endDate;
    });

    const highRiskAlerts = weeklyAlerts.filter(alert => alert.riskScore >= 70);
    const resolvedAlerts = weeklyAlerts.filter(alert => alert.status === 'cleared');

    return {
      weekStart: weekStart,
      weekEnd: endDate.toISOString().split('T')[0],
      totalAlerts: weeklyAlerts.length,
      highRiskAlerts: highRiskAlerts.length,
      resolvedAlerts: resolvedAlerts.length,
      complianceRate: weeklyAlerts.length > 0 ? (resolvedAlerts.length / weeklyAlerts.length * 100).toFixed(2) : '100',
      reportGeneratedAt: new Date().toISOString()
    };
  }

  /**
   * Generate monthly regulatory submission
   */
  private async generateMonthlyRegulatoryReport(month: string): Promise<any> {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    // Get comprehensive monthly statistics
    const allTransactions = await storage.getAllTransactions();
    const monthlyTransactions = allTransactions.filter(t => {
      const transactionDate = new Date(t.createdAt);
      return transactionDate >= startDate && transactionDate <= endDate && t.status === 'completed';
    });

    const totalVolume = monthlyTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const uniqueUsers = new Set(monthlyTransactions.map(t => t.fromUserId)).size;

    // Get monthly AML statistics
    const amlAlerts = await storage.getAmlAlerts();
    const monthlyAlerts = amlAlerts.filter(alert => {
      const alertDate = new Date(alert.flaggedAt);
      return alertDate >= startDate && alertDate <= endDate;
    });

    return {
      reportingPeriod: month,
      transactionVolume: {
        totalAmount: totalVolume.toFixed(2),
        transactionCount: monthlyTransactions.length,
        uniqueUsers
      },
      amlCompliance: {
        alertsGenerated: monthlyAlerts.length,
        alertsResolved: monthlyAlerts.filter(a => a.status === 'cleared').length,
        alertsEscalated: monthlyAlerts.filter(a => a.status === 'escalated').length
      },
      operationalMetrics: {
        averageDailyVolume: (totalVolume / new Date(year, monthNum, 0).getDate()).toFixed(2),
        peakTransactionDay: this.findPeakTransactionDay(monthlyTransactions),
        systemUptime: '99.9%' // Placeholder for actual uptime monitoring
      },
      regulatoryStatus: 'COMPLIANT',
      reportGeneratedAt: new Date().toISOString()
    };
  }

  /**
   * Generate AML alert summary report
   */
  private async generateAMLAlertReport(period: string): Promise<any> {
    const amlAlerts = await storage.getAmlAlerts();
    const pendingAlerts = await storage.getPendingAmlAlerts();
    
    const highRiskAlerts = amlAlerts.filter(alert => alert.riskScore >= 70);
    const recentAlerts = amlAlerts.filter(alert => {
      const alertDate = new Date(alert.flaggedAt);
      const periodDate = new Date(period);
      return alertDate >= periodDate;
    });

    return {
      reportPeriod: period,
      totalAlerts: amlAlerts.length,
      pendingReview: pendingAlerts.length,
      highRiskAlerts: highRiskAlerts.length,
      recentAlerts: recentAlerts.length,
      alertBreakdown: this.categorizeAlerts(amlAlerts),
      reportGeneratedAt: new Date().toISOString()
    };
  }

  /**
   * Archive compliance report
   */
  private async archiveReport(report: BankOfZambiaReport): Promise<void> {
    const filename = `BOZ_${report.reportType}_${report.period}_${Date.now()}.json`;
    const filePath = path.join('uploads', 'BOZ_REPORTS', filename);
    
    await fileManager.ensureDirectoryExists(path.dirname(filePath));
    
    const fs = require('fs').promises;
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    
    // Create compliance report record
    await storage.createComplianceReport({
      reportType: `boz_${report.reportType}`,
      reportPeriod: report.period,
      generatedBy: 'system',
      reportData: report.data,
      filePath: filePath
    });
  }

  /**
   * Helper method to find peak transaction day
   */
  private findPeakTransactionDay(transactions: any[]): string {
    const dailyVolumes = transactions.reduce((acc, t) => {
      const day = new Date(t.createdAt).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + parseFloat(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const peakDay = Object.entries(dailyVolumes).reduce((peak, [day, volume]) => 
      volume > peak.volume ? { day, volume } : peak
    , { day: '', volume: 0 });

    return peakDay.day;
  }

  /**
   * Helper method to categorize AML alerts
   */
  private categorizeAlerts(alerts: any[]): Record<string, number> {
    return alerts.reduce((acc, alert) => {
      acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const integrationManager = new IntegrationManager();