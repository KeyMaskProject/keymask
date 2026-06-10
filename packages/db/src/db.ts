import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Postgres 连接惰性创建:不在 import 时强求 DATABASE_URL(typecheck/构建环境无 DB)。
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return _db;
}

export { schema };
