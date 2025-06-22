import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (Firebase Auth handles authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phoneNumber: varchar("phone_number").unique(),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("pending"), // pending, merchant, cashier, finance, admin, super_admin
  organizationId: integer("organization_id"),
  isActive: boolean("is_active").default(true),
  isEmailVerified: boolean("is_email_verified").default(false),
  tempPassword: varchar("temp_password"), // For first-time login
  lastLoginAt: timestamp("last_login_at"),
  // OTP fields for cashier assignment
  cashierFixedId: varchar("cashier_fixed_id", { length: 4 }).unique(),
  currentOtp: varchar("current_otp", { length: 9 }),
  otpGeneratedAt: timestamp("otp_generated_at"),
  otpExpiresAt: timestamp("otp_expires_at"),
  otpUsed: boolean("otp_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  registrationNumber: varchar("registration_number"),
  pacraNumber: varchar("pacra_number"), // PACRA registration
  zraTpinNumber: varchar("zra_tpin_number"), // ZRA TPIN
  businessLicenseNumber: varchar("business_license_number"), // Business License (alternative to PACRA)
  businessLicenseExpiry: date("business_license_expiry"),
  directorName: varchar("director_name"),
  directorNrc: varchar("director_nrc"),
  directorPhone: varchar("director_phone"),
  shareCapitalAmount: decimal("share_capital_amount", { precision: 15, scale: 2 }),
  profileCompletionPercentage: integer("profile_completion_percentage").default(0),
  businessType: varchar("business_type").default("retail"), // retail, wholesale, manufacturing, etc
  address: text("address"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  type: varchar("type").default("financial_institution"),
  description: text("description"),
  
  // Regulatory Status
  status: varchar("status").default("pending"), // pending, approved, suspended, rejected
  kycStatus: varchar("kyc_status").default("pending"), // pending, incomplete, in_review, verified, rejected
  isActive: boolean("is_active").default(false),
  
  // Transaction Limits
  dailyTransactionLimit: decimal("daily_transaction_limit", { precision: 12, scale: 2 }).default("5000000.00"), // 5M ZMW
  monthlyTransactionLimit: decimal("monthly_transaction_limit", { precision: 12, scale: 2 }).default("50000000.00"), // 50M ZMW
  singleTransactionLimit: decimal("single_transaction_limit", { precision: 12, scale: 2 }).default("500000.00"), // 500K ZMW
  
  // AML Settings
  amlRiskRating: varchar("aml_risk_rating").default("medium"), // low, medium, high
  enabledAmlChecks: text("enabled_aml_checks").array().default(["velocity", "threshold", "pattern"]),
  
  // Approval workflow
  kycCompletedAt: timestamp("kyc_completed_at"),
  kycReviewedBy: varchar("kyc_reviewed_by"),
  kycRejectReason: text("kyc_reject_reason"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// KYC Documents table for organization onboarding
export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  documentType: varchar("document_type").notNull(), // selfie, nrc_side1, nrc_side2, passport, pacra, zra_tpin
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  status: varchar("status").default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: varchar("name").notNull(),
  identifier: varchar("identifier").notNull().unique(),
  location: text("location"),
  address: text("address"),
  contactPhone: varchar("contact_phone"),
  managerName: varchar("manager_name"),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  dailyLimit: decimal("daily_limit", { precision: 12, scale: 2 }).default("1000000.00").notNull(),
  dailyCollected: decimal("daily_collected", { precision: 12, scale: 2 }).default("0.00").notNull(), // For merchants - money collected today
  dailyTransferred: decimal("daily_transferred", { precision: 12, scale: 2 }).default("0.00").notNull(), // For cashiers - money transferred today
  lastResetDate: timestamp("last_reset_date").defaultNow().notNull(),
  lastTransactionDate: timestamp("last_transaction_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transaction_id").unique().notNull(), // LUS-XXXXXX format
  fromUserId: varchar("from_user_id"),
  toUserId: varchar("to_user_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type").notNull(), // cash_digitization, settlement, transfer, rtp, qr_code_payment
  status: varchar("status").notNull(), // pending, approved, completed, rejected
  priority: varchar("priority").default("medium"), // low, medium, high - set by admin
  description: text("description"),
  vmfNumber: varchar("vmf_number"), // Voucher Movement Form number
  vmfDocumentIds: text("vmf_document_ids").array(),
  rejectionReason: varchar("rejection_reason"), // reason for rejection
  qrCode: text("qr_code"),
  processedBy: varchar("processed_by"), // cashier who processed the transaction
  assignedCashierId: varchar("assigned_cashier_id"), // OTP-assigned cashier
  otpUsed: varchar("otp_used"), // OTP that was used for this transaction
  expiresAt: timestamp("expires_at"), // Transaction expiration timestamp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  transactionId: integer("transaction_id"),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  size: integer("size").notNull(),
  type: varchar("type").notNull(), // vmf_merchant, vmf_cashbag, etc
  createdAt: timestamp("created_at").defaultNow(),
});

export const settlementRequests = pgTable("settlement_requests", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  bankName: varchar("bank_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  status: varchar("status").notNull(), // pending, approved, hold, rejected, completed
  priority: varchar("priority").notNull(), // low, medium, high
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  holdReason: varchar("hold_reason"), // insufficient_documentation, settlement_cover, pending_verification, other
  rejectReason: varchar("reject_reason"), // invalid_account_details, duplicate_request, policy_violation, other
  reasonComment: varchar("reason_comment", { length: 125 }), // For "other" reasons
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const qrCodes = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().references(() => transactions.id),
  qrCodeHash: varchar("qr_code_hash", { length: 64 }).notNull().unique(), // SHA-256 hash
  qrData: text("qr_data").notNull(), // Encrypted QR code payload
  expiresAt: timestamp("expires_at").notNull(), // 2 minutes from creation
  isUsed: boolean("is_used").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cashierOtpHistory = pgTable("cashier_otp_history", {
  id: serial("id").primaryKey(),
  cashierUserId: varchar("cashier_user_id").notNull(),
  fixedId: varchar("fixed_id", { length: 4 }).notNull(),
  fullOtp: varchar("full_otp", { length: 9 }).notNull(),
  generatedAt: timestamp("generated_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  transactionId: integer("transaction_id"),
  paymentType: varchar("payment_type"), // 'rtp' or 'qr'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // settlement_status_change, transaction_update, system_alert
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: varchar("related_entity_type"), // settlement_request, transaction
  relatedEntityId: integer("related_entity_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// AML Configuration table for admin-configurable thresholds
export const amlConfiguration = pgTable("aml_configuration", {
  id: serial("id").primaryKey(),
  configType: varchar("config_type").notNull(), // single_transaction, daily_total, weekly_volume
  thresholdAmount: decimal("threshold_amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("ZMW"),
  isActive: boolean("is_active").default(true),
  description: text("description"),
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AML Alerts table for suspicious activity tracking
export const amlAlerts = pgTable("aml_alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  transactionId: integer("transaction_id"),
  alertType: varchar("alert_type").notNull(), // threshold_exceeded, velocity_check, pattern_anomaly
  riskScore: integer("risk_score").notNull(), // 1-100
  triggerAmount: decimal("trigger_amount", { precision: 15, scale: 2 }),
  thresholdAmount: decimal("threshold_amount", { precision: 15, scale: 2 }),
  description: text("description").notNull(),
  status: varchar("status").default("pending"), // pending, reviewed, cleared, escalated
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  flaggedAt: timestamp("flagged_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Compliance Reports table for automated report generation
export const complianceReports = pgTable("compliance_reports", {
  id: serial("id").primaryKey(),
  reportType: varchar("report_type").notNull(), // daily_summary, weekly_compliance, monthly_regulatory
  reportPeriod: varchar("report_period").notNull(), // YYYY-MM-DD format
  generatedBy: varchar("generated_by").notNull(),
  reportData: jsonb("report_data").notNull(), // Structured report content
  filePath: varchar("file_path"), // Path to generated PDF/Excel file
  status: varchar("status").default("generated"), // generated, submitted, acknowledged
  submittedAt: timestamp("submitted_at"),
  emailDelivered: boolean("email_delivered").default(false),
  emailDeliveredAt: timestamp("email_delivered_at"),
  emailRecipients: text("email_recipients"), // JSON array of email addresses
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  requiresAction: boolean("requires_action").default(false),
  actionDeadline: timestamp("action_deadline"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chart of Accounts for Smile Money Platform
export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: serial("id").primaryKey(),
  accountCode: varchar("account_code", { length: 10 }).notNull().unique(),
  accountName: varchar("account_name").notNull(),
  accountType: varchar("account_type").notNull(), // asset, liability, equity, revenue, expense
  parentAccountId: integer("parent_account_id"),
  isActive: boolean("is_active").default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Journal Entry System for Double-Entry Accounting
export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  entryNumber: varchar("entry_number").notNull().unique(), // JE-YYYYMMDD-XXXX
  transactionId: varchar("transaction_id"), // Link to transaction if applicable
  entryDate: timestamp("entry_date").notNull(),
  description: text("description").notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status").default("posted"), // draft, posted, reversed
  createdBy: varchar("created_by").notNull(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Journal Entry Lines for Each Debit/Credit
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull(),
  accountCode: varchar("account_code", { length: 10 }).notNull(),
  accountName: varchar("account_name").notNull(),
  debitAmount: decimal("debit_amount", { precision: 15, scale: 2 }).default("0.00"),
  creditAmount: decimal("credit_amount", { precision: 15, scale: 2 }).default("0.00"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Smile Money Revenue Tracking
export const smileMoneyRevenue = pgTable("smile_money_revenue", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(), // Customer organization
  transactionId: varchar("transaction_id"), // Source transaction
  journalEntryId: integer("journal_entry_id"), // Link to accounting entry
  revenueType: varchar("revenue_type").notNull(), // transaction_fee, settlement_fee, monthly_service
  feeAmount: decimal("fee_amount", { precision: 12, scale: 2 }).notNull(),
  feePercentage: decimal("fee_percentage", { precision: 5, scale: 2 }), // For percentage-based fees
  billingPeriod: varchar("billing_period"), // YYYY-MM for monthly fees
  collectedAt: timestamp("collected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const userRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  sentTransactions: many(transactions, { relationName: "sender" }),
  receivedTransactions: many(transactions, { relationName: "receiver" }),
  documents: many(documents),
  settlementRequests: many(settlementRequests),
  notifications: many(notifications),
}));

export const organizationRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  branches: many(branches),
  settlementRequests: many(settlementRequests),
}));

export const branchRelations = relations(branches, ({ one }) => ({
  organization: one(organizations, {
    fields: [branches.organizationId],
    references: [organizations.id],
  }),
}));

export const walletRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const transactionRelations = relations(transactions, ({ one, many }) => ({
  sender: one(users, {
    fields: [transactions.fromUserId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [transactions.toUserId],
    references: [users.id],
    relationName: "receiver",
  }),
  documents: many(documents),
  qrCodes: many(qrCodes),
}));

export const qrCodeRelations = relations(qrCodes, ({ one }) => ({
  transaction: one(transactions, {
    fields: [qrCodes.transactionId],
    references: [transactions.id],
  }),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [documents.transactionId],
    references: [transactions.id],
  }),
}));

export const settlementRequestRelations = relations(settlementRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [settlementRequests.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [settlementRequests.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [settlementRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const kycDocumentRelations = relations(kycDocuments, ({ one }) => ({
  organization: one(organizations, {
    fields: [kycDocuments.organizationId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [kycDocuments.uploadedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [kycDocuments.reviewedBy], 
    references: [users.id],
  }),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  parentAccount: one(chartOfAccounts, {
    fields: [chartOfAccounts.parentAccountId],
    references: [chartOfAccounts.id],
    relationName: "subAccounts",
  }),
  subAccounts: many(chartOfAccounts, { relationName: "subAccounts" }),
  journalEntryLines: many(journalEntryLines),
}));

export const journalEntryRelations = relations(journalEntries, ({ one, many }) => ({
  creator: one(users, {
    fields: [journalEntries.createdBy],
    references: [users.id],
    relationName: "createdEntries",
  }),
  approver: one(users, {
    fields: [journalEntries.approvedBy],
    references: [users.id],
    relationName: "approvedEntries",
  }),
  journalEntryLines: many(journalEntryLines),
  smileMoneyRevenue: many(smileMoneyRevenue),
}));

export const journalEntryLineRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(chartOfAccounts, {
    fields: [journalEntryLines.accountCode],
    references: [chartOfAccounts.accountCode],
  }),
}));

export const smileMoneyRevenueRelations = relations(smileMoneyRevenue, ({ one }) => ({
  organization: one(organizations, {
    fields: [smileMoneyRevenue.organizationId],
    references: [organizations.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [smileMoneyRevenue.journalEntryId],
    references: [journalEntries.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  identifier: z.string().optional(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  transactionId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertSettlementRequestSchema = createInsertSchema(settlementRequests).omit({
  id: true,
  reviewedBy: true,
  reviewedAt: true,
  holdReason: true,
  rejectReason: true,
  reasonComment: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export const insertQrCodeSchema = createInsertSchema(qrCodes).omit({
  id: true,
  isUsed: true,
  usedAt: true,
  createdAt: true,
});

export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectReason: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAmlConfigurationSchema = createInsertSchema(amlConfiguration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAmlAlertSchema = createInsertSchema(amlAlerts).omit({
  id: true,
  flaggedAt: true,
  createdAt: true,
});

export const insertComplianceReportSchema = createInsertSchema(complianceReports).omit({
  id: true,
  createdAt: true,
});

export const insertChartOfAccountsSchema = createInsertSchema(chartOfAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({
  id: true,
  createdAt: true,
});

export const insertSmileMoneyRevenueSchema = createInsertSchema(smileMoneyRevenue).omit({
  id: true,
  collectedAt: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type SettlementRequest = typeof settlementRequests.$inferSelect;
export type InsertSettlementRequest = z.infer<typeof insertSettlementRequestSchema>;
export type QrCode = typeof qrCodes.$inferSelect;
export type InsertQrCode = z.infer<typeof insertQrCodeSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type AmlConfiguration = typeof amlConfiguration.$inferSelect;
export type InsertAmlConfiguration = z.infer<typeof insertAmlConfigurationSchema>;
export type AmlAlert = typeof amlAlerts.$inferSelect;
export type InsertAmlAlert = z.infer<typeof insertAmlAlertSchema>;
export type ComplianceReport = typeof complianceReports.$inferSelect;
export type InsertComplianceReport = z.infer<typeof insertComplianceReportSchema>;
export type ChartOfAccounts = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccounts = z.infer<typeof insertChartOfAccountsSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;
export type SmileMoneyRevenue = typeof smileMoneyRevenue.$inferSelect;
export type InsertSmileMoneyRevenue = z.infer<typeof insertSmileMoneyRevenueSchema>;

// Email Settings table for managing email recipients
export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  settingKey: varchar("setting_key").notNull().unique(), // finance_emails, operations_emails, etc.
  settingValue: text("setting_value"), // comma-separated email addresses
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailSetting = typeof emailSettings.$inferSelect;
export type InsertEmailSetting = z.infer<typeof insertEmailSettingsSchema>;
