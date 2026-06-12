// CLI 设备码授权的读写。仅云端 Postgres 模式可用(直连 drizzle,不走可插拔 token-store);
// 桌面 JSON 模式没有 DATABASE_URL,调用会抛错 —— 桌面场景走 local.json token,不经这里。
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { getDb } from "./db";
import { cliAuthRequest, cliToken } from "./schema";

export type CliAuthStatus = "pending" | "approved" | "consumed" | "denied";

/** CLI 令牌默认有效期:90 天。到期后强制重新 `ark login`。 */
export const CLI_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface CliAuthRequestRecord {
  id: string;
  userCode: string;
  status: CliAuthStatus;
  provider: string | null;
  accountKey: string | null;
  expiresAt: Date;
}

function toRecord(r: typeof cliAuthRequest.$inferSelect): CliAuthRequestRecord {
  return {
    id: r.id,
    userCode: r.userCode,
    status: r.status as CliAuthStatus,
    provider: r.provider,
    accountKey: r.accountKey,
    expiresAt: r.expiresAt,
  };
}

/** 新建授权请求;顺手清理已过期的旧行(免得 user_code 唯一约束积垃圾)。 */
export async function createCliAuthRequest(input: {
  deviceCodeHash: string;
  userCode: string;
  expiresAt: Date;
}): Promise<void> {
  const db = getDb();
  await db.delete(cliAuthRequest).where(lt(cliAuthRequest.expiresAt, new Date()));
  await db.insert(cliAuthRequest).values(input);
}

/** 按核对码取未过期的请求(网页授权页用)。 */
export async function getCliAuthRequestByUserCode(
  userCode: string,
): Promise<CliAuthRequestRecord | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cliAuthRequest)
    .where(eq(cliAuthRequest.userCode, userCode))
    .limit(1);
  const r = rows[0];
  if (!r || r.expiresAt.getTime() < Date.now()) return null;
  return toRecord(r);
}

/** 网页确认授权:绑定当前登录账号。仅 pending 可批准(防重放/覆盖)。 */
export async function approveCliAuthRequest(
  id: string,
  provider: string,
  accountKey: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(cliAuthRequest)
    .set({ status: "approved", provider, accountKey })
    .where(and(eq(cliAuthRequest.id, id), eq(cliAuthRequest.status, "pending")))
    .returning({ id: cliAuthRequest.id });
  return rows.length > 0;
}

export async function denyCliAuthRequest(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(cliAuthRequest)
    .set({ status: "denied" })
    .where(and(eq(cliAuthRequest.id, id), eq(cliAuthRequest.status, "pending")));
}

/** CLI 轮询:按 device_code 哈希取请求状态(不消费)。过期返回 null。 */
export async function getCliAuthRequestByDeviceHash(
  deviceCodeHash: string,
): Promise<CliAuthRequestRecord | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cliAuthRequest)
    .where(eq(cliAuthRequest.deviceCodeHash, deviceCodeHash))
    .limit(1);
  const r = rows[0];
  if (!r || r.expiresAt.getTime() < Date.now()) return null;
  return toRecord(r);
}

/** 原子消费 approved 请求(并发轮询只有一个赢家拿到 true,token 只发一次)。 */
export async function consumeCliAuthRequest(id: string): Promise<CliAuthRequestRecord | null> {
  const db = getDb();
  const rows = await db
    .update(cliAuthRequest)
    .set({ status: "consumed" })
    .where(and(eq(cliAuthRequest.id, id), eq(cliAuthRequest.status, "approved")))
    .returning();
  return rows[0] ? toRecord(rows[0]) : null;
}

export interface CliTokenRecord {
  id: string;
  provider: string;
  accountKey: string;
}

export async function createCliToken(input: {
  tokenHash: string;
  provider: string;
  accountKey: string;
  /** 过期时间;缺省按 CLI_TOKEN_TTL_MS 计算。 */
  expiresAt?: Date;
}): Promise<void> {
  await getDb().insert(cliToken).values({
    tokenHash: input.tokenHash,
    provider: input.provider,
    accountKey: input.accountKey,
    expiresAt: input.expiresAt ?? new Date(Date.now() + CLI_TOKEN_TTL_MS),
  });
}

/** 按令牌哈希取未吊销且未过期的 CLI token(/api/files* 鉴权用),顺手记 lastUsedAt。 */
export async function getCliTokenByHash(tokenHash: string): Promise<CliTokenRecord | null> {
  const db = getDb();
  const rows = await db
    .update(cliToken)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(cliToken.tokenHash, tokenHash),
        isNull(cliToken.revokedAt),
        gt(cliToken.expiresAt, new Date()),
      ),
    )
    .returning({
      id: cliToken.id,
      provider: cliToken.provider,
      accountKey: cliToken.accountKey,
    });
  return rows[0] ?? null;
}

/** 吊销令牌(CLI disconnect / 用户主动撤销)。幂等。 */
export async function revokeCliTokenByHash(tokenHash: string): Promise<void> {
  await getDb()
    .update(cliToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(cliToken.tokenHash, tokenHash), isNull(cliToken.revokedAt)));
}

export interface CliTokenListItem {
  id: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** 列出某账号下的全部 CLI 令牌(供用户侧「已授权设备」列表与撤销入口)。 */
export async function listCliTokensByAccount(
  provider: string,
  accountKey: string,
): Promise<CliTokenListItem[]> {
  const rows = await getDb()
    .select({
      id: cliToken.id,
      createdAt: cliToken.createdAt,
      lastUsedAt: cliToken.lastUsedAt,
      expiresAt: cliToken.expiresAt,
      revokedAt: cliToken.revokedAt,
    })
    .from(cliToken)
    .where(and(eq(cliToken.provider, provider), eq(cliToken.accountKey, accountKey)))
    .orderBy(desc(cliToken.createdAt));
  return rows;
}

/** 按 token id 吊销(用户侧撤销入口用;需校验属于当前账号)。幂等。 */
export async function revokeCliTokenById(
  id: string,
  provider: string,
  accountKey: string,
): Promise<boolean> {
  const rows = await getDb()
    .update(cliToken)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(cliToken.id, id),
        eq(cliToken.provider, provider),
        eq(cliToken.accountKey, accountKey),
        isNull(cliToken.revokedAt),
      ),
    )
    .returning({ id: cliToken.id });
  return rows.length > 0;
}
