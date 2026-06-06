import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { storageAccount } from "./schema";

export type StorageAccount = typeof storageAccount.$inferSelect;

export interface StorageTokenInput {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export async function getStorageAccount(
  provider: string,
  accountKey: string,
): Promise<StorageAccount | null> {
  const rows = await db
    .select()
    .from(storageAccount)
    .where(
      and(
        eq(storageAccount.provider, provider),
        eq(storageAccount.accountKey, accountKey),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** 首次授权 / 重新授权落库,按 (provider, accountKey) 去重。 */
export async function upsertStorageAccount(
  provider: string,
  accountKey: string,
  token: StorageTokenInput,
): Promise<void> {
  await db
    .insert(storageAccount)
    .values({
      provider,
      accountKey,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scope: token.scope,
    })
    .onConflictDoUpdate({
      target: [storageAccount.provider, storageAccount.accountKey],
      set: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        scope: token.scope,
        updatedAt: new Date(),
      },
    });
}

/** access_token 刷新后更新存量记录。 */
export async function updateStorageTokens(
  provider: string,
  accountKey: string,
  token: StorageTokenInput,
): Promise<void> {
  await db
    .update(storageAccount)
    .set({
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scope: token.scope,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(storageAccount.provider, provider),
        eq(storageAccount.accountKey, accountKey),
      ),
    );
}
