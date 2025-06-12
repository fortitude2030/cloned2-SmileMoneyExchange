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
