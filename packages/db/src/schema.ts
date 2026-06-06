import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { newId } from "./id";

// 百度网盘授权 token,按 (provider, accountKey) 存。
// provider 固定 "baidu";accountKey = 百度用户 uk。token 开发期明文存储 —— 上线应加密。
export const storageAccount = pgTable(
  "storage_account",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    provider: text("provider").notNull(),
    accountKey: text("account_key").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    scope: text("scope").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("storage_account_provider_account").on(t.provider, t.accountKey)],
);
