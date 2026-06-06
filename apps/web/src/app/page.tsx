import { getConnectedBaidu } from "@/lib/baidu";
import { Landing } from "@/components/landing";
import { VaultPanel, type VaultFile } from "@/components/vault-panel";

const META_NAME = ".keysark.json";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const conn = await getConnectedBaidu();
  const { error } = await searchParams;

  if (!conn) {
    return <Landing error={error} />;
  }

  let vaultInitialized = false;
  let metaFileId: string | null = null;
  let files: VaultFile[] = [];
  let loadError: string | null = null;

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

  return (
    <VaultPanel
      vaultInitialized={vaultInitialized}
      metaFileId={metaFileId}
      initialFiles={files}
      loadError={loadError}
    />
  );
}
