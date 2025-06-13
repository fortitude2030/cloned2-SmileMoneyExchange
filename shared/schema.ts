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

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("merchant"), // merchant, cashier, finance, admin
  organizationId: integer("organization_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  type: varchar("type").default("financial_institution"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: varchar("name").notNull(),
  identifier: varchar("identifier").notNull().unique(),
  location: text("location"),
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
  type: varchar("type").notNull(), // cash_digitization, settlement, transfer
  status: varchar("status").notNull(), // pending, approved, completed, rejected
  priority: varchar("priority").default("medium"), // low, medium, high - set by admin
  description: text("description"),
  vmfNumber: varchar("vmf_number"), // Voucher Movement Form number
  vmfDocumentIds: text("vmf_document_ids").array(),
  rejectionReason: varchar("rejection_reason"), // reason for rejection
  qrCode: text("qr_code"),
  processedBy: varchar("processed_by"), // cashier who processed the transaction
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

// Core Banking Tables
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  accountNumber: varchar("account_number").notNull().unique(),
  accountType: varchar("account_type").notNull(), // savings, current, mobile_wallet
  currency: varchar("currency").notNull().default("ZMW"), // ZMW, USD
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00"),
  availableBalance: decimal("available_balance", { precision: 15, scale: 2 }).default("0.00"),
  blockedAmount: decimal("blocked_amount", { precision: 15, scale: 2 }).default("0.00"),
  dailyLimit: decimal("daily_limit", { precision: 12, scale: 2 }).default("50000.00"),
  monthlyLimit: decimal("monthly_limit", { precision: 12, scale: 2 }).default("1000000.00"),
  kycLevel: varchar("kyc_level").notNull().default("basic"), // basic, enhanced, full
  status: varchar("status").notNull().default("active"), // active, suspended, closed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  transactionRef: varchar("transaction_ref").notNull().unique(),
  fromAccountId: integer("from_account_id").references(() => bankAccounts.id),
  toAccountId: integer("to_account_id").references(() => bankAccounts.id),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").notNull().default("ZMW"),
  transactionType: varchar("transaction_type").notNull(), // transfer, deposit, withdrawal, payment
  channel: varchar("channel").notNull(), // mobile, atm, pos, agent, online
  status: varchar("status").notNull().default("pending"), // pending, completed, failed, reversed
  description: text("description"),
  externalRef: varchar("external_ref"), // NFS/RTGS reference
  fees: decimal("fees", { precision: 10, scale: 2 }).default("0.00"),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nfsTransactions = pgTable("nfs_transactions", {
  id: serial("id").primaryKey(),
  bankTransactionId: integer("bank_transaction_id").notNull().references(() => bankTransactions.id),
  nfsMessageType: varchar("nfs_message_type").notNull(), // 0200, 0210, 0420, 0430
  stan: varchar("stan").notNull(), // System Trace Audit Number
  rrn: varchar("rrn").notNull(), // Retrieval Reference Number
  responseCode: varchar("response_code"), // 00, 01, 05, etc
  terminalId: varchar("terminal_id"),
  merchantId: varchar("merchant_id"),
  cardNumber: varchar("card_number"), // Masked PAN
  processingCode: varchar("processing_code"),
  authCode: varchar("auth_code"),
  rawMessage: text("raw_message"), // Full ISO 8583 message
  createdAt: timestamp("created_at").defaultNow(),
});

export const rtgsTransactions = pgTable("rtgs_transactions", {
  id: serial("id").primaryKey(),
  bankTransactionId: integer("bank_transaction_id").notNull().references(() => bankTransactions.id),
  rtgsRef: varchar("rtgs_ref").notNull().unique(),
  senderBank: varchar("sender_bank").notNull(),
  receiverBank: varchar("receiver_bank").notNull(),
  messageType: varchar("message_type").notNull(), // MT103, MT202
  status: varchar("status").notNull().default("pending"), // pending, settled, failed
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const complianceChecks = pgTable("compliance_checks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: integer("transaction_id").references(() => bankTransactions.id),
  checkType: varchar("check_type").notNull(), // aml, kyc, sanctions, pep
  status: varchar("status").notNull(), // pending, passed, failed, manual_review
  riskScore: integer("risk_score"), // 0-100
  alerts: text("alerts").array(),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentNetworks = pgTable("agent_networks", {
  id: serial("id").primaryKey(),
  agentCode: varchar("agent_code").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id),
  businessName: varchar("business_name").notNull(),
  location: text("location").notNull(),
  floatBalance: decimal("float_balance", { precision: 12, scale: 2 }).default("0.00"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).default("0.0150"), // 1.5%
  status: varchar("status").notNull().default("active"), // active, suspended, terminated
  onboardedAt: timestamp("onboarded_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at"),
});

export const regulatoryReports = pgTable("regulatory_reports", {
  id: serial("id").primaryKey(),
  reportType: varchar("report_type").notNull(), // boz_return, fic_str, transaction_report
  reportPeriod: varchar("report_period").notNull(), // daily, weekly, monthly
  generatedFor: varchar("generated_for").notNull(), // 2024-01, 2024-W15
  status: varchar("status").notNull().default("pending"), // pending, generated, submitted
  filePath: varchar("file_path"),
  submittedAt: timestamp("submitted_at"),
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
  bankAccounts: many(bankAccounts),
  complianceChecks: many(complianceChecks),
  agentNetwork: one(agentNetworks, {
    fields: [users.id],
    references: [agentNetworks.userId],
  }),
}));

export const bankAccountRelations = relations(bankAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [bankAccounts.userId],
    references: [users.id],
  }),
  outgoingTransactions: many(bankTransactions, { relationName: "fromAccount" }),
  incomingTransactions: many(bankTransactions, { relationName: "toAccount" }),
}));

export const bankTransactionRelations = relations(bankTransactions, ({ one, many }) => ({
  fromAccount: one(bankAccounts, {
    fields: [bankTransactions.fromAccountId],
    references: [bankAccounts.id],
    relationName: "fromAccount",
  }),
  toAccount: one(bankAccounts, {
    fields: [bankTransactions.toAccountId],
    references: [bankAccounts.id],
    relationName: "toAccount",
  }),
  nfsTransaction: one(nfsTransactions, {
    fields: [bankTransactions.id],
    references: [nfsTransactions.bankTransactionId],
  }),
  rtgsTransaction: one(rtgsTransactions, {
    fields: [bankTransactions.id],
    references: [rtgsTransactions.bankTransactionId],
  }),
  complianceChecks: many(complianceChecks),
}));

export const nfsTransactionRelations = relations(nfsTransactions, ({ one }) => ({
  bankTransaction: one(bankTransactions, {
    fields: [nfsTransactions.bankTransactionId],
    references: [bankTransactions.id],
  }),
}));

export const rtgsTransactionRelations = relations(rtgsTransactions, ({ one }) => ({
  bankTransaction: one(bankTransactions, {
    fields: [rtgsTransactions.bankTransactionId],
    references: [bankTransactions.id],
  }),
}));

export const complianceCheckRelations = relations(complianceChecks, ({ one }) => ({
  user: one(users, {
    fields: [complianceChecks.userId],
    references: [users.id],
  }),
  transaction: one(bankTransactions, {
    fields: [complianceChecks.transactionId],
    references: [bankTransactions.id],
  }),
}));

export const agentNetworkRelations = relations(agentNetworks, ({ one }) => ({
  user: one(users, {
    fields: [agentNetworks.userId],
    references: [users.id],
  }),
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

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({
  id: true,
  transactionRef: true,
  processedAt: true,
  createdAt: true,
});

export const insertNfsTransactionSchema = createInsertSchema(nfsTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertRtgsTransactionSchema = createInsertSchema(rtgsTransactions).omit({
  id: true,
  settledAt: true,
  createdAt: true,
});

export const insertComplianceCheckSchema = createInsertSchema(complianceChecks).omit({
  id: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
});

export const insertAgentNetworkSchema = createInsertSchema(agentNetworks).omit({
  id: true,
  onboardedAt: true,
  lastActivityAt: true,
});

export const insertRegulatoryReportSchema = createInsertSchema(regulatoryReports).omit({
  id: true,
  filePath: true,
  submittedAt: true,
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

// Core Banking Types
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;
export type NfsTransaction = typeof nfsTransactions.$inferSelect;
export type InsertNfsTransaction = z.infer<typeof insertNfsTransactionSchema>;
export type RtgsTransaction = typeof rtgsTransactions.$inferSelect;
export type InsertRtgsTransaction = z.infer<typeof insertRtgsTransactionSchema>;
export type ComplianceCheck = typeof complianceChecks.$inferSelect;
export type InsertComplianceCheck = z.infer<typeof insertComplianceCheckSchema>;
export type AgentNetwork = typeof agentNetworks.$inferSelect;
export type InsertAgentNetwork = z.infer<typeof insertAgentNetworkSchema>;
export type RegulatoryReport = typeof regulatoryReports.$inferSelect;
export type InsertRegulatoryReport = z.infer<typeof insertRegulatoryReportSchema>;
