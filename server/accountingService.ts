import { db } from "./db";
import { 
  chartOfAccounts, 
  journalEntries, 
  journalEntryLines, 
  smileMoneyRevenue,
  transactions,
  organizations,
  type InsertChartOfAccounts,
  type InsertJournalEntry,
  type InsertJournalEntryLine,
  type InsertSmileMoneyRevenue,
  type ChartOfAccounts,
  type JournalEntry
} from "@shared/schema";
import { eq, and, gte, lte, desc, sum, sql } from "drizzle-orm";

export interface AccountingTransaction {
  transactionId: string;
  amount: number;
  organizationId: number;
  description: string;
  createdBy: string;
  transactionType: 'cash_in' | 'cash_out' | 'p2p_transfer' | 'settlement';
}

export interface RevenueCalculation {
  transactionFee: number;
  settlementFee?: number;
  monthlyServiceFee?: number;
  totalRevenue: number;
}

export interface FinancialStatement {
  assets: { [accountCode: string]: { name: string; balance: number } };
  liabilities: { [accountCode: string]: { name: string; balance: number } };
  equity: { [accountCode: string]: { name: string; balance: number } };
  revenue: { [accountCode: string]: { name: string; balance: number } };
  expenses: { [accountCode: string]: { name: string; balance: number } };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export class AccountingService {
  
  /**
   * Initialize Chart of Accounts with Smile Money's account structure
   */
  async initializeChartOfAccounts(): Promise<void> {
    const accounts: InsertChartOfAccounts[] = [
      // ASSETS
      { accountCode: "1000", accountName: "Cash and Cash Equivalents", accountType: "asset", description: "Primary cash accounts" },
      { accountCode: "1100", accountName: "Digital Wallet Float", accountType: "asset", parentAccountId: 1, description: "Total digital money in system" },
      { accountCode: "1200", accountName: "Bank Deposits", accountType: "asset", parentAccountId: 1, description: "Physical cash deposits in banks" },
      { accountCode: "1300", accountName: "Accounts Receivable", accountType: "asset", description: "Money owed to Smile Money" },
      { accountCode: "1310", accountName: "Settlement Receivables", accountType: "asset", parentAccountId: 4, description: "Pending settlement amounts" },
      
      // LIABILITIES
      { accountCode: "2000", accountName: "Customer Liabilities", accountType: "liability", description: "Money owed to customers" },
      { accountCode: "2100", accountName: "Customer Wallet Balances", accountType: "liability", parentAccountId: 6, description: "Total customer digital money" },
      { accountCode: "2200", accountName: "Merchant Payables", accountType: "liability", parentAccountId: 6, description: "Money owed to merchants" },
      { accountCode: "2300", accountName: "Settlement Payables", accountType: "liability", description: "Pending settlements to be paid" },
      
      // EQUITY
      { accountCode: "3000", accountName: "Smile Money Capital", accountType: "equity", description: "Platform equity" },
      { accountCode: "3100", accountName: "Retained Earnings", accountType: "equity", description: "Accumulated profits" },
      
      // REVENUE
      { accountCode: "4000", accountName: "Service Revenue", accountType: "revenue", description: "All service fees" },
      { accountCode: "4100", accountName: "Transaction Fee Revenue", accountType: "revenue", parentAccountId: 12, description: "1% transaction fees" },
      { accountCode: "4200", accountName: "Settlement Fee Revenue", accountType: "revenue", parentAccountId: 12, description: "ZMW 150 settlement fees" },
      { accountCode: "4300", accountName: "Monthly Service Revenue", accountType: "revenue", parentAccountId: 12, description: "ZMW 1,500 monthly fees" },
      
      // EXPENSES
      { accountCode: "5000", accountName: "Operating Expenses", accountType: "expense", description: "Platform operating costs" },
      { accountCode: "5100", accountName: "Bank Charges", accountType: "expense", parentAccountId: 16, description: "Banking and transfer fees" },
      { accountCode: "5200", accountName: "Compliance Costs", accountType: "expense", parentAccountId: 16, description: "AML and regulatory costs" },
      { accountCode: "5300", accountName: "Technology Costs", accountType: "expense", parentAccountId: 16, description: "System maintenance and development" },
    ];

    for (const account of accounts) {
      try {
        await db.insert(chartOfAccounts).values(account).onConflictDoNothing();
      } catch (error) {
        console.log(`Account ${account.accountCode} already exists or error occurred`);
      }
    }
  }

  /**
   * Calculate revenue for a transaction based on Smile Money fee structure
   */
  calculateRevenue(amount: number, transactionType: string): RevenueCalculation {
    const transactionFee = Math.round(amount * 0.01 * 100) / 100; // 1.0% rounded to cents
    let settlementFee = 0;
    let monthlyServiceFee = 0;

    if (transactionType === 'settlement') {
      settlementFee = 150; // ZMW 150 per settlement
    }

    // Monthly service fees are calculated separately in billing cycle
    const totalRevenue = transactionFee + settlementFee + monthlyServiceFee;

    return {
      transactionFee,
      settlementFee: settlementFee > 0 ? settlementFee : undefined,
      monthlyServiceFee: monthlyServiceFee > 0 ? monthlyServiceFee : undefined,
      totalRevenue
    };
  }

  /**
   * Process accounting entries for a customer transaction
   */
  async processTransaction(transaction: AccountingTransaction): Promise<void> {
    const revenue = this.calculateRevenue(transaction.amount, transaction.transactionType);
    const netAmount = transaction.amount - revenue.totalRevenue;
    
    // Generate unique journal entry number
    const entryNumber = `JE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    
    const journalEntry: InsertJournalEntry = {
      entryNumber,
      transactionId: transaction.transactionId,
      entryDate: new Date(),
      description: `${transaction.description} - Transaction: ${transaction.transactionId}`,
      totalAmount: transaction.amount.toString(),
      createdBy: transaction.createdBy,
      status: 'posted'
    };

    // Insert journal entry
    const [createdEntry] = await db.insert(journalEntries).values(journalEntry).returning();

    // Create journal entry lines for double-entry bookkeeping
    const journalLines: InsertJournalEntryLine[] = [];

    if (transaction.transactionType === 'cash_in') {
      // Cash In: Customer deposits money
      // DR: Bank Deposits (Asset) - Full amount
      journalLines.push({
        journalEntryId: createdEntry.id,
        accountCode: "1200",
        accountName: "Bank Deposits",
        debitAmount: transaction.amount.toString(),
        creditAmount: "0.00",
        description: "Cash deposit received"
      });

      // CR: Customer Wallet Balances (Liability) - Net amount to customer
      journalLines.push({
        journalEntryId: createdEntry.id,
        accountCode: "2100",
        accountName: "Customer Wallet Balances",
        debitAmount: "0.00",
        creditAmount: netAmount.toString(),
        description: "Digital money issued to customer"
      });

      // CR: Transaction Fee Revenue - Revenue earned
      if (revenue.transactionFee > 0) {
        journalLines.push({
          journalEntryId: createdEntry.id,
          accountCode: "4100",
          accountName: "Transaction Fee Revenue",
          debitAmount: "0.00",
          creditAmount: revenue.transactionFee.toString(),
          description: "1% transaction fee earned"
        });
      }
    } else if (transaction.transactionType === 'settlement') {
      // Settlement: Converting digital money back to cash
      // DR: Customer Wallet Balances (Liability) - Full amount
      journalLines.push({
        journalEntryId: createdEntry.id,
        accountCode: "2100",
        accountName: "Customer Wallet Balances",
        debitAmount: transaction.amount.toString(),
        creditAmount: "0.00",
        description: "Digital money redeemed"
      });

      // CR: Bank Deposits (Asset) - Net amount paid out
      journalLines.push({
        journalEntryId: createdEntry.id,
        accountCode: "1200",
        accountName: "Bank Deposits",
        debitAmount: "0.00",
        creditAmount: netAmount.toString(),
        description: "Cash settlement paid"
      });

      // CR: Settlement Fee Revenue
      if (revenue.settlementFee && revenue.settlementFee > 0) {
        journalLines.push({
          journalEntryId: createdEntry.id,
          accountCode: "4200",
          accountName: "Settlement Fee Revenue",
          debitAmount: "0.00",
          creditAmount: revenue.settlementFee.toString(),
          description: "ZMW 150 settlement fee earned"
        });
      }
    } else if (transaction.transactionType === 'p2p_transfer') {
      // P2P Transfer: No cash movement, just fee collection
      // DR: Customer Wallet Balances - Fee amount
      journalLines.push({
        journalEntryId: createdEntry.id,
        accountCode: "2100",
        accountName: "Customer Wallet Balances",
        debitAmount: revenue.transactionFee.toString(),
        creditAmount: "0.00",
        description: "Transaction fee deducted"
      });

      // CR: Transaction Fee Revenue
      journalLines.push({
        journalEntryId: createdEntry.id,
        accountCode: "4100",
        accountName: "Transaction Fee Revenue",
        debitAmount: "0.00",
        creditAmount: revenue.transactionFee.toString(),
        description: "1% P2P transaction fee earned"
      });
    }

    // Insert all journal entry lines
    await db.insert(journalEntryLines).values(journalLines);

    // Record revenue tracking
    const revenueRecords: InsertSmileMoneyRevenue[] = [];

    if (revenue.transactionFee > 0) {
      revenueRecords.push({
        organizationId: transaction.organizationId,
        transactionId: transaction.transactionId,
        journalEntryId: createdEntry.id,
        revenueType: 'transaction_fee',
        feeAmount: revenue.transactionFee.toString(),
        feePercentage: "1.00"
      });
    }

    if (revenue.settlementFee && revenue.settlementFee > 0) {
      revenueRecords.push({
        organizationId: transaction.organizationId,
        transactionId: transaction.transactionId,
        journalEntryId: createdEntry.id,
        revenueType: 'settlement_fee',
        feeAmount: revenue.settlementFee.toString()
      });
    }

    if (revenueRecords.length > 0) {
      await db.insert(smileMoneyRevenue).values(revenueRecords);
    }
  }

  /**
   * Generate financial statements for Smile Money
   */
  async generateFinancialStatements(startDate?: Date, endDate?: Date): Promise<FinancialStatement> {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1); // Start of year
    const end = endDate || new Date(); // Today

    // Get all journal entry lines within the period
    const journalLines = await db
      .select({
        accountCode: journalEntryLines.accountCode,
        accountName: journalEntryLines.accountName,
        debitAmount: journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
        accountType: chartOfAccounts.accountType
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountCode, chartOfAccounts.accountCode))
      .where(
        and(
          gte(journalEntries.entryDate, start),
          lte(journalEntries.entryDate, end),
          eq(journalEntries.status, 'posted')
        )
      );

    const statement: FinancialStatement = {
      assets: {},
      liabilities: {},
      equity: {},
      revenue: {},
      expenses: {},
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0
    };

    // Process each account balance
    const accountBalances: { [key: string]: { name: string; type: string; balance: number } } = {};

    for (const line of journalLines) {
      const key = line.accountCode;
      if (!accountBalances[key]) {
        accountBalances[key] = {
          name: line.accountName,
          type: line.accountType,
          balance: 0
        };
      }

      const debit = parseFloat(line.debitAmount || '0');
      const credit = parseFloat(line.creditAmount || '0');

      // Calculate balance based on account type (normal balance)
      if (line.accountType === 'asset' || line.accountType === 'expense') {
        // Assets and Expenses: Debit increases, Credit decreases
        accountBalances[key].balance += (debit - credit);
      } else {
        // Liabilities, Equity, Revenue: Credit increases, Debit decreases
        accountBalances[key].balance += (credit - debit);
      }
    }

    // Categorize accounts into statement sections
    for (const [accountCode, account] of Object.entries(accountBalances)) {
      const balanceData = { name: account.name, balance: account.balance };

      switch (account.type) {
        case 'asset':
          statement.assets[accountCode] = balanceData;
          statement.totalAssets += account.balance;
          break;
        case 'liability':
          statement.liabilities[accountCode] = balanceData;
          statement.totalLiabilities += account.balance;
          break;
        case 'equity':
          statement.equity[accountCode] = balanceData;
          statement.totalEquity += account.balance;
          break;
        case 'revenue':
          statement.revenue[accountCode] = balanceData;
          statement.totalRevenue += account.balance;
          break;
        case 'expense':
          statement.expenses[accountCode] = balanceData;
          statement.totalExpenses += account.balance;
          break;
      }
    }

    statement.netIncome = statement.totalRevenue - statement.totalExpenses;

    return statement;
  }

  /**
   * Get revenue summary for a specific period
   */
  async getRevenueReport(startDate: Date, endDate: Date): Promise<{
    transactionFees: number;
    settlementFees: number;
    monthlyServiceFees: number;
    totalRevenue: number;
    transactionCount: number;
    organizationBreakdown: { [orgId: string]: { name: string; revenue: number; transactions: number } };
  }> {
    const revenueData = await db
      .select({
        revenueType: smileMoneyRevenue.revenueType,
        feeAmount: smileMoneyRevenue.feeAmount,
        organizationId: smileMoneyRevenue.organizationId,
        organizationName: organizations.name,
        transactionId: smileMoneyRevenue.transactionId
      })
      .from(smileMoneyRevenue)
      .innerJoin(organizations, eq(smileMoneyRevenue.organizationId, organizations.id))
      .where(
        and(
          gte(smileMoneyRevenue.collectedAt, startDate),
          lte(smileMoneyRevenue.collectedAt, endDate)
        )
      );

    let transactionFees = 0;
    let settlementFees = 0;
    let monthlyServiceFees = 0;
    let transactionCount = 0;
    const organizationBreakdown: { [orgId: string]: { name: string; revenue: number; transactions: number } } = {};

    for (const record of revenueData) {
      const amount = parseFloat(record.feeAmount);
      const orgId = record.organizationId.toString();

      // Initialize organization tracking
      if (!organizationBreakdown[orgId]) {
        organizationBreakdown[orgId] = {
          name: record.organizationName || 'Unknown',
          revenue: 0,
          transactions: 0
        };
      }

      organizationBreakdown[orgId].revenue += amount;
      if (record.transactionId) {
        organizationBreakdown[orgId].transactions += 1;
        transactionCount += 1;
      }

      // Categorize revenue
      switch (record.revenueType) {
        case 'transaction_fee':
          transactionFees += amount;
          break;
        case 'settlement_fee':
          settlementFees += amount;
          break;
        case 'monthly_service':
          monthlyServiceFees += amount;
          break;
      }
    }

    return {
      transactionFees,
      settlementFees,
      monthlyServiceFees,
      totalRevenue: transactionFees + settlementFees + monthlyServiceFees,
      transactionCount,
      organizationBreakdown
    };
  }

  /**
   * Get account balance for a specific account code
   */
  async getAccountBalance(accountCode: string, asOfDate?: Date): Promise<number> {
    const date = asOfDate || new Date();
    
    const result = await db
      .select({
        totalDebits: sql<number>`COALESCE(SUM(CAST(${journalEntryLines.debitAmount} AS DECIMAL)), 0)`,
        totalCredits: sql<number>`COALESCE(SUM(CAST(${journalEntryLines.creditAmount} AS DECIMAL)), 0)`,
        accountType: chartOfAccounts.accountType
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountCode, chartOfAccounts.accountCode))
      .where(
        and(
          eq(journalEntryLines.accountCode, accountCode),
          lte(journalEntries.entryDate, date),
          eq(journalEntries.status, 'posted')
        )
      )
      .groupBy(chartOfAccounts.accountType);

    if (result.length === 0) return 0;

    const { totalDebits, totalCredits, accountType } = result[0];

    // Calculate balance based on account type
    if (accountType === 'asset' || accountType === 'expense') {
      return totalDebits - totalCredits;
    } else {
      return totalCredits - totalDebits;
    }
  }
}

export const accountingService = new AccountingService();