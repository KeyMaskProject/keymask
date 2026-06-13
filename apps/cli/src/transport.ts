// CLI 侧密文中转:打 localhost 的 /api/files*(带 x-keysark-token)。
// 只搬运 envelope 密文,绝不发明文/助记词/主密钥。
import { b64decode, b64encode, type StorageTransport } from "@keysark/vault";

export function httpTransport(baseUrl: string, token: string | null): StorageTransport {
  const headers: Record<string, string> = token ? { "x-keysark-token": token } : {};

  async function jsonOrThrow(res: Response, what: string): Promise<unknown> {
    if (res.status === 401) {
      throw new Error(
        `401 unauthorized; token may be revoked or expired. Run \`ark login\`. (${what})`,
      );
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const d = (await res.json()) as { message?: string };
        if (d.message) msg = d.message;
      } catch {
        /* ignore */
      }
      throw new Error(`${what} failed: ${msg}`);
    }
    return res.json();
  }

  return {
    async list(dir) {
      const res = await fetch(`${baseUrl}/api/files?dir=${encodeURIComponent(dir)}`, { headers });
      const data = (await jsonOrThrow(res, "list")) as {
        files: { id: string; name: string; size: number }[];
      };
      const m = new Map<string, { id: string; size: number }>();
      for (const f of data.files) m.set(f.name, { id: f.id, size: f.size });
      return m;
    },
    async upload(path, bytes) {
      const res = await fetch(`${baseUrl}/api/files`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ path, contentB64: b64encode(bytes) }),
      });
      const data = (await jsonOrThrow(res, "upload")) as { ok?: boolean };
      if (!data.ok) throw new Error("upload failed: not confirmed by server");
    },
    async download(relPath) {
      const res = await fetch(
        `${baseUrl}/api/files/content?path=${encodeURIComponent(relPath)}`,
        { headers },
      );
      const data = (await jsonOrThrow(res, "download")) as { contentB64: string };
      return b64decode(data.contentB64);
    },
    async delete(path) {
      const res = await fetch(`${baseUrl}/api/files?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
        headers,
      });
      await jsonOrThrow(res, "delete");
    },
  };
}
