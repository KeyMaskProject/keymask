import { uuidv7 } from "uuidv7";

// 全仓库 ID 生成的唯一入口。禁止使用 crypto.randomUUID 或 uuid v1/v3/v4/v5。
export function newId(): string {
  return uuidv7();
}
