"use client";

// 端到端加密保险库面板(支持多保险库)。助记词与派生密钥只在浏览器,绝不发服务端。
// 登录流:0 个库 → 创建;1 个库 → 直接解锁;≥2 个库 → 先选库,再输入该库助记词。
// 数据模型:keysark.json 注册表(明文元数据 + 密文校验块)+ 每个库各自的 index/items(见 @/lib/vault、@/lib/registry)。
// UI 参照 1Password:选择/解锁/创建为居中卡片,已解锁为「条目列 + 详情」两栏工作台。
import { useEffect, useMemo, useRef, useState } from "react";
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
  deriveKey,
  generateMnemonic,
  makeVerifier,
  validateMnemonic,
} from "@keysark/crypto";
import { newId } from "@keysark/db/id";
import {
  ChevronRight,
  ExternalLink,
  Folder,
  Hash,
  Inbox,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Logo, Wordmark } from "./brand";
import { HeaderControls } from "./controls";
import { UserMenu } from "./user-menu";
import { useT } from "./providers";
import { Vault, itemRelPath, type EntryMeta, type FolderMeta } from "@/lib/vault";
import type { StorageLocation } from "@/lib/storage";
import {
  b64decode,
  b64encode,
  saveRegistry,
  vaultDir,
  type Registry,
  type VaultDescriptor,
} from "@/lib/registry";

interface VaultUser {
  name: string;
  avatar: string | null;
}

type Phase = "select" | "unlock" | "create" | "unlocked";

export function VaultPanel({
  vaults: initialVaults,
  user,
}: {
  vaults: VaultDescriptor[];
  user: VaultUser;
}) {
  const t = useT();
  // 默认库:无名或 label 为 "default"(创建首个库时的占位)。一律不显示 "default" 字样。
  const isDefaultVault = (v: VaultDescriptor): boolean => {
    const l = v.label.trim().toLowerCase();
    return l === "" || l === "default";
  };
  const vaultName = (v: VaultDescriptor): string =>
    isDefaultVault(v) ? t("default_vault") : v.label.trim();

  // 注册表(随新建保险库增长)
  const [vaults, setVaults] = useState<VaultDescriptor[]>(initialVaults);
  const [selectedVault, setSelectedVault] = useState<VaultDescriptor | null>(
    initialVaults.length === 1 ? initialVaults[0]! : null,
  );
  const [phase, setPhase] = useState<Phase>(
    initialVaults.length === 0 ? "create" : initialVaults.length === 1 ? "unlock" : "select",
  );

  const vaultRef = useRef<Vault | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 解锁输入
  const [mnemonicInput, setMnemonicInput] = useState("");

  // 创建流程
  const [newLabel, setNewLabel] = useState("");
  const [newMnemonic, setNewMnemonic] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const challengeIdx = useMemo(() => {
    const idx = new Set<number>();
    while (idx.size < 3) idx.add(Math.floor(Math.random() * 12));
    return [...idx].sort((a, b) => a - b);
  }, [newMnemonic]);
  const [challengeInput, setChallengeInput] = useState<Record<number, string>>({});

  // 已解锁 / 工作台
  const [entries, setEntries] = useState<EntryMeta[]>([]);
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(0);
  // 详情区两种模式:打开已有条目为只读 preview;新建/点击编辑进入 edit。
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  // 当前条目在网盘里的位置(预览态下方展示)
  const [location, setLocation] = useState<StorageLocation | null>(null);
  // 编辑态的所属文件夹 / 标签
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // 侧栏导航:全部 / 某文件夹 / 某标签
  type Nav = { kind: "all" } | { kind: "folder"; id: string } | { kind: "tag"; name: string };
  const [nav, setNav] = useState<Nav>({ kind: "all" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const allTags = useMemo(
    () => [...new Set(entries.flatMap((e) => e.tags))].sort((a, b) => a.localeCompare(b)),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (nav.kind === "folder" && e.folderId !== nav.id) return false;
      if (nav.kind === "tag" && !e.tags.includes(nav.name)) return false;
      if (q && !(e.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, query, nav]);

  // 预览某条目时,查询它在网盘里的位置 / 访问链接(只读元数据,不涉及内容)。
  useEffect(() => {
    if (mode !== "preview" || !selectedId || !selectedVault) {
      setLocation(null);
      return;
    }
    let alive = true;
    const relPath = itemRelPath(selectedVault.dir, selectedId);
    setLocation(null);
    fetch(`/api/files/locate?path=${encodeURIComponent(relPath)}`)
      .then((res) => (res.ok ? (res.json() as Promise<StorageLocation>) : null))
      .then((loc) => {
        if (alive && loc && !("error" in loc)) setLocation(loc);
      })
      .catch(() => {
        /* 定位失败不影响阅读;静默 */
      });
    return () => {
      alive = false;
    };
  }, [mode, selectedId, selectedVault]);

  async function enterVault(key: CryptoKey, descriptor: VaultDescriptor) {
    const v = new Vault(key, { id: descriptor.id, dir: descriptor.dir });
    vaultRef.current = v;
    setSelectedVault(descriptor);
    setPhase("unlocked");
    setLoadingEntries(true);
    setStatus(null);
    try {
      const list = await v.load();
      setEntries(list);
      setFolders(v.folders);
      setPending(v.pendingCount());
    } catch (err) {
      setStatus(t("st_load_fail", String(err)));
    } finally {
      setLoadingEntries(false);
    }
  }

  // ---- 选择保险库 ----
  function pickVault(v: VaultDescriptor) {
    setSelectedVault(v);
    setMnemonicInput("");
    setStatus(null);
    setPhase("unlock");
  }

  // ---- 解锁(对选中的保险库校验助记词) ----
  async function unlock() {
    const m = mnemonicInput.trim().replace(/\s+/g, " ");
    if (!validateMnemonic(m)) return setStatus(t("st_invalid_mnemonic"));
    if (!selectedVault) return setStatus(t("st_missing_meta"));
    setBusy(true);
    setStatus(t("st_unlocking"));
    try {
      const k = await deriveKey(m);
      const verifierBytes = b64decode(selectedVault.verifier);
      if (!(await checkVerifier(k, verifierBytes))) {
        setStatus(t("st_mismatch"));
        return;
      }
      setMnemonicInput("");
      await enterVault(k, selectedVault);
    } catch (err) {
      setStatus(t("st_unlock_fail", String(err)));
    } finally {
      setBusy(false);
    }
  }

  // ---- 创建(新建保险库,追加进注册表) ----
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
        setStatus(t("st_word_mismatch", i + 1));
        return;
      }
    }
    setBusy(true);
    setStatus(t("st_creating"));
    try {
      const k = await deriveKey(newMnemonic);
      const verifier = await makeVerifier(k);
      const id = newId();
      // 第一个保险库无需取名,默认为 "default";后续保险库用用户输入的名字。
      const label = vaults.length === 0 ? "default" : newLabel.trim();
      const descriptor: VaultDescriptor = {
        id,
        label,
        dir: vaultDir(id),
        verifier: b64encode(verifier),
        createdAt: Date.now(),
      };
      const nextRegistry: Registry = { v: 1, vaults: [...vaults, descriptor] };
      await saveRegistry(nextRegistry);
      setVaults(nextRegistry.vaults);
      setNewMnemonic(null);
      setNewLabel("");
      await enterVault(k, descriptor);
    } catch (err) {
      setStatus(t("st_create_fail", String(err)));
    } finally {
      setBusy(false);
    }
  }

  // ---- 各登录界面之间切换 ----
  function goCreate() {
    setNewMnemonic(null);
    setNewLabel("");
    setConfirming(false);
    setChallengeInput({});
    setMnemonicInput("");
    setStatus(null);
    setPhase("create");
  }
  /** 返回「选择/解锁」:多库回到选择,单库回到解锁,无库回到创建。 */
  function goPick() {
    setStatus(null);
    setMnemonicInput("");
    if (vaults.length > 1) setPhase("select");
    else if (vaults.length === 1) {
      setSelectedVault(vaults[0]!);
      setPhase("unlock");
    } else setPhase("create");
  }

  // ---- 工作台:读写 ----
  async function openEntry(meta: EntryMeta) {
    const v = vaultRef.current;
    if (!v) return;
    setBusy(true);
    setStatus(t("st_decrypting", meta.title || t("untitled")));
    try {
      const doc = await v.open(meta.id);
      setSelectedId(doc.id);
      setTitle(doc.title);
      setContent(doc.content);
      // 文件夹/标签以 index 元数据为准(文件夹增删后 doc 内可能已过期)
      setEditFolderId(meta.folderId);
      setEditTags(meta.tags);
      setTagInput("");
      setMode("preview");
      setStatus(null);
    } catch (err) {
      setStatus(t("st_open_fail", String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const v = vaultRef.current;
    if (!v) return;
    setBusy(true);
    setStatus(t("st_saving"));
    try {
      const result = await v.save({
        id: selectedId,
        title: title.trim(),
        content,
        folderId: editFolderId,
        tags: editTags,
      });
      setEntries(result.entries);
      setSelectedId(result.id);
      setPending(v.pendingCount());
      setMode("preview"); // 保存后回到只读预览
      setStatus(result.synced ? t("st_saved") : t("st_saved_local", result.syncError ?? ""));
    } catch (err) {
      setStatus(t("st_save_fail", String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    const v = vaultRef.current;
    if (!v) return;
    setBusy(true);
    setStatus(t("st_syncing"));
    try {
      const { remaining } = await v.sync();
      setPending(remaining);
      setStatus(remaining === 0 ? t("st_sync_ok") : t("pending_count", remaining));
    } catch (err) {
      setPending(v.pendingCount());
      setStatus(t("st_sync_fail", String(err)));
    } finally {
      setBusy(false);
    }
  }

  function newItem() {
    setSelectedId(null);
    setTitle("");
    setContent("");
    // 当前停在某文件夹下就默认归到该文件夹
    setEditFolderId(nav.kind === "folder" ? nav.id : null);
    setEditTags([]);
    setTagInput("");
    setMode("edit"); // 新建直接进编辑
    setStatus(null);
  }

  // 标签编辑
  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    setEditTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagInput("");
  }
  function removeTag(tag: string) {
    setEditTags((prev) => prev.filter((x) => x !== tag));
  }

  function editEntry() {
    setMode("edit");
    setStatus(null);
  }

  async function cancelEdit() {
    setStatus(null);
    setTagInput("");
    // 编辑已有条目 → 放弃改动,重新读回原文进入预览;新建未保存 → 清空回到空预览。
    const meta = selectedId ? entries.find((e) => e.id === selectedId) : null;
    if (meta) {
      await openEntry(meta);
    } else {
      setSelectedId(null);
      setTitle("");
      setContent("");
      setEditTags([]);
      setMode("preview");
    }
  }

  // ---- 文件夹管理 ----
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runFolderOp(op: () => Promise<{ synced: boolean; syncError?: string }>) {
    const v = vaultRef.current;
    if (!v) return;
    setBusy(true);
    try {
      const res = await op();
      setFolders(v.folders);
      setEntries(v.entries);
      setPending(v.pendingCount());
      if (!res.synced) setStatus(t("st_saved_local", res.syncError ?? ""));
    } catch (err) {
      setStatus(t("st_save_fail", String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function addFolderUnder(parentId: string | null) {
    const v = vaultRef.current;
    if (!v) return;
    setBusy(true);
    try {
      const res = await v.addFolder(t("new_folder"), parentId);
      setFolders(res.folders);
      setPending(v.pendingCount());
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      // 立即进入重命名
      setRenamingId(res.id);
      setRenameValue(t("new_folder"));
      if (!res.synced) setStatus(t("st_saved_local", res.syncError ?? ""));
    } catch (err) {
      setStatus(t("st_save_fail", String(err)));
    } finally {
      setBusy(false);
    }
  }

  function startRename(f: FolderMeta) {
    setRenamingId(f.id);
    setRenameValue(f.name);
  }
  async function commitRename() {
    const id = renamingId;
    if (!id) return;
    const name = renameValue.trim();
    setRenamingId(null);
    if (name) await runFolderOp(() => vaultRef.current!.renameFolder(id, name));
  }
  async function removeFolder(f: FolderMeta) {
    if (!window.confirm(t("confirm_delete_folder", f.name || t("new_folder")))) return;
    if (nav.kind === "folder" && nav.id === f.id) setNav({ kind: "all" });
    await runFolderOp(() => vaultRef.current!.deleteFolder(f.id));
  }

  function lock() {
    // 清内存密钥后整页刷新:让服务端重新读取注册表(含新建后的保险库)。
    vaultRef.current = null;
    setContent("");
    setTitle("");
    window.location.reload();
  }

  // ============================ 选择保险库 ============================
  if (phase === "select") {
    return (
      <CenteredShell user={user}>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("select_title")}</CardTitle>
            <CardDescription>{t("select_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
              {vaults.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => pickVault(v)}
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-3 text-left transition-colors hover:bg-[var(--color-accent)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                      <Logo className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{vaultName(v)}</span>
                      <span className="block text-xs text-[var(--color-muted-foreground)]">
                        {t("select_enter_phrase")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-[var(--color-border)] pt-3 text-center">
              <Button variant="link" size="sm" onClick={goCreate} disabled={busy}>
                {t("new_vault")}
              </Button>
            </div>
            <StatusLine status={status} />
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  // ============================ 创建保险库 ============================
  if (phase === "create") {
    return (
      <CenteredShell user={user}>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("create_title")}</CardTitle>
            <CardDescription>
              {t("create_desc_a")}
              <b>{t("create_desc_strong")}</b>
              {t("create_desc_b")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* 第一个保险库无需取名(默认 default);新增保险库时才让用户命名以便区分 */}
            {vaults.length > 0 ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  {t("create_label")}
                </span>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={t("create_label_ph")}
                  disabled={busy || !!newMnemonic}
                />
              </label>
            ) : null}
            {!newMnemonic ? (
              <>
                <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-muted-foreground)]">
                  {t("create_warn_a")}
                  <b className="text-[var(--color-danger)]">{t("create_warn_strong")}</b>
                  {t("create_warn_b")}
                </div>
                <Button onClick={genMnemonic} disabled={busy} size="lg">
                  {t("btn_generate")}
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
                <p className="text-xs text-[var(--color-muted-foreground)]">{t("copy_hint")}</p>
                <Button onClick={() => setConfirming(true)} disabled={busy} size="lg">
                  {t("btn_copied")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm">{t("confirm_prompt")}</p>
                <div className="flex flex-col gap-3">
                  {challengeIdx.map((i) => (
                    <label key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-[var(--color-muted-foreground)]">
                        {t("word_nth", i + 1)}
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
                    {t("btn_confirm_create")}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                    {t("btn_review_again")}
                  </Button>
                </div>
              </>
            )}
            {vaults.length > 0 ? (
              <div className="border-t border-[var(--color-border)] pt-3 text-center">
                <Button variant="link" size="sm" onClick={goPick} disabled={busy}>
                  {t("back_to_unlock")}
                </Button>
              </div>
            ) : null}
            <StatusLine status={status} />
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  // ============================ 解锁保险库 ============================
  if (phase === "unlock") {
    return (
      <CenteredShell user={user}>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("unlock_title")}</CardTitle>
            <CardDescription>
              {selectedVault ? t("unlock_desc_named", vaultName(selectedVault)) : t("unlock_desc")}
            </CardDescription>
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
              {t("btn_unlock")}
            </Button>
            <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-3 text-center">
              {vaults.length > 1 ? (
                <Button variant="link" size="sm" onClick={goPick} disabled={busy}>
                  {t("switch_vault")}
                </Button>
              ) : null}
              <Button variant="link" size="sm" onClick={goCreate} disabled={busy}>
                {t("new_vault")}
              </Button>
            </div>
            <StatusLine status={status} />
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  // ============================ 工作台:两栏(条目列 + 详情) ============================
  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const currentName = selectedVault ? vaultName(selectedVault) : t("default_vault");

  // 文件夹树:递归展开为带缩进的扁平行(仅展开节点的子项)。
  const childFolders = (parentId: string | null) =>
    folders.filter((f) => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));

  // 编辑态文件夹下拉:整棵树扁平化,用前缀缩进表示层级。
  function folderOptions(): { id: string; label: string }[] {
    const out: { id: string; label: string }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const f of childFolders(parentId)) {
        out.push({ id: f.id, label: `${"  ".repeat(depth)}${f.name || t("new_folder")}` });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }
  function folderRows(parentId: string | null, depth: number): React.ReactNode[] {
    return childFolders(parentId).flatMap((f) => {
      const hasKids = folders.some((c) => c.parentId === f.id);
      const open = expanded.has(f.id);
      const active = nav.kind === "folder" && nav.id === f.id;
      const row = (
        <div
          key={f.id}
          className={`group flex items-center rounded-[var(--radius)] pr-1 ${
            active
              ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
              : "hover:bg-[var(--color-accent)]"
          }`}
          style={{ paddingLeft: depth * 14 }}
        >
          <button
            type="button"
            onClick={() => hasKids && toggleExpand(f.id)}
            className="flex h-7 w-5 shrink-0 items-center justify-center text-[var(--color-muted-foreground)]"
            aria-hidden={!hasKids}
          >
            {hasKids ? (
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
            ) : null}
          </button>
          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
          {renamingId === f.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="ml-1.5 h-6 min-w-0 flex-1 rounded border border-[var(--color-input)] bg-[var(--color-surface)] px-1 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNav({ kind: "folder", id: f.id })}
              className="ml-1.5 min-w-0 flex-1 truncate py-1.5 text-left text-sm"
            >
              {f.name || t("new_folder")}
            </button>
          )}
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title={t("add_subfolder")}
              onClick={() => addFolderUnder(f.id)}
              disabled={busy}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-surface)]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={t("rename")}
              onClick={() => startRename(f)}
              disabled={busy}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-surface)]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={t("delete")}
              onClick={() => removeFolder(f)}
              disabled={busy}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      );
      return open ? [row, ...folderRows(f.id, depth + 1)] : [row];
    });
  }

  return (
    <div className="grid h-screen grid-cols-[15rem_18rem_1fr] overflow-hidden">
      {/* 导航:全部 / 文件夹树 / 标签 */}
      <aside className="flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="flex h-14 items-center border-b border-[var(--color-border)] px-4">
          <Wordmark className="text-base" />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => setNav({ kind: "all" })}
            className={`flex w-full items-center gap-2 rounded-[var(--radius)] px-2.5 py-2 text-left text-sm font-medium ${
              nav.kind === "all"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                : "hover:bg-[var(--color-accent)]"
            }`}
          >
            <Inbox className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
            <span className="flex-1 truncate">{t("all_items")}</span>
            <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
              {entries.length}
            </span>
          </button>

          {/* 文件夹 */}
          <div className="mt-3 flex items-center justify-between px-2 pb-1">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {t("folders_label")}
            </span>
            <button
              type="button"
              title={t("new_folder")}
              onClick={() => addFolderUnder(null)}
              disabled={busy}
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {folders.length === 0 ? (
            <p className="px-2.5 py-1 text-xs text-[var(--color-muted-foreground)]">—</p>
          ) : (
            <div className="flex flex-col">{folderRows(null, 0)}</div>
          )}

          {/* 标签 */}
          {allTags.length > 0 ? (
            <>
              <div className="mt-3 px-2 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                {t("tags_label")}
              </div>
              <div className="flex flex-col">
                {allTags.map((tag) => {
                  const active = nav.kind === "tag" && nav.name === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNav({ kind: "tag", name: tag })}
                      className={`flex items-center gap-2 rounded-[var(--radius)] px-2.5 py-1.5 text-left text-sm ${
                        active
                          ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                          : "hover:bg-[var(--color-accent)]"
                      }`}
                    >
                      <Hash className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                      <span className="truncate">{tag}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-4 py-2.5">
          <Logo className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm font-semibold">{currentName}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
            {t("status_unlocked")} · {t("items_count", entries.length)}
          </span>
        </div>
      </aside>

      {/* 条目列 */}
      <section className="flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            className="h-9 flex-1"
          />
          <Button variant="default" size="sm" onClick={newItem} disabled={busy}>
            {t("btn_new")}
          </Button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {loadingEntries ? (
            <li className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {t("loading_entries")}
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {entries.length === 0 ? t("empty_vault") : t("empty_search")}
            </li>
          ) : (
            filtered.map((e) => {
              const active = e.id === selectedId;
              const label = e.title || t("untitled");
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => openEntry(e)}
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
                      {label.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{label}</span>
                      <span
                        className={`block truncate text-xs ${active ? "opacity-80" : "text-[var(--color-muted-foreground)]"}`}
                      >
                        {e.tags.length > 0 ? e.tags.map((x) => `#${x}`).join(" ") : t("bytes_cipher", e.size)}
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
        {/* 头部:左侧为同步状态,右侧语言/主题切换在头像左侧 */}
        <div className="flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] px-6">
          <div className="flex min-w-0 items-center gap-3">
            {pending > 0 ? (
              <Button variant="secondary" size="sm" onClick={syncNow} disabled={busy}>
                {t("btn_sync")} · {t("pending_count", pending)}
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                {t("synced")}
              </span>
            )}
            <StatusLine status={status} inline />
          </div>
          <div className="flex items-center gap-3">
            <HeaderControls />
            <UserMenu name={user.name} avatar={user.avatar} onLock={lock} />
          </div>
        </div>
        {mode === "edit" ? (
          // ---- 编辑模式:标题输入与 保存/取消 同一行,内容在下 ----
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <div className="flex items-center gap-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("field_title_ph")}
                className="min-w-0 flex-1"
              />
              <Button size="sm" onClick={save} disabled={busy}>
                {t("btn_save")}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={busy}>
                {t("btn_cancel")}
              </Button>
            </div>
            {/* 文件夹 + 标签 */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                <Folder className="h-3.5 w-3.5" />
                <select
                  value={editFolderId ?? ""}
                  onChange={(e) => setEditFolderId(e.target.value || null)}
                  className="h-8 rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-foreground)]"
                >
                  <option value="">{t("root_folder")}</option>
                  {folderOptions().map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex min-w-[12rem] flex-1 flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-surface)] px-2 py-1.5">
                <Hash className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                {editTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs text-[var(--color-accent-foreground)]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagInput);
                    } else if (e.key === "Backspace" && !tagInput && editTags.length) {
                      removeTag(editTags[editTags.length - 1]!);
                    }
                  }}
                  onBlur={() => addTag(tagInput)}
                  placeholder={t("tags_ph")}
                  className="h-6 min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-foreground)]"
                />
              </div>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("content_ph")}
              className="min-h-[18rem] flex-1 resize-none font-mono leading-relaxed"
            />
          </div>
        ) : selectedId ? (
          // ---- 预览模式:只读 ----
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <div className="flex items-center gap-3">
              <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
                {selected ? selected.title || t("untitled") : t("untitled")}
              </h2>
              <Button size="sm" onClick={editEntry} disabled={busy}>
                {t("btn_edit")}
              </Button>
            </div>
            {selected && selected.tags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {selected.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNav({ kind: "tag", name: tag })}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 text-xs text-[var(--color-accent-foreground)] hover:brightness-95"
                  >
                    <Hash className="h-3 w-3" />
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
            <article className="flex-1 whitespace-pre-wrap break-words rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm leading-relaxed">
              {content ? (
                content
              ) : (
                <span className="text-[var(--color-muted-foreground)]">{t("content_empty")}</span>
              )}
            </article>
            {location ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted-foreground)]">
                <span className="shrink-0">
                  {t("stored_at", t(location.provider === "google" ? "provider_google" : "provider_baidu"))}
                </span>
                <code className="min-w-0 break-all text-[var(--color-foreground)]">{location.path}</code>
                {location.url ? (
                  <a
                    href={location.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[var(--color-primary)] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("open_in_netdisk")}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          // ---- 无选中:空态 ----
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--color-muted-foreground)]">
            {t("preview_empty")}
          </div>
        )}
      </section>
    </div>
  );
}

// 居中外壳:选择/解锁/创建页用,顶栏带品牌 + 语言/主题切换 + 用户菜单。
function CenteredShell({ children, user }: { children: React.ReactNode; user: VaultUser }) {
  return (
    <main className="relative flex min-h-screen flex-col bg-[var(--color-background)]">
      <div className="hero-aurora" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-5">
        <Wordmark className="text-lg" />
        <div className="flex items-center gap-3">
          <HeaderControls />
          <UserMenu name={user.name} avatar={user.avatar} />
        </div>
      </header>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}

function StatusLine({ status, inline }: { status: string | null; inline?: boolean }) {
  if (!status) return null;
  return (
    <span className={`text-xs text-[var(--color-muted-foreground)] ${inline ? "truncate" : ""}`}>
      {status}
    </span>
  );
}
