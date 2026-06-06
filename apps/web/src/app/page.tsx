import { getConnectedBaidu } from "@/lib/baidu";
import { Button } from "@keyper/ui";
import { VaultPanel, type VaultFile } from "@/components/vault-panel";

const META_NAME = ".keyper.json";

export default async function Home() {
  const conn = await getConnectedBaidu();

  let connected = false;
  let vaultInitialized = false;
  let metaFileId: string | null = null;
  let files: VaultFile[] = [];
  let loadError: string | null = null;

  if (conn) {
    connected = true;
    try {
      const list = await conn.client.list("", { order: "time", desc: true });
      const meta = list.find((f) => f.isdir === 0 && f.server_filename === META_NAME);
      vaultInitialized = !!meta;
      metaFileId = meta ? String(meta.fs_id) : null;
      files = list
        .filter((f) => f.isdir === 0 && f.server_filename !== META_NAME)
        .map((f) => ({ id: String(f.fs_id), name: f.server_filename, size: f.size }));
    } catch (err) {
      loadError = String(err);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Keyper</h1>
          <p className="text-sm opacity-70">
            端到端加密的网盘文本保管库 · 密文存于百度网盘 <code>/apps/Keyper/</code>
          </p>
        </div>
        {connected ? (
          <form action="/api/auth/logout" method="post">
            <Button variant="outline" size="sm" type="submit">
              登出
            </Button>
          </form>
        ) : null}
      </header>

      {connected ? (
        <VaultPanel
          vaultInitialized={vaultInitialized}
          metaFileId={metaFileId}
          initialFiles={files}
          loadError={loadError}
        />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-md border p-6">
          <p className="text-sm">尚未连接百度网盘账号。</p>
          <a href="/api/auth/login">
            <Button>连接百度网盘</Button>
          </a>
        </div>
      )}
    </main>
  );
}
