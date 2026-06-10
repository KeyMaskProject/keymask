// token 存储(Postgres)。公开的 storage-accounts 函数委托到这里,
// google.ts/baidu.ts 无需感知后端。
import { postgresTokenStore } from "./token-store-postgres";

export interface StorageTokenInput {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

/** 后端无关的账号记录(消费方只用这些字段)。 */
export interface StorageAccountRecord {
  provider: string;
  accountKey: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface TokenStore {
  get(provider: string, accountKey: string): Promise<StorageAccountRecord | null>;
  upsert(provider: string, accountKey: string, token: StorageTokenInput): Promise<void>;
  update(provider: string, accountKey: string, token: StorageTokenInput): Promise<void>;
  /** 列出某 provider 下的全部账号(本地接口无 cookie 时按唯一账号解析用)。 */
  listByProvider(provider: string): Promise<StorageAccountRecord[]>;
}

let _store: TokenStore | null = null;

export function tokenStore(): TokenStore {
  if (!_store) {
    _store = postgresTokenStore();
  }
  return _store;
}
