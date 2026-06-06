"use client";

// 端到端加密保险库面板。助记词与派生密钥只在浏览器,绝不发服务端。
// API 只搬运 base64 密文。UI 参照 1Password:解锁/创建为居中卡片,
// 已解锁为「侧边栏 + 条目列表 + 详情编辑」三栏布局。
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@keysark/ui";
import {
  checkVerifier,
  decryptFromEnvelope,
  deriveKey,
  encryptToEnvelope,
  generateMnemonic,
  makeVerifier,
  validateMnemonic,
} from "@keysark/crypto";
import { Logo, Wordmark } from "./brand";

const META_NAME = ".keysark.json";

export interface VaultFile {
  id: string;
  name: string;
  size: number;
}

function b64encode(u: Uint8Array): string {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function putFile(path: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, contentB64: b64encode(bytes) }),
  });
  const data = (await res.json()) as { ok?: boolean; message?: string };
  if (!res.ok || !data.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
}
async function getFileBytes(fileId: string): Promise<Uint8Array> {
  const res = await fetch(`/api/files/content?fileId=${encodeURIComponent(fileId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { contentB64: string };
  return b64decode(data.contentB64);
}

type Phase = "unlock" | "create" | "unlocked";

export function VaultPanel({
  vaultInitialized,
  metaFileId,
  initialFiles,
  loadError,
}: {
  vaultInitialized: boolean;
  metaFileId: string | null;
  initialFiles: VaultFile[];
  loadError: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(vaultInitialized ? "unlock" : "create");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [status, setStatus] = useState<string | null>(
    loadError ? `加载列表失败: ${loadError}` : null,
  );
  const [busy, setBusy] = useState(false);

  // 解锁输入
  const [mnemonicInput, setMnemonicInput] = useState("");

  // 创建流程
  const [newMnemonic, setNewMnemonic] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const challengeIdx = useMemo(() => {
    // 备份抽查 3 个词位(非机密,UI 用普通随机即可)
    const idx = new Set<number>();
    while (idx.size < 3) idx.add(Math.floor(Math.random() * 12));
    return [...idx].sort((a, b) => a - b);
  }, [newMnemonic]);
  const [challengeInput, setChallengeInput] = useState<Record<number, string>>({});

  // 已解锁
  const [files, setFiles] = useState<VaultFile[]>(initialFiles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");

  const filtered = useMemo(
    () => files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())),
    [files, query],
  );

  async function refreshList() {
    const res = await fetch("/api/files");
    if (!res.ok) return setStatus("刷新列表失败");
    const data = (await res.json()) as { files: VaultFile[] };
    setFiles(data.files.filter((f) => f.name !== META_NAME));
  }

  // ---- 解锁 ----
  async function unlock() {
    const m = mnemonicInput.trim().replace(/\s+/g, " ");
    if (!validateMnemonic(m)) return setStatus("助记词无效(请检查 12 个词与拼写)");
    if (!metaFileId) return setStatus("缺少保险库元数据");
    setBusy(true);
    setStatus("解锁中 …");
    try {
      const k = await deriveKey(m);
      const verifierBytes = await getFileBytes(metaFileId);
      if (!(await checkVerifier(k, verifierBytes))) {
        setStatus("助记词不匹配此保险库");
        return;
      }
      setKey(k);
      setMnemonicInput("");
      setPhase("unlocked");
      setStatus(null);
    } catch (err) {
      setStatus(`解锁失败: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // ---- 创建 ----
  function genMnemonic() {
    setNewMnemonic(generateMnemonic());
    setConfirming(false);
    setChallengeInput({});
    setStatus(null);
  }

  async function finishCreate() {
    if (!newMnemonic) return;
    const words = newMnemonic.split(" ");
    for (const i of challengeIdx) {
      if ((challengeInput[i] ?? "").trim() !== words[i]) {
        setStatus(`第 ${i + 1} 个词不匹配,请核对备份`);
        return;
      }
    }
    setBusy(true);
    setStatus("创建保险库 …");
    try {
      const k = await deriveKey(newMnemonic);
      const verifier = await makeVerifier(k);
      await putFile(META_NAME, verifier);
      setKey(k);
      setNewMnemonic(null);
      setPhase("unlocked");
      setStatus(null);
    } catch (err) {
      setStatus(`创建失败: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // ---- 已解锁:读写 ----
  async function openFile(file: VaultFile) {
    if (!key) return;
    setBusy(true);
    setStatus(`解密 ${file.name} …`);
    try {
      const bytes = await getFileBytes(file.id);
      setSelectedId(file.id);
      setPath(file.name);
      setContent(await decryptFromEnvelope(key, bytes));
      setStatus(null);
    } catch (err) {
      setStatus(`打开失败: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!key) return;
    const p = path.trim();
    if (!p) return setStatus("请填写文件名 / 路径");
    if (p === META_NAME) return setStatus("该文件名为保险库元数据,请换一个");
    setBusy(true);
    setStatus("加密保存中 …");
    try {
      const envelope = await encryptToEnvelope(key, content);
      await putFile(p, envelope);
      setStatus(`已加密保存 /apps/Keyper/${p}`);
      await refreshList();
    } catch (err) {
      setStatus(`保存失败: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function newItem() {
    setSelectedId(null);
    setPath("");
    setContent("");
    setStatus(null);
  }

  function lock() {
    // 清内存密钥后整页刷新:让服务端重新列出保险库状态(含新建后的 metaFileId)。
    setKey(null);
    setContent("");
    setPath("");
    window.location.reload();
  }

  // ============================ 创建保险库 ============================
  if (phase === "create") {
    return (
      <CenteredShell>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>创建你的保险库</CardTitle>
            <CardDescription>
              KeysArk 会生成 12 词助记词作为主密钥。它<b>只显示一次、只存在你这里</b>。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!newMnemonic ? (
              <>
                <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-muted-foreground)]">
                  请准备好纸笔。生成后请抄写并妥善保管——
                  <b className="text-[var(--color-danger)]">丢失即数据永久无法恢复</b>,
                  没有任何人(包括我们)能替你找回。
                </div>
                <Button onClick={genMnemonic} disabled={busy} size="lg">
                  生成助记词
                </Button>
              </>
            ) : !confirming ? (
              <>
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {newMnemonic.split(" ").map((w, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-sm"
                    >
                      <span className="text-[var(--color-muted-foreground)] tabular-nums">
                        {i + 1}.
                      </span>
                      <span className="font-medium">{w}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  抄写完成后继续,下一步会抽查几个词以确认你已备份。
                </p>
                <Button onClick={() => setConfirming(true)} disabled={busy} size="lg">
                  我已抄写,继续
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm">请按编号填入对应的词以确认备份:</p>
                <div className="flex flex-col gap-3">
                  {challengeIdx.map((i) => (
                    <label key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-[var(--color-muted-foreground)]">
                        第 {i + 1} 个
                      </span>
                      <Input
                        value={challengeInput[i] ?? ""}
                        onChange={(e) =>
                          setChallengeInput((prev) => ({ ...prev, [i]: e.target.value }))
                        }
                        className="font-mono"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={finishCreate} disabled={busy}>
                    确认并创建
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                    再看一遍助记词
                  </Button>
                </div>
              </>
            )}
            <StatusLine status={status} />
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  // ============================ 解锁保险库 ============================
  if (phase === "unlock") {
    return (
      <CenteredShell>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>解锁保险库</CardTitle>
            <CardDescription>输入 12 词助记词,在本地派生密钥以解密内容。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea
              value={mnemonicInput}
              onChange={(e) => setMnemonicInput(e.target.value)}
              placeholder="word1 word2 … word12"
              rows={3}
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) unlock();
              }}
            />
            <Button onClick={unlock} disabled={busy} size="lg">
              解锁
            </Button>
            <StatusLine status={status} />
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  // ============================ 已解锁:三栏 ============================
  const selected = files.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="grid h-screen grid-cols-[15rem_20rem_1fr] overflow-hidden">
      {/* 侧边栏 */}
      <aside className="flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="flex h-14 items-center border-b border-[var(--color-border)] px-4">
          <Wordmark className="text-base" />
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <p className="px-2 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            保管库
          </p>
          <div className="flex items-center justify-between rounded-[var(--radius)] bg-[var(--color-accent)] px-2.5 py-2 text-sm font-medium text-[var(--color-accent-foreground)]">
            <span className="flex items-center gap-2">
              <Logo className="h-4 w-4" />
              全部条目
            </span>
            <span className="tabular-nums text-xs text-[var(--color-muted-foreground)]">
              {files.length}
            </span>
          </div>
        </nav>
        <div className="border-t border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs text-[var(--color-muted-foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
            已解锁
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={lock} disabled={busy}>
            锁定保险库
          </Button>
        </div>
      </aside>

      {/* 条目列表 */}
      <section className="flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4">
          <span className="text-sm font-semibold">全部条目</span>
          <Button variant="default" size="sm" onClick={newItem} disabled={busy}>
            + 新建
          </Button>
        </div>
        <div className="border-b border-[var(--color-border)] p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索条目…"
            className="h-9"
          />
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {files.length === 0 ? "保险库还是空的,点「+ 新建」开始。" : "没有匹配的条目。"}
            </li>
          ) : (
            filtered.map((f) => {
              const active = f.id === selectedId;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openFile(f)}
                    disabled={busy}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                        : "hover:bg-[var(--color-accent)]"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                        active
                          ? "bg-[var(--color-primary-foreground)]/20"
                          : "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                      }`}
                    >
                      {f.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span
                        className={`block text-xs ${active ? "opacity-80" : "text-[var(--color-muted-foreground)]"}`}
                      >
                        {f.size} 字节(密文)
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* 详情 / 编辑 */}
      <section className="flex flex-col bg-[var(--color-background)]">
        <div className="flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] px-6">
          <span className="truncate text-sm font-semibold">
            {selected ? selected.name : "新建条目"}
          </span>
          <StatusLine status={status} inline />
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
              文件名 / 相对路径
            </span>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="如 notes/todo.txt"
            />
          </label>
          <label className="flex min-h-0 flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--color-muted-foreground)]">内容</span>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在这里编辑文本(保存时在本地加密)…"
              className="min-h-[18rem] flex-1 resize-none font-mono leading-relaxed"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={busy}>
              加密保存到网盘
            </Button>
            <Button variant="outline" onClick={newItem} disabled={busy}>
              清空
            </Button>
            <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
              密文存于 /apps/Keyper/
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// 居中外壳:解锁/创建页用,顶部带品牌。
function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[var(--color-background)] px-4 py-12">
      <Wordmark className="text-xl" />
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function StatusLine({ status, inline }: { status: string | null; inline?: boolean }) {
  if (!status) return inline ? null : null;
  return (
    <span
      className={`text-xs text-[var(--color-muted-foreground)] ${inline ? "truncate" : ""}`}
    >
      {status}
    </span>
  );
}
