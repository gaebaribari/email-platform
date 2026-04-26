import { mysqlTable, varchar, int, text, boolean } from "drizzle-orm/mysql-core";

// 이메일 리스트 (구독자 그룹)
export const email_lists = mysqlTable("email_lists", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }).notNull().default(""),
  created_at: varchar("created_at", { length: 50 })
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// 구독자
export const subscribers = mysqlTable("subscribers", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull().default(""),
  list_id: int("list_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending | verified | unsubscribed
  token: varchar("token", { length: 255 }).notNull().default(""), // 더블옵트인 검증 토큰
  gdpr_consent: boolean("gdpr_consent").notNull().default(false),
  subscribed_at: varchar("subscribed_at", { length: 50 })
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  verified_at: varchar("verified_at", { length: 50 }).notNull().default(""),
});

// 캠페인
export const campaigns = mysqlTable("campaigns", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull().default(""),
  list_id: int("list_id").notNull(),
  template: text("template").notNull().default(""), // HTML 템플릿 (변수치환 지원)
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft | scheduled | sent
  scheduled_at: varchar("scheduled_at", { length: 50 }).notNull().default(""),
  sent_at: varchar("sent_at", { length: 50 }).notNull().default(""),
  sent_count: int("sent_count").notNull().default(0),
  created_at: varchar("created_at", { length: 50 })
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
