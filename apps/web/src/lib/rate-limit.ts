// 轻量内存固定窗口限流。用于 CLI 设备码端点等防滥用入口。
// 注意:进程内状态 —— serverless/多实例下是「每实例」尽力而为,不是全局严格限额;
// 生产要严格全局限流应换 Redis 等共享存储。这里目的是挡住单实例上的暴力轮询/刷码。
import { NextResponse } from "next/server";

interface Window {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Window>();

/** 取客户端标识:优先 x-forwarded-for 首段(代理后真实 IP),回退 x-real-ip,再回退常量。 */
export function clientKey(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 命中限流返回剩余等待秒数;未命中返回 null。固定窗口。 */
export function rateLimit(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now();
  const w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // 顺手清理过期桶,避免无界增长(低频路径,直接遍历足够)。
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return null;
  }
  if (w.count >= limit) return Math.ceil((w.resetAt - now) / 1000);
  w.count++;
  return null;
}

/** 便捷封装:命中则返回 429 响应,否则 null。 */
export function enforceRateLimit(
  request: Request,
  opts: { bucket: string; limit: number; windowMs: number },
): NextResponse | null {
  const retry = rateLimit(`${opts.bucket}:${clientKey(request)}`, opts.limit, opts.windowMs);
  if (retry === null) return null;
  return NextResponse.json(
    { error: "rate_limited", retryAfter: retry },
    { status: 429, headers: { "Retry-After": String(retry) } },
  );
}
