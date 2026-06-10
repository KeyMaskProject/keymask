// 云端连接信息:~/.keysark/cloud.json(`keysark login` 设备码授权写出 { server, token, provider })。
// CLI 是完全独立的程序,直连云端 web 接口;--server / KEYSARK_SERVER 可覆盖服务器地址。
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function keysarkDir(): string {
  return process.env.KEYSARK_HOME || join(homedir(), ".keysark");
}

export function cloudConfigPath(): string {
  return join(keysarkDir(), "cloud.json");
}

export interface CloudConn {
  server: string;
  token: string;
  provider?: string;
}

/** 读云端登录态(`keysark login` 写出);没有/损坏返回 null。 */
export function loadCloud(): CloudConn | null {
  try {
    const cfg = JSON.parse(readFileSync(cloudConfigPath(), "utf8")) as Partial<CloudConn>;
    if (typeof cfg.server === "string" && cfg.server && typeof cfg.token === "string" && cfg.token) {
      return { server: cfg.server, token: cfg.token, provider: cfg.provider };
    }
  } catch {
    /* 无 cloud.json */
  }
  return null;
}

export function saveCloud(c: CloudConn): void {
  mkdirSync(keysarkDir(), { recursive: true });
  writeFileSync(cloudConfigPath(), JSON.stringify(c), { mode: 0o600 });
}

export function clearCloud(): void {
  rmSync(cloudConfigPath(), { force: true });
}

export interface Conn {
  baseUrl: string;
  token: string | null;
}

/** 解析云端连接。serverOverride 来自 --server / KEYSARK_SERVER;未登录返回 null token。 */
export function resolveConn(serverOverride?: string): Conn | null {
  const cloud = loadCloud();
  const override = (serverOverride ?? process.env.KEYSARK_SERVER ?? "").replace(/\/+$/, "");
  if (override) {
    return { baseUrl: override, token: cloud && cloud.server === override ? cloud.token : null };
  }
  if (cloud) return { baseUrl: cloud.server, token: cloud.token };
  return null;
}
