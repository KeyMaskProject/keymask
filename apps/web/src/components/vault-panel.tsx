"use client";

// 端到端加密保险库面板。助记词与派生密钥只在浏览器,绝不发服务端。
// API 只搬运 base64 密文。
import { useMemo, useState } from "react";
import { Button } from "@keyper/ui";
import {
  checkVerifier,
  decryptFromEnvelope,
  deriveKey,
  encryptToEnvelope,
  generateMnemonic,
  makeVerifier,
  validateMnemonic,
} from "@keyper/crypto";

const META_NAME = ".keyper.json";

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
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");

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
      setStatus("已解锁");
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
      setStatus("保险库已创建");
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
      setPath(file.name);
      setContent(await decryptFromEnvelope(key, bytes));
      setStatus(`已打开 ${file.name}`);
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

  function lock() {
    // 清内存密钥后整页刷新:让服务端重新列出保险库状态(含新建后的 metaFileId)。
    setKey(null);
    setContent("");
    setPath("");
    window.location.reload();
  }

  // ---- 渲染 ----
  if (phase === "create") {
    return (
      <div className="flex max-w-xl flex-col gap-4 rounded-md border p-6">
        <h2 className="font-medium">创建保险库</h2>
        {!newMnemonic ? (
          <>
            <p className="text-sm opacity-70">
              将生成 12 词助记词作为你的主密钥。它只显示一次、只存在你这里——
              <b>抄写并妥善保管;丢失=数据永久无法恢复</b>。
            </p>
            <Button onClick={genMnemonic} disabled={busy}>
              生成助记词
            </Button>
          </>
        ) : !confirming ? (
          <>
            <ol className="grid grid-cols-3 gap-2 rounded-md bg-[var(--color-accent)] p-3 text-sm">
              {newMnemonic.split(" ").map((w, i) => (
                <li key={i} className="font-mono">
                  <span className="opacity-50">{i + 1}.</span> {w}
                </li>
              ))}
            </ol>
            <p className="text-xs opacity-60">抄写完成后继续,下一步会抽查几个词确认。</p>
            <Button onClick={() => setConfirming(true)} disabled={busy}>
              我已抄写,继续
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">请按编号填入对应的词:</p>
            <div className="flex flex-col gap-2">
              {challengeIdx.map((i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-16 opacity-60">第 {i + 1} 个</span>
                  <input
                    value={challengeInput[i] ?? ""}
                    onChange={(e) =>
                      setChallengeInput((prev) => ({ ...prev, [i]: e.target.value }))
                    }
                    className="flex-1 rounded-md border px-2 py-1 font-mono"
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
        {status ? <span className="text-xs opacity-70">{status}</span> : null}
      </div>
    );
  }

  if (phase === "unlock") {
    return (
      <div className="flex max-w-xl flex-col gap-4 rounded-md border p-6">
        <h2 className="font-medium">解锁保险库</h2>
        <p className="text-sm opacity-70">输入 12 词助记词以在本地派生密钥解密内容。</p>
        <textarea
          value={mnemonicInput}
          onChange={(e) => setMnemonicInput(e.target.value)}
          placeholder="word1 word2 … word12"
          rows={3}
          className="rounded-md border px-3 py-2 font-mono text-sm"
        />
        <Button onClick={unlock} disabled={busy}>
          解锁
        </Button>
        {status ? <span className="text-xs opacity-70">{status}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-green-600">● 已解锁</span>
        <Button variant="outline" size="sm" onClick={lock} disabled={busy}>
          锁定
        </Button>
      </div>
      <div className="grid grid-cols-[200px_1fr] gap-4">
        <aside className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">文件</span>
            <Button variant="ghost" size="sm" onClick={refreshList} disabled={busy}>
              刷新
            </Button>
          </div>
          <ul className="flex flex-col gap-1">
            {files.length === 0 ? (
              <li className="text-xs opacity-60">暂无文件</li>
            ) : (
              files.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openFile(f)}
                    disabled={busy}
                    className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-[var(--color-accent)]"
                  >
                    {f.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="flex flex-col gap-3">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="文件名或相对路径,如 notes/todo.txt"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在这里编辑文本(保存时本地加密) …"
            rows={16}
            className="resize-y rounded-md border px-3 py-2 font-mono text-sm"
          />
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={busy}>
              加密保存到网盘
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPath("");
                setContent("");
                setStatus(null);
              }}
              disabled={busy}
            >
              新建
            </Button>
            {status ? <span className="text-xs opacity-70">{status}</span> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
