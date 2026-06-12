// Postgres token 后端(web/云端)。沿用原 Drizzle 逻辑,connection 惰性。
// access/refresh token 字段在落库前用 KEYSARK_DB_ENCRYPTION_KEY 信封加密(见 secret-box)。
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { storageAccount } from "./schema";
import { openField, sealField } from "./secret-box";
import type { StorageAccountRecord, StorageTokenInput, TokenStore } from "./token-store";

function toRecord(row: typeof storageAccount.$inferSelect): StorageAccountRecord {
  return {
    provider: row.provider,
    accountKey: row.accountKey,
    accessToken: openField(row.accessToken),
    refreshToken: openField(row.refreshToken),
    expiresAt: row.expiresAt,
    scope: row.scope,
  };
}

/** 写库前加密 token 字段(scope/expiresAt 非敏感,保持明文便于排查)。 */
function sealTokens(token: StorageTokenInput): StorageTokenInput {
  return {
    ...token,
    accessToken: sealField(token.accessToken),
    refreshToken: sealField(token.refreshToken),
  };
}

export function postgresTokenStore(): TokenStore {
  return {
    async get(provider, accountKey) {
      const rows = await getDb()
        .select()
        .from(storageAccount)
        .where(
          and(eq(storageAccount.provider, provider), eq(storageAccount.accountKey, accountKey)),
        )
        .limit(1);
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async upsert(provider, accountKey, token) {
      const sealed = sealTokens(token);
      await getDb()
        .insert(storageAccount)
        .values({ provider, accountKey, ...sealed })
        .onConflictDoUpdate({
          target: [storageAccount.provider, storageAccount.accountKey],
          set: { ...sealed, updatedAt: new Date() },
        });
    },
    async update(provider, accountKey, token) {
      await getDb()
        .update(storageAccount)
        .set({ ...sealTokens(token), updatedAt: new Date() })
        .where(
          and(eq(storageAccount.provider, provider), eq(storageAccount.accountKey, accountKey)),
        );
    },
    async listByProvider(provider) {
      const rows = await getDb()
        .select()
        .from(storageAccount)
        .where(eq(storageAccount.provider, provider));
      return rows.map(toRecord);
    },
  };
}
