import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

// type: مخاطبة | مذكرة | تفويض
// direction: وارد | صادر  (null for delegations)
export const correspondenceTable = pgTable("correspondence", {
  id:           serial("id").primaryKey(),
  docNumber:    text("doc_number").notNull(),
  type:         text("type").notNull(), // "correspondence" | "memo" | "delegation"
  direction:    text("direction"),      // "incoming" | "outgoing" | null
  subject:      text("subject").notNull(),
  fromTo:       text("from_to"),
  docDate:      text("doc_date"),
  dueDate:      text("due_date"),
  status:       text("status").notNull().default("open"), // open | closed | pending
  priority:     text("priority").notNull().default("normal"), // normal | urgent | confidential
  notes:        text("notes"),
  attachmentUrl:  text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Correspondence     = typeof correspondenceTable.$inferSelect;
export type InsertCorrespondence = typeof correspondenceTable.$inferInsert;
